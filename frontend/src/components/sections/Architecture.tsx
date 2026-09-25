import { BRAND, RISK_PARAMS, REVENUE_SPLIT } from '../../config/site';
import { Coins, Gauge, Layers, Shield, Split } from '../Icons';
import { Kicker, PillButton } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines, TextScramble } from '../TextScramble';

const CHIPS = [
  { icon: <Layers />, label: 'Staking vault' },
  { icon: <Coins />, label: 'Lending pool' },
  { icon: <Gauge />, label: 'Oracle adapter' },
  { icon: <Split />, label: 'Revenue router' },
  { icon: <Shield />, label: 'Insurance fund' },
];

const pct = (value: number) => `${+(value * 100).toFixed(1)}%`;

function VaultRings() {
  return (
    <svg className="vault-rings" viewBox="0 0 320 320" aria-hidden="true">
      {[140, 112, 84, 56].map((r, i) => (
        <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="#9B5DE5" strokeOpacity={0.18 + i * 0.16} strokeDasharray={i % 2 ? '2 8' : undefined} />
      ))}
      <circle cx="160" cy="160" r="30" fill="#9B5DE5" fillOpacity="0.22" stroke="#B57DEE" />
      <text x="160" y="165" textAnchor="middle" fill="#F4F2F7" fontFamily="JetBrains Mono" fontSize="13">
        VAULT
      </text>
    </svg>
  );
}

export function Architecture() {
  return (
    <section className="architecture ink" id="protocol" data-header-theme="dark">
      <Reveal className="section-head section-head--split">
        <div>
          <h2>
            <ScrambleLines lines={['Built like a bank.', { em: 'Settled like a protocol.' }]} />
          </h2>
          <p>
            Custody, credit, pricing and revenue live in separate contracts, so each has one job and one reason to
            change. A bug in one cannot quietly drain the others.
          </p>
        </div>
        <PillButton variant="ghost" href="#risk">
          Architecture
        </PillButton>
      </Reveal>

      <Reveal className="bento bento--arch" stagger={0.1}>
        <article className="card card--tall card--mist">
          <Kicker>VAULT LAYER</Kicker>
          <VaultRings />
          <div>
            <h3>
              <TextScramble text="Positions, not pooled IOUs." />
            </h3>
            <p>Every stake is a position with its own tier, lock and reward checkpoint — seizable only by the pool, only when unsafe.</p>
          </div>
        </article>

        <article className="card card--mauve">
          <Kicker>LENDING LAYER</Kicker>
          <p className="card__statement">
            Borrow USDC against staked EURC, or EURC against USDC. Interest accrues per second and is paid interest-first.
          </p>
        </article>

        <article className="card card--stat">
          <span className="card__stat">
            <TextScramble text={pct(RISK_PARAMS.maxLtv)} speed={220} />
          </span>
          <p>Max loan-to-value</p>
          <small>Testnet default · hard-bounded in Solidity</small>
        </article>

        <article className="card card--deep">
          <Kicker>INTEGRATION SURFACE</Kicker>
          <div className="chip-rows">
            {[0, 1].map((row) => (
              <div key={row} className={`marquee marquee--chips${row ? ' marquee--reverse' : ''}`}>
                <div className="marquee__track">
                  {[...CHIPS, ...CHIPS, ...CHIPS].map((chip, index) => (
                    <span className="chip" key={`${chip.label}-${index}`} aria-hidden={index >= CHIPS.length}>
                      {chip.icon}
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card card--split">
          <Kicker>REVENUE LAYER</Kicker>
          <h3>
            <TextScramble text="Interest in, split out." />
          </h3>
          <div className="split-bar" role="img" aria-label={REVENUE_SPLIT.map((s) => `${s.label} ${s.share}%`).join(', ')}>
            {REVENUE_SPLIT.map((s) => (
              <span key={s.label} style={{ flexGrow: s.share }} />
            ))}
          </div>
          <ul className="split-legend">
            {REVENUE_SPLIT.map((s) => (
              <li key={s.label}>
                <i />
                {s.label}
                <b>{s.share}%</b>
              </li>
            ))}
          </ul>
          <small>{BRAND.name} testnet configuration</small>
        </article>
      </Reveal>
    </section>
  );
}
