import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DEMO_HOLDINGS, tokenBySymbol } from '../../data/demo';
import { formatAmount, formatPct, formatUsd, sanitizeAmount } from '../../lib/format';
import { DemoBadge, Modal, TokenButton, TokenPicker, useDemoSubmit } from '../../components/ui';

const SLIPPAGES = [0.1, 0.5, 1];
const demoBalance = (symbol: string) => DEMO_HOLDINGS.find((h) => h.symbol === symbol)?.amount ?? 0;

export function Swap() {
  const [from, setFrom] = useState('USDC');
  const [to, setTo] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'from' | 'to' | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [settings, setSettings] = useState(false);
  const [review, setReview] = useState(false);
  const { pending, submit } = useDemoSubmit();

  const tokenIn = tokenBySymbol(from);
  const tokenOut = tokenBySymbol(to);
  const amountIn = Number(amount) || 0;
  const balance = demoBalance(from);

  // Demo quote: mid price, 0.3% LP fee, price impact growing with trade size.
  const quote = useMemo(() => {
    const valueUsd = amountIn * tokenIn.price;
    const impact = Math.min(0.12, valueUsd / 4_000_000);
    const fee = 0.003;
    const out = (valueUsd * (1 - fee) * (1 - impact)) / tokenOut.price;
    return {
      out,
      valueUsd,
      impact,
      feeUsd: valueUsd * fee,
      minReceived: out * (1 - slippage / 100),
      rate: tokenIn.price / tokenOut.price,
      gasUsd: 0.02,
    };
  }, [amountIn, tokenIn, tokenOut, slippage]);

  const insufficient = amountIn > balance;
  const cta = !amountIn ? 'Enter an amount' : insufficient ? `Insufficient ${from} balance` : 'Review swap';

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount(quote.out ? String(Number(quote.out.toFixed(6))) : '');
  };

  return (
    <section className="widget" aria-label="Swap">
      <div className="widget__head">
        <DemoBadge>Demo quote</DemoBadge>
        <button type="button" className="icon-btn" aria-label="Swap settings" onClick={() => setSettings(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
          </svg>
        </button>
      </div>

      <div className="field">
        <div className="field__top">
          <span>You pay</span>
          <button type="button" className="link" onClick={() => setAmount(String(balance))}>
            Balance {formatAmount(balance)} · Max
          </button>
        </div>
        <div className="field__row">
          <input
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value, 8))}
            aria-label={`Amount of ${from} to pay`}
          />
          <TokenButton symbol={from} onClick={() => setPicker('from')} />
        </div>
        <div className="field__foot">{formatUsd(quote.valueUsd)}</div>
      </div>

      <motion.button type="button" className="flip" aria-label="Switch tokens" onClick={flip} whileTap={{ rotate: 180 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </motion.button>

      <div className="field">
        <div className="field__top">
          <span>You receive</span>
          <span>Balance {formatAmount(demoBalance(to))}</span>
        </div>
        <div className="field__row">
          <input readOnly placeholder="0" value={amountIn ? formatAmount(quote.out) : ''} aria-label={`Estimated ${to} received`} />
          <TokenButton symbol={to} onClick={() => setPicker('to')} />
        </div>
        <div className="field__foot">
          {formatUsd(quote.out * tokenOut.price)}
          {quote.impact > 0.001 && <span className={quote.impact > 0.03 ? 'down' : undefined}> · impact {formatPct(-quote.impact * 100)}</span>}
        </div>
      </div>

      {amountIn > 0 && (
        <dl className="quote">
          <div>
            <dt>Rate</dt>
            <dd>
              1 {from} = {formatAmount(quote.rate)} {to}
            </dd>
          </div>
          <div>
            <dt>Minimum received</dt>
            <dd>
              {formatAmount(quote.minReceived)} {to}
            </dd>
          </div>
          <div>
            <dt>LP fee (0.3%)</dt>
            <dd>{formatUsd(quote.feeUsd)}</dd>
          </div>
          <div>
            <dt>Network fee</dt>
            <dd>~{formatUsd(quote.gasUsd)}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>
              {from} → {from === 'USDC' || to === 'USDC' ? '' : 'USDC → '}
              {to}
            </dd>
          </div>
        </dl>
      )}

      <button type="button" className="cta" disabled={!amountIn || insufficient} onClick={() => setReview(true)}>
        {cta}
      </button>

      <TokenPicker open={picker === 'from'} onClose={() => setPicker(null)} exclude={to} onSelect={(t) => setFrom(t.symbol)} />
      <TokenPicker open={picker === 'to'} onClose={() => setPicker(null)} exclude={from} onSelect={(t) => setTo(t.symbol)} />

      <Modal open={settings} onClose={() => setSettings(false)} title="Settings">
        <p className="modal__label">Max slippage</p>
        <div className="chips">
          {SLIPPAGES.map((value) => (
            <button key={value} type="button" className={slippage === value ? 'is-active' : undefined} onClick={() => setSlippage(value)}>
              {value}%
            </button>
          ))}
        </div>
        <p className="modal__hint">Your transaction reverts if the price moves unfavourably by more than this.</p>
      </Modal>

      <Modal open={review} onClose={() => setReview(false)} title="Review swap">
        <div className="review">
          <div>
            <small>You pay</small>
            <strong>
              {formatAmount(amountIn)} {from}
            </strong>
            <span>{formatUsd(quote.valueUsd)}</span>
          </div>
          <div>
            <small>You receive (est.)</small>
            <strong>
              {formatAmount(quote.out)} {to}
            </strong>
            <span>min {formatAmount(quote.minReceived)} {to}</span>
          </div>
        </div>
        <button
          type="button"
          className="cta"
          disabled={pending}
          onClick={() => {
            submit('Swap submitted', `${formatAmount(amountIn)} ${from} → ${formatAmount(quote.out)} ${to}.`, () => {
              setReview(false);
              setAmount('');
            });
          }}
        >
          {pending ? 'Confirm in wallet…' : 'Confirm swap'}
        </button>
      </Modal>
    </section>
  );
}
