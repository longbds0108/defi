import { BRAND } from '../../config/site';
import { Coins, Gauge, Split } from '../Icons';
import { Kicker } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines, TextScramble } from '../TextScramble';

const STEPS = [
  {
    icon: <Coins width={20} height={20} />,
    title: 'Stake',
    body: 'Deposit USDC or EURC into a vault tier. Your position starts earning from the next block.',
  },
  {
    icon: <Gauge width={20} height={20} />,
    title: 'Borrow',
    body: 'Draw the other stablecoin against your staked value, up to 75% LTV, with a live Health Factor preview.',
  },
  {
    icon: <Split width={20} height={20} />,
    title: 'Earn',
    body: 'Borrower interest is settled on-chain and split back to stakers. Claim whenever you like.',
  },
];

export function HowItWorks() {
  return (
    <section className="how ink" data-header-theme="dark">
      <Reveal className="how__copy">
        <Kicker>HOW IT WORKS</Kicker>
        <h2>
          <ScrambleLines lines={['Three steps.', 'One productive', 'balance.']} />
        </h2>
        <p>
          {BRAND.name} is not another yield screen. Staking, credit and revenue are wired together so the same dollar
          can earn and borrow at once — with the risk shown plainly.
        </p>
      </Reveal>

      <Reveal className="how__cards" stagger={0.12}>
        {STEPS.map((step, index) => (
          <article key={step.title} className="step-card">
            <span className="step-card__icon">{step.icon}</span>
            <span className="step-card__index">0{index + 1}</span>
            <h3>
              <TextScramble text={step.title} delay={index * 120} speed={90} />
            </h3>
            <p>{step.body}</p>
          </article>
        ))}
      </Reveal>
    </section>
  );
}
