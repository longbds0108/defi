import { useState } from 'react';
import { DEMO_HOLDINGS, TOKENS, tokenBySymbol } from '../../data/demo';
import { formatAmount, formatUsd, sanitizeAmount } from '../../lib/format';
import { DemoBadge, TokenButton, TokenPicker, useDemoSubmit } from '../../components/ui';

const RAMP_TOKENS = TOKENS.filter((t) => ['USDC', 'EURC', 'ETH', 'WBTC'].includes(t.symbol));
const PRESETS = [50, 100, 250, 1000];

const PAY_METHODS = [
  { id: 'card', label: 'Debit / credit card', fee: 0.029, eta: 'Instant' },
  { id: 'bank', label: 'Bank transfer', fee: 0.005, eta: '1–2 days' },
  { id: 'apple', label: 'Apple Pay', fee: 0.025, eta: 'Instant' },
];

const PAYOUTS = [
  { id: 'bank', label: 'Bank account', fee: 0.01, eta: '1–2 days' },
  { id: 'card', label: 'Debit card', fee: 0.02, eta: 'Minutes' },
];

function MethodList({
  methods,
  value,
  onChange,
  label,
}: {
  methods: Array<{ id: string; label: string; fee: number; eta: string }>;
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <fieldset className="methods">
      <legend>{label}</legend>
      {methods.map((m) => (
        <label key={m.id} className={value === m.id ? 'is-active' : undefined}>
          <input type="radio" name={label} value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} />
          <span>
            <strong>{m.label}</strong>
            <small>
              {(m.fee * 100).toFixed(1)}% fee · {m.eta}
            </small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/// Fiat → crypto. A real build hands off to an on-ramp provider
/// (e.g. Privy funding, MoonPay, Stripe); this screen shows the quote shape.
export function Buy() {
  const [usd, setUsd] = useState('100');
  const [token, setToken] = useState('USDC');
  const [method, setMethod] = useState('card');
  const [picker, setPicker] = useState(false);
  const { pending, submit } = useDemoSubmit();

  const value = Number(usd) || 0;
  const m = PAY_METHODS.find((x) => x.id === method)!;
  const fee = value * m.fee;
  const receive = (value - fee) / tokenBySymbol(token).price;

  return (
    <section className="widget" aria-label="Buy">
      <div className="widget__head">
        <DemoBadge>Demo on-ramp</DemoBadge>
      </div>
      <div className="fiat-input">
        <span>$</span>
        <input inputMode="decimal" value={usd} onChange={(e) => setUsd(sanitizeAmount(e.target.value, 2))} aria-label="Amount in US dollars" />
        <small>USD</small>
      </div>
      <div className="chips chips--center">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={value === p ? 'is-active' : undefined} onClick={() => setUsd(String(p))}>
            ${p}
          </button>
        ))}
      </div>
      <div className="field field--compact">
        <div className="field__row">
          <span className="field__label">You get ≈ {formatAmount(Math.max(0, receive))}</span>
          <TokenButton symbol={token} onClick={() => setPicker(true)} />
        </div>
      </div>
      <MethodList methods={PAY_METHODS} value={method} onChange={setMethod} label="Pay with" />
      <dl className="quote">
        <div>
          <dt>Provider fee</dt>
          <dd>{formatUsd(fee)}</dd>
        </div>
        <div>
          <dt>Arrives</dt>
          <dd>{m.eta}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="cta"
        disabled={value < 10 || pending}
        onClick={() => submit('Purchase started', `${formatUsd(value)} → ${formatAmount(receive)} ${token} via ${m.label.toLowerCase()}.`)}
      >
        {pending ? 'Opening provider…' : value < 10 ? 'Minimum $10' : `Buy ${token}`}
      </button>
      <TokenPicker open={picker} onClose={() => setPicker(false)} tokens={RAMP_TOKENS} onSelect={(t) => setToken(t.symbol)} />
    </section>
  );
}

/// Crypto → fiat off-ramp.
export function Sell() {
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [payout, setPayout] = useState('bank');
  const [picker, setPicker] = useState(false);
  const { pending, submit } = useDemoSubmit();

  const value = Number(amount) || 0;
  const balance = DEMO_HOLDINGS.find((h) => h.symbol === token)?.amount ?? 0;
  const p = PAYOUTS.find((x) => x.id === payout)!;
  const gross = value * tokenBySymbol(token).price;
  const fee = gross * p.fee;
  const insufficient = value > balance;

  return (
    <section className="widget" aria-label="Sell">
      <div className="widget__head">
        <DemoBadge>Demo off-ramp</DemoBadge>
      </div>
      <div className="field">
        <div className="field__top">
          <span>You sell</span>
          <button type="button" className="link" onClick={() => setAmount(String(balance))}>
            Balance {formatAmount(balance)} · Max
          </button>
        </div>
        <div className="field__row">
          <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, 8))} aria-label={`Amount of ${token} to sell`} />
          <TokenButton symbol={token} onClick={() => setPicker(true)} />
        </div>
        <div className="field__foot">{formatUsd(gross)}</div>
      </div>
      <MethodList methods={PAYOUTS} value={payout} onChange={setPayout} label="Receive to" />
      <dl className="quote">
        <div>
          <dt>You receive</dt>
          <dd>{formatUsd(Math.max(0, gross - fee))}</dd>
        </div>
        <div>
          <dt>Provider fee</dt>
          <dd>{formatUsd(fee)}</dd>
        </div>
        <div>
          <dt>Arrives</dt>
          <dd>{p.eta}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="cta"
        disabled={!value || insufficient || pending}
        onClick={() => submit('Sale started', `${formatAmount(value)} ${token} → ${formatUsd(gross - fee)} to your ${p.label.toLowerCase()}.`, () => setAmount(''))}
      >
        {pending ? 'Confirm in wallet…' : !value ? 'Enter an amount' : insufficient ? `Insufficient ${token} balance` : `Sell ${token}`}
      </button>
      <TokenPicker open={picker} onClose={() => setPicker(false)} tokens={RAMP_TOKENS} onSelect={(t) => setToken(t.symbol)} />
    </section>
  );
}
