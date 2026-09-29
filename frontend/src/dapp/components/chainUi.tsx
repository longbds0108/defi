import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CHAINS, explorerTx, type ChainConfig, type TokenInfo } from '../chains';
import { useChain } from '../state/chain';
import { formatAmount } from '../lib/format';
import type { FlowStep } from '../hooks/useFlow';
import { Modal, TokenMark } from './ui';

export function ChainDot({ config, size = 22 }: { config: ChainConfig; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        className="network-dot network-dot--logo"
        src={config.logo}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
        onError={() => setBroken(true)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="network-dot" style={{ background: config.color, width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {config.short.slice(0, 1)}
    </span>
  );
}

/// Header chain switcher. Changes the app's chain and, when a wallet is
/// connected, asks the wallet to follow.
export function ChainSelect() {
  const { config, setChainId, wrongNetwork, ensureChain } = useChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="chain-select" ref={ref}>
      <button type="button" className={`chain-chip${wrongNetwork ? ' chain-chip--warn' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChainDot config={config} size={18} />
        <span>{config.chain.name}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="chain-menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}>
            {wrongNetwork && (
              <button type="button" className="chain-menu__warn" onClick={() => void ensureChain().catch(() => undefined)}>
                Wallet is on another network — switch to {config.chain.name}
              </button>
            )}
            {CHAINS.map((c) => (
              <button
                key={c.chain.id}
                type="button"
                className={c.chain.id === config.chain.id ? 'is-active' : undefined}
                onClick={() => {
                  setChainId(c.chain.id);
                  setOpen(false);
                  void ensureChain(c.chain.id).catch(() => undefined);
                }}
              >
                <ChainDot config={c} />
                <span>
                  <strong>{c.chain.name}</strong>
                  <small>{c.uniswapApi ? 'Uniswap API · CCA launches' : 'CCA launches · demo quotes'}</small>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChainTokenButton({ token, onClick }: { token: TokenInfo; onClick: () => void }) {
  return (
    <button type="button" className="token-button" onClick={onClick}>
      <TokenMark symbol={token.symbol} color={token.color} size={24} />
      <span>{token.symbol}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/// Token picker for a chain's token list, showing on-chain balances.
export function ChainTokenPicker({
  open,
  onClose,
  tokens,
  exclude,
  balances,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  tokens: TokenInfo[];
  exclude?: string;
  balances?: (t: TokenInfo) => number | undefined;
  onSelect: (t: TokenInfo) => void;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => tokens.filter((t) => t.address !== exclude && `${t.symbol} ${t.name} ${t.address}`.toLowerCase().includes(query.trim().toLowerCase())),
    [tokens, exclude, query],
  );
  return (
    <Modal open={open} onClose={onClose} title="Select a token">
      <input className="search" autoFocus placeholder="Search name, symbol or address" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="token-list">
        {list.map((t) => (
          <li key={t.address}>
            <button
              type="button"
              onClick={() => {
                onSelect(t);
                onClose();
                setQuery('');
              }}
            >
              <TokenMark symbol={t.symbol} color={t.color} size={34} />
              <span>
                <strong>{t.symbol}</strong>
                <small>{t.name}</small>
              </span>
              <span className="token-list__price">{balances?.(t) !== undefined ? formatAmount(balances(t)!) : ''}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="empty">No tokens match “{query}”.</li>}
      </ul>
    </Modal>
  );
}

export function SourceBadge({ live, reason }: { live: boolean; reason?: string }) {
  return live ? (
    <span className="live-badge" title="Quotes and transactions from the Uniswap API">
      <i aria-hidden="true" />
      Live · Uniswap API
    </span>
  ) : (
    <span className="demo-badge" title={reason}>
      <i aria-hidden="true" />
      Demo quote{reason ? ` · ${reason}` : ''}
    </span>
  );
}

const STATUS_ICON: Record<FlowStep['status'], string> = { pending: '○', active: '◌', done: '✓', error: '!', skipped: '–' };

export function FlowSteps({ steps, error }: { steps: FlowStep[]; error?: string | null }) {
  if (steps.length === 0) return null;
  return (
    <div className="flow">
      <ol className="flow__steps">
        {steps.map((s) => (
          <li key={s.id} className={`flow-step flow-step--${s.status}`}>
            <span className="flow-step__icon" aria-hidden="true">
              {STATUS_ICON[s.status]}
            </span>
            <span className="flow-step__label">
              {s.label}
              {s.note && <small>{s.note}</small>}
            </span>
            {s.hash && s.chainId && (
              <a href={explorerTx(s.chainId, s.hash)} target="_blank" rel="noreferrer">
                View ↗
              </a>
            )}
          </li>
        ))}
      </ol>
      {error && <p className="flow__error">{error}</p>}
    </div>
  );
}
