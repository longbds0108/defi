import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LAUNCHES, type Launch, type LaunchStatus } from '../data/demo';
import { formatDuration, formatPrice, formatUsd, sanitizeAmount } from '../lib/format';
import { DemoBadge, Modal, PageHeader, Segmented, TokenMark, appPath, useDemoSubmit } from '../components/ui';

const FILTERS: Array<{ value: 'all' | LaunchStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
];

function LaunchCard({ launch, onJoin }: { launch: Launch; onJoin: () => void }) {
  const progress = launch.target ? Math.min(1, launch.raised / launch.target) : 0;
  return (
    <motion.article
      className={`launch-card launch-card--${launch.status}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ '--launch-color': launch.color } as React.CSSProperties}
    >
      <div className="launch-card__top">
        <TokenMark symbol={launch.symbol} size={44} color={launch.color} />
        <span className={`status status--${launch.status}`}>
          <i aria-hidden="true" />
          {launch.status === 'live' ? 'Live' : launch.status === 'upcoming' ? 'Upcoming' : 'Ended'}
        </span>
      </div>
      <h3>
        {launch.name} <small>${launch.symbol}</small>
      </h3>
      <p>{launch.tagline}</p>
      <div className="launch-card__meta">
        <span>{launch.kind}</span>
        <span>{launch.status === 'ended' ? `${launch.participants.toLocaleString()} participants` : launch.status === 'live' ? `Ends in ${formatDuration(launch.hoursLeft)}` : `Starts in ${formatDuration(launch.hoursLeft)}`}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Raised">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <dl className="launch-card__stats">
        <div>
          <dt>Raised</dt>
          <dd>{formatUsd(launch.raised)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{formatUsd(launch.target)}</dd>
        </div>
        <div>
          <dt>{launch.kind === 'Dutch auction' ? 'Current price' : 'Price'}</dt>
          <dd>{formatPrice(launch.price)}</dd>
        </div>
      </dl>
      <button type="button" className={launch.status === 'live' ? 'cta cta--sm' : 'ghost-btn'} disabled={launch.status === 'ended'} onClick={onJoin}>
        {launch.status === 'live' ? 'Commit' : launch.status === 'upcoming' ? 'Remind me' : 'Sold out'}
      </button>
    </motion.article>
  );
}

export function Launches() {
  const [filter, setFilter] = useState<'all' | LaunchStatus>('all');
  const [active, setActive] = useState<Launch | null>(null);
  const [amount, setAmount] = useState('');
  const { pending, submit } = useDemoSubmit();
  const rows = LAUNCHES.filter((l) => filter === 'all' || l.status === filter);

  return (
    <div className="page">
      <PageHeader
        kicker="LAUNCHES"
        title={
          <>
            New tokens, <em>fair price discovery.</em>
          </>
        }
        actions={
          <>
            <DemoBadge />
            <Link className="ghost-btn" to={appPath('/pool/auction')}>
              Launch your token →
            </Link>
          </>
        }
      />
      <div className="panel__toolbar panel__toolbar--bare">
        <Segmented label="Launch status" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      <div className="launch-grid">
        {rows.map((launch) => (
          <LaunchCard
            key={launch.id}
            launch={launch}
            onJoin={() => {
              if (launch.status === 'upcoming') submit('Reminder set', `We’ll notify you when ${launch.name} opens.`);
              else setActive(launch);
            }}
          />
        ))}
      </div>

      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={active ? `Commit to ${active.name}` : 'Commit'}>
        {active && (
          <>
            <div className="field">
              <div className="field__top">
                <span>You commit</span>
                <span>USDC</span>
              </div>
              <div className="field__row">
                <input autoFocus inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, 2))} aria-label="USDC to commit" />
              </div>
              <div className="field__foot">
                ≈ {((Number(amount) || 0) / active.price).toLocaleString('en-US', { maximumFractionDigits: 0 })} {active.symbol} at {formatPrice(active.price)}
              </div>
            </div>
            <p className="modal__hint">
              {active.kind === 'Dutch auction'
                ? 'Price falls over time. Everyone pays the final clearing price; any difference is refunded.'
                : 'All commitments settle at one clearing price when the auction ends.'}
            </p>
            <button
              type="button"
              className="cta"
              disabled={!Number(amount) || pending}
              onClick={() =>
                submit('Commitment placed', `${formatUsd(Number(amount))} committed to ${active.name}.`, () => {
                  setActive(null);
                  setAmount('');
                })
              }
            >
              {pending ? 'Confirm in wallet…' : 'Commit USDC'}
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
