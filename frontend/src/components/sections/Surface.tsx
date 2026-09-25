import { BRAND } from '../../config/site';
import { Kicker } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines, TextScramble } from '../TextScramble';

const COLUMNS = [
  {
    layer: 'VAULT LAYER',
    title: 'Rewards in the asset you deposited.',
    body: 'Flexible and locked tiers with reward weights. Early exits keep principal; only unclaimed rewards can be reduced.',
  },
  {
    layer: 'CREDIT LAYER',
    title: 'Borrow without unstaking.',
    body: 'Cross-asset loans backed by active positions. Repay and liquidation stay open even when borrowing is paused.',
  },
  {
    layer: 'REVENUE LAYER',
    title: 'Settled in public.',
    body: 'Interest is reserved, never lent out again, then anyone can trigger settlement to stakers, treasury and reserves.',
  },
  {
    layer: 'SAFETY LAYER',
    title: 'A backstop, not a promise.',
    body: 'Validated oracle prices, bounded risk parameters and an insurance fund that covers deficits with real tokens.',
  },
];

export function Surface() {
  return (
    <section className="surface ink" data-header-theme="dark">
      <Reveal className="section-head">
        <Kicker>PRODUCT SURFACE</Kicker>
        <h2>
          <ScrambleLines lines={['Designed for savers,', ['borrowers\u00a0', { em: 'and builders.' }]]} />
        </h2>
      </Reveal>
      <Reveal className="surface__grid" stagger={0.1}>
        {COLUMNS.map((col) => (
          <article key={col.layer}>
            <span>
              <TextScramble text={col.layer} />
            </span>
            <h3>
              <TextScramble text={col.title} speed={30} />
            </h3>
            <p>{col.body}</p>
          </article>
        ))}
      </Reveal>
      <p className="surface__note">
        {BRAND.name} runs on testnet. Contracts, oracle and governance are not production-ready until audit, timelocked
        multisig control and a production price feed are in place.
      </p>
    </section>
  );
}
