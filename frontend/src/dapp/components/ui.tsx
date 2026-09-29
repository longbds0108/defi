import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { APP_BASE } from '../../Root';
import { TOKENS, seeded, tokenBySymbol, type Token } from '../data/demo';
import { formatPct, formatPrice } from '../lib/format';

export const appPath = (path: string) => `${APP_BASE}${path.startsWith('/') ? path : `/${path}`}`;

/* ---------- Token + network marks ---------- */

// Official logos from the Uniswap default token list (tokens.uniswap.org),
// stored in /public/tokens so the app does not depend on third-party hosts.
const TOKEN_LOGOS: Record<string, string> = {
  ETH: '/tokens/eth.png',
  WETH: '/tokens/weth.png',
  USDC: '/tokens/usdc.png',
  EURC: '/tokens/eurc.png',
  UNI: '/tokens/uni.png',
  LINK: '/tokens/link.png',
  WBTC: '/tokens/wbtc.png',
  AAVE: '/tokens/aave.png',
  ARB: '/tokens/arb.png',
};

export const tokenLogo = (symbol: string) => TOKEN_LOGOS[symbol.toUpperCase()];

/** `plain` skips official logos, e.g. for user-created tokens that may reuse a known symbol. */
export function TokenMark({ symbol, size = 28, color, plain = false }: { symbol: string; size?: number; color?: string; plain?: boolean }) {
  const [broken, setBroken] = useState(false);
  const logo = plain ? undefined : tokenLogo(symbol);
  if (logo && !broken) {
    return (
      <img
        className="token-mark token-mark--logo"
        src={logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        aria-hidden="true"
      />
    );
  }
  const tone = color ?? tokenBySymbol(symbol).color;
  return (
    <span
      className="token-mark"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `radial-gradient(circle at 30% 25%, ${tone}, ${tone}cc 60%, ${tone}88)` }}
      aria-hidden="true"
    >
      {symbol.slice(0, symbol.length > 3 ? 1 : 2)}
    </span>
  );
}

export function PairMark({ a, b, size = 26 }: { a: string; b: string; size?: number }) {
  return (
    <span className="pair-mark" aria-hidden="true">
      <TokenMark symbol={a} size={size} />
      <TokenMark symbol={b} size={size} />
    </span>
  );
}

export function DemoBadge({ children = 'Demo data' }: { children?: ReactNode }) {
  return (
    <span className="demo-badge" title="Illustrative values — not from a live contract or market feed">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function PageHeader({ kicker, title, actions }: { kicker: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <p className="page-header__kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function SubNav({ items }: { items: Array<{ label: string; to: string }> }) {
  return (
    <nav className="subnav" aria-label="Section">
      {items.map((item) => (
        <NavLink key={item.to} to={appPath(item.to)} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={value === option.value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Change({ value }: { value: number }) {
  return <span className={value >= 0 ? 'up' : 'down'}>{formatPct(value)}</span>;
}

/* ---------- Charts (plain SVG) ---------- */

export function Sparkline({ values, width = 96, height = 30 }: { values: number[]; width?: number; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`sparkline ${up ? 'up' : 'down'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/// Area chart with a hover crosshair. `format` renders the hovered value.
export function AreaChart({
  values,
  height = 220,
  format = (v: number) => formatPrice(v),
  labels,
}: {
  values: number[];
  height?: number;
  format?: (value: number) => string;
  labels?: string[];
}) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const width = 800;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => height - 18 - ((v - min) / span) * (height - 44);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const index = hover ?? values.length - 1;

  return (
    <div className="area-chart">
      <div className="area-chart__readout">
        <strong>{format(values[index])}</strong>
        <span>{labels?.[index] ?? (hover === null ? 'Now' : '')}</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Chart from ${format(values[0])} to ${format(values[values.length - 1])}`}
        onPointerMove={(event) => {
          const rect = ref.current?.getBoundingClientRect();
          if (!rect) return;
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          setHover(Math.round(ratio * (values.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <>
            <line x1={x(index)} x2={x(index)} y1="0" y2={height} stroke="rgba(255,255,255,0.2)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(index)} cy={y(values[index])} r="4" fill="#fff" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  );
}

/* ---------- Modal + token picker ---------- */

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal__head">
              <h2>{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TokenPicker({
  open,
  onClose,
  onSelect,
  exclude,
  tokens = TOKENS,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  exclude?: string;
  tokens?: Token[];
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => tokens.filter((t) => t.symbol !== exclude && `${t.symbol} ${t.name}`.toLowerCase().includes(query.trim().toLowerCase())),
    [tokens, exclude, query],
  );

  return (
    <Modal open={open} onClose={onClose} title="Select a token">
      <input className="search" autoFocus placeholder="Search name or symbol" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="token-quick">
        {['USDC', 'EURC', 'ETH', 'WBTC'].filter((s) => s !== exclude).map((symbol) => (
          <button key={symbol} type="button" onClick={() => { onSelect(tokenBySymbol(symbol)); onClose(); }}>
            <TokenMark symbol={symbol} size={20} />
            {symbol}
          </button>
        ))}
      </div>
      <ul className="token-list">
        {list.map((token) => (
          <li key={token.symbol}>
            <button type="button" onClick={() => { onSelect(token); onClose(); setQuery(''); }}>
              <TokenMark symbol={token.symbol} size={34} />
              <span>
                <strong>{token.symbol}</strong>
                <small>{token.name}</small>
              </span>
              <span className="token-list__price">
                {formatPrice(token.price)}
                <Change value={token.change24h} />
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="empty">No tokens match “{query}”.</li>}
      </ul>
    </Modal>
  );
}

export function TokenButton({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  return (
    <button type="button" className="token-button" onClick={onClick}>
      <TokenMark symbol={symbol} size={24} />
      <span>{symbol}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/* ---------- Toasts ---------- */

type Toast = { id: number; title: string; body?: string; tone: 'success' | 'info' | 'error' };
const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { ...toast, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4_200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`app-toast app-toast--${toast.tone}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
            >
              <i aria-hidden="true" />
              <div>
                <strong>{toast.title}</strong>
                {toast.body && <p>{toast.body}</p>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Simulated submit for demo flows: brief pending state, then a toast. */
export function useDemoSubmit() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const submit = useCallback(
    (title: string, body: string, onDone?: () => void) => {
      setPending(true);
      window.setTimeout(() => {
        setPending(false);
        onDone?.();
        toast({ title, body: `${body} Demo only — no transaction was sent.`, tone: 'success' });
      }, 1_100);
    },
    [toast],
  );
  return { pending, submit };
}

/** Deterministic bell-shaped bars for the illustrative liquidity histogram. */
export function seededBars(seed: number, count = 48) {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = (i - count / 2) / (count / 2);
    return 0.25 + Math.exp(-x * x * 5) * 0.75 * (0.7 + rand() * 0.3);
  });
}
