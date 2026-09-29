import { useState } from 'react';
import { DEMO_HOLDINGS, NETWORKS, tokenBySymbol, type Network } from '../../data/demo';
import { formatAmount, formatUsd, sanitizeAmount, shortAddress } from '../../lib/format';
import { useAuth } from '../../auth/AuthProvider';
import { DemoBadge, Modal, TokenButton, TokenPicker, useDemoSubmit } from '../../components/ui';

const BRIDGEABLE = ['USDC', 'EURC', 'ETH', 'WBTC'];

function NetworkButton({ network, onClick, label }: { network: Network; onClick: () => void; label: string }) {
  return (
    <button type="button" className="network-button" onClick={onClick} aria-label={`${label}: ${network.name}`}>
      <span className="network-dot" style={{ background: network.color }} aria-hidden="true">
        {network.short.slice(0, 1)}
      </span>
      <span>
        <small>{label}</small>
        <strong>{network.name}</strong>
      </span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

export function Bridge() {
  const { address } = useAuth();
  const [fromNet, setFromNet] = useState(NETWORKS[1]);
  const [toNet, setToNet] = useState(NETWORKS[0]);
  const [token, setToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [picker, setPicker] = useState<'token' | 'from' | 'to' | null>(null);
  const { pending, submit } = useDemoSubmit();

  const value = Number(amount) || 0;
  const t = tokenBySymbol(token);
  const bridgeFee = value * t.price * 0.0005; // 5 bps protocol fee (demo)
  const networkFee = fromNet.feeUsd + toNet.feeUsd * 0.2;
  const receive = Math.max(0, value - bridgeFee / t.price);
  const eta = Math.max(fromNet.etaMinutes, toNet.etaMinutes);
  const balance = DEMO_HOLDINGS.find((h) => h.symbol === token)?.amount ?? 0;
  const insufficient = value > balance;

  const pickNetwork = (network: Network) => {
    if (picker === 'from') {
      if (network.id === toNet.id) setToNet(fromNet);
      setFromNet(network);
    } else {
      if (network.id === fromNet.id) setFromNet(toNet);
      setToNet(network);
    }
    setPicker(null);
  };

  return (
    <section className="widget" aria-label="Bridge">
      <div className="widget__head">
        <DemoBadge>Demo route</DemoBadge>
      </div>

      <div className="bridge-nets">
        <NetworkButton label="From" network={fromNet} onClick={() => setPicker('from')} />
        <button
          type="button"
          className="flip flip--inline"
          aria-label="Switch networks"
          onClick={() => {
            setFromNet(toNet);
            setToNet(fromNet);
          }}
        >
          ⇄
        </button>
        <NetworkButton label="To" network={toNet} onClick={() => setPicker('to')} />
      </div>

      <div className="field">
        <div className="field__top">
          <span>Amount</span>
          <button type="button" className="link" onClick={() => setAmount(String(balance))}>
            Balance {formatAmount(balance)} · Max
          </button>
        </div>
        <div className="field__row">
          <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, 8))} aria-label="Amount to bridge" />
          <TokenButton symbol={token} onClick={() => setPicker('token')} />
        </div>
        <div className="field__foot">{formatUsd(value * t.price)}</div>
      </div>

      <dl className="quote">
        <div>
          <dt>You receive on {toNet.short}</dt>
          <dd>
            {formatAmount(receive)} {token}
          </dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd>{address ? `${shortAddress(address)} (you)` : 'Your connected wallet'}</dd>
        </div>
        <div>
          <dt>Bridge fee (0.05%)</dt>
          <dd>{formatUsd(bridgeFee)}</dd>
        </div>
        <div>
          <dt>Network fees</dt>
          <dd>~{formatUsd(networkFee)}</dd>
        </div>
        <div>
          <dt>Estimated time</dt>
          <dd>~{eta} min</dd>
        </div>
      </dl>

      <button
        type="button"
        className="cta"
        disabled={!value || insufficient || pending}
        onClick={() => submit('Bridge started', `${formatAmount(value)} ${token} from ${fromNet.name} to ${toNet.name}, arriving in ~${eta} min.`, () => setAmount(''))}
      >
        {pending ? 'Confirm in wallet…' : !value ? 'Enter an amount' : insufficient ? `Insufficient ${token} balance` : `Bridge to ${toNet.name}`}
      </button>

      <TokenPicker open={picker === 'token'} onClose={() => setPicker(null)} tokens={BRIDGEABLE.map(tokenBySymbol)} onSelect={(tk) => setToken(tk.symbol)} />
      <Modal open={picker === 'from' || picker === 'to'} onClose={() => setPicker(null)} title={picker === 'from' ? 'Bridge from' : 'Bridge to'}>
        <ul className="token-list">
          {NETWORKS.map((network) => (
            <li key={network.id}>
              <button type="button" onClick={() => pickNetwork(network)}>
                <span className="network-dot network-dot--lg" style={{ background: network.color }} aria-hidden="true">
                  {network.short.slice(0, 1)}
                </span>
                <span>
                  <strong>{network.name}</strong>
                  <small>~{network.etaMinutes} min · ~{formatUsd(network.feeUsd)} gas</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </section>
  );
}
