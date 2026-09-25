import { BRAND, STACK } from '../../config/site';
import { PillButton } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines, TextScramble } from '../TextScramble';

function CoinStack() {
  // Layered coins drawn as SVG so the lavender card has an illustration
  // without shipping raster assets.
  const coins = [
    { y: 150, fill: '#2A1F3D' },
    { y: 128, fill: '#34264C' },
    { y: 106, fill: '#3F2E5C' },
  ];
  return (
    <svg className="coin-stack" viewBox="0 0 260 240" aria-hidden="true">
      <defs>
        <linearGradient id="coin-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B57DEE" />
          <stop offset="1" stopColor="#6B3FC4" />
        </linearGradient>
      </defs>
      {coins.map((coin) => (
        <g key={coin.y}>
          <ellipse cx="130" cy={coin.y + 14} rx="96" ry="30" fill="#1B1428" />
          <rect x="34" y={coin.y} width="192" height="14" fill={coin.fill} />
          <ellipse cx="130" cy={coin.y} rx="96" ry="30" fill={coin.fill} />
        </g>
      ))}
      <ellipse cx="130" cy="84" rx="96" ry="30" fill="#1B1428" />
      <rect x="34" y="70" width="192" height="14" fill="#4A3570" />
      <ellipse cx="130" cy="70" rx="96" ry="30" fill="url(#coin-face)" />
      <ellipse cx="130" cy="70" rx="70" ry="21" fill="none" stroke="#E9DDFB" strokeOpacity="0.55" strokeWidth="2" />
      <path d="M112 84 148 56" stroke="#F4F2F7" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function Meet() {
  return (
    <section className="meet paper" id="overview" data-header-theme="light">
      <Reveal className="meet__intro">
        <div>
          <p className="eyebrow">Stablecoin credit, simplified</p>
          <h2>
            <ScrambleLines lines={[`Meet ${BRAND.name}.`]} />
          </h2>
          <PillButton variant="dark" href="#markets">
            Discover it
          </PillButton>
        </div>
        <p className="meet__statement">
          {BRAND.name} turns idle stablecoins into a single productive balance: vault rewards, cross-asset borrowing
          and a Health Factor you can actually read.
        </p>
      </Reveal>

      <Reveal className="bento bento--meet" stagger={0.12}>
        <article className="card card--lavender">
          <h3>
            <TextScramble text="A position that earns while it backs your loan" speed={30} />
          </h3>
          <CoinStack />
          <p>Stake USDC or EURC in a vault tier, then borrow the other asset against it. No unstaking, no idle time.</p>
        </article>
        <article className="card card--violet">
          <h3>
            <ScrambleLines lines={['Two markets,', 'one balance.']} />
          </h3>
          <p>USDC and EURC vaults with Flexible and locked tiers. Longer locks carry a higher reward weight.</p>
        </article>
        <article className="card card--violet card--violet-alt">
          <h3>
            <ScrambleLines lines={['Yield from', 'real interest.']} />
          </h3>
          <p>Rewards come from borrower interest that is reserved, settled on-chain, and split transparently.</p>
        </article>
      </Reveal>

      <div className="stack-strip">
        <p>Built on open, battle-tested tooling across the contract and app layers.</p>
        <div className="marquee" aria-label={`Built with ${STACK.join(', ')}`}>
          <div className="marquee__track">
            {[...STACK, ...STACK].map((name, index) => (
              <span key={`${name}-${index}`} aria-hidden={index >= STACK.length}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
