import { useCallback, useRef, useState } from 'react';
import type { Abi, TypedDataDefinition } from 'viem';
import { useConfig } from 'wagmi';
import { sendTransaction, signTypedData, simulateContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { describeError } from '../lib/tx';
import { recordActivity, type ActivityItem } from '../state/activity';
import { useAuth } from '../auth/AuthProvider';

export type StepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped';

export interface FlowStep {
  id: string;
  label: string;
  status: StepStatus;
  hash?: string;
  chainId?: number;
  note?: string;
}

/// Runs a multi-step on-chain flow (approve → sign → send …) and exposes each
/// step's state for the UI. Every sent transaction waits for its receipt and
/// is recorded in the local activity log.
export function useFlow() {
  const config = useConfig();
  const { address } = useAuth();
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const update = useCallback((id: string, patch: Partial<FlowStep>) => {
    setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const addStep = useCallback((step: Omit<FlowStep, 'status'>, status: StepStatus = 'pending') => {
    setSteps((list) => (list.some((s) => s.id === step.id) ? list : [...list, { ...step, status }]));
  }, []);

  const tx = useCallback(
    async (
      id: string,
      params: { to: `0x${string}`; data?: `0x${string}`; value?: bigint; chainId: number; gas?: bigint },
      activity?: { kind: ActivityItem['kind']; summary: string },
    ) => {
      update(id, { status: 'active', chainId: params.chainId });
      const hash = await sendTransaction(config, params);
      update(id, { hash });
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: params.chainId });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');
      update(id, { status: 'done' });
      if (activity) recordActivity({ ...activity, chainId: params.chainId, hash, account: address });
      return { hash, receipt };
    },
    [config, update, address],
  );

  const contract = useCallback(
    async (
      id: string,
      call: { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint; chainId: number },
      activity?: { kind: ActivityItem['kind']; summary: string },
    ) => {
      update(id, { status: 'active', chainId: call.chainId });
      // Simulate first so reverts surface before the wallet prompt.
      const { request, result } = await simulateContract(config, { ...call, account: address } as never);
      const hash = await writeContract(config, request as never);
      update(id, { hash });
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: call.chainId });
      if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');
      update(id, { status: 'done' });
      if (activity) recordActivity({ ...activity, chainId: call.chainId, hash, account: address });
      return { hash, receipt, result: result as unknown };
    },
    [config, update, address],
  );

  const sign = useCallback(
    async (id: string, typedData: TypedDataDefinition) => {
      update(id, { status: 'active' });
      const signature = await signTypedData(config, typedData as never);
      update(id, { status: 'done' });
      return signature;
    },
    [config, update],
  );

  /** Start a flow with an initial list of steps; the runner can add more. */
  const run = useCallback(async (initial: Array<Omit<FlowStep, 'status'>>, body: () => Promise<void>) => {
    cancelled.current = false;
    setError(null);
    setSteps(initial.map((s) => ({ ...s, status: 'pending' })));
    setRunning(true);
    try {
      await body();
      return true;
    } catch (e) {
      const message = describeError(e);
      setError(message);
      setSteps((list) => list.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)));
      return false;
    } finally {
      setRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
  }, []);

  return { steps, running, error, run, update, addStep, tx, contract, sign, reset };
}
