import { useSyncExternalStore } from 'react';

// Transactions sent from this app, kept in the browser so Portfolio → Activity
// can show real hashes with explorer links. Per-device convenience only; the
// chain is the source of truth.

export interface ActivityItem {
  id: string;
  chainId: number;
  kind: 'Swap' | 'Bridge' | 'Approve' | 'Add liquidity' | 'Bid' | 'Claim' | 'Exit' | 'Launch' | 'Create token' | 'Sign';
  summary: string;
  hash?: string;
  account?: string;
  time: number;
}

const KEY = 'lumora.activity';
const listeners = new Set<() => void>();
let cache: ActivityItem[] | null = null;

function read(): ActivityItem[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as ActivityItem[];
  } catch {
    cache = [];
  }
  return cache;
}

export function recordActivity(item: Omit<ActivityItem, 'id' | 'time'>) {
  const next = [{ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: Date.now() }, ...read()].slice(0, 200);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useActivity(account?: string) {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    read,
  );
  return account ? items.filter((i) => !i.account || i.account.toLowerCase() === account.toLowerCase()) : items;
}
