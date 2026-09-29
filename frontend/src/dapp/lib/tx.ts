import { BaseError, isAddress, type TypedDataDefinition } from 'viem';
import type { ApiTransaction, PermitData } from '../uniswap/api';

/** Pre-broadcast checks from the Uniswap integration guide. Never modify `data`. */
export function validateApiTx(tx: ApiTransaction) {
  if (!tx.data || tx.data === '0x') throw new Error('Refusing to send: transaction data is empty.');
  if (!tx.to || !isAddress(tx.to)) throw new Error('Refusing to send: invalid recipient address.');
  if (tx.from && !isAddress(tx.from)) throw new Error('Refusing to send: invalid sender address.');
}

/** Convert an API TransactionRequest into wagmi sendTransaction parameters. */
export function toSendParams(tx: ApiTransaction) {
  validateApiTx(tx);
  return {
    to: tx.to,
    data: tx.data,
    value: tx.value ? BigInt(tx.value) : 0n,
    chainId: tx.chainId,
    gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
  };
}

/**
 * Build a viem typed-data definition from API permit data. The API omits
 * `primaryType` and EIP712Domain; the primary type is the one no other type
 * references, and uint/int values arrive as strings, so they are coerced.
 */
export function toTypedData(permit: PermitData): TypedDataDefinition {
  const types = Object.fromEntries(Object.entries(permit.types).filter(([name]) => name !== 'EIP712Domain'));
  const referenced = new Set(Object.values(types).flatMap((fields) => fields.map((f) => f.type.replace(/\[\]$/, ''))));
  const primaryType = Object.keys(types).find((name) => !referenced.has(name)) ?? Object.keys(types)[0];

  const coerce = (typeName: string, value: unknown): unknown => {
    if (value === null || value === undefined) return value;
    if (typeName.endsWith('[]')) return (value as unknown[]).map((v) => coerce(typeName.slice(0, -2), v));
    if (/^u?int\d*$/.test(typeName)) return BigInt(value as string);
    const struct = types[typeName];
    if (struct) {
      const obj = value as Record<string, unknown>;
      return Object.fromEntries(struct.map((f) => [f.name, coerce(f.type, obj[f.name])]));
    }
    return value;
  };

  const domain = { ...permit.domain } as Record<string, unknown>;
  if (domain.chainId !== undefined) domain.chainId = Number(domain.chainId);

  return {
    domain,
    types,
    primaryType,
    message: coerce(primaryType, permit.values) as Record<string, unknown>,
  } as unknown as TypedDataDefinition;
}

/** Wallet / RPC / contract errors → short readable text. */
export function describeError(error: unknown): string {
  const message =
    error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : 'Something went wrong.';
  if (/user rejected|user denied|rejected the request/i.test(message)) return 'Cancelled in your wallet.';
  if (/insufficient funds/i.test(message)) return 'Not enough balance to pay for gas.';
  if (/BidMustBeAboveClearingPrice/.test(message)) return 'Your max price must be above the current clearing price.';
  if (/AuctionIsOver/.test(message)) return 'This auction has ended.';
  if (/AuctionNotStarted/.test(message)) return 'This auction has not started yet.';
  if (/TokensNotReceived/.test(message)) return 'The auction has not received its tokens yet.';
  return message.split('\n')[0].slice(0, 220);
}
