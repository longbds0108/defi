import { BRAND, LINKS } from '../../config/site';
import { Book } from '../Icons';
import { FooterAsciiField } from '../FooterAsciiField';
import { PillButton } from '../PillButton';
import { Reveal } from '../Reveal';
import { ScrambleLines } from '../TextScramble';

function CapitalMap() {
  // A signal dot travels asset → vault → utility, fading violet into blue.
  return (
    <div className="capital-map" aria-hidden="true">
      <div className="capital-map__heading">
        <span>CAPITAL IN MOTION</span>
        <span>{BRAND.network.toUpperCase()}</span>
      </div>
      <div className="capital-map__rail">
        <div className="capital-node capital-node--asset">
          <i />
          <strong>USDC / EURC</strong>
          <small>DEPOSIT</small>
        </div>
        <div className="capital-node capital-node--vault">
          <i>L</i>
          <strong>{BRAND.wordmark} VAULT</strong>
          <small>POSITION</small>
        </div>
        <div className="capital-node capital-node--utility">
          <i />
          <strong>STAKE / BORROW</strong>
          <small>KEEP EARNING</small>
        </div>
      </div>
    </div>
  );
}

export function Closing({ onLaunch }: { onLaunch: () => void }) {
  const links = [
    { label: 'App', href: '#top' },
    { label: 'Docs', href: LINKS.docs },
    { label: 'GitHub', href: LINKS.github },
    { label: 'X', href: LINKS.x },
    { label: 'Discord', href: LINKS.discord },
  ];

  return (
    <div className="footer-reveal">
      <section className="final-cta paper" data-header-theme="light">
        <CapitalMap />
        <Reveal className="final-cta__inner">
          <h2>
            <ScrambleLines lines={['Put your stablecoins to work,', { em: 'without putting them to sleep.' }]} />
          </h2>
          <p>Launch the testnet app, read the protocol spec, or follow along as {BRAND.name} moves toward audit.</p>
          <div className="final-cta__actions">
            <PillButton variant="dark" onClick={onLaunch}>
              Start staking
            </PillButton>
            <PillButton variant="outline" icon={<Book />} href={LINKS.docs}>
              Protocol docs
            </PillButton>
          </div>
        </Reveal>
      </section>

      <footer className="site-footer ink" id="docs" data-header-theme="dark">
        <div className="site-footer__top">
          <div>
            <p className="site-footer__name">{BRAND.wordmark}</p>
            <p>{BRAND.tagline}</p>
          </div>
          <nav aria-label="Footer">
            {links.map((link) => (
              <a key={link.label} href={link.href} {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                {link.label} ↗
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer__stage">
          <FooterAsciiField />
          <div className="site-footer__wordmark" aria-hidden="true">
            {BRAND.wordmark}
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} {BRAND.wordmark}</span>
          <span>BUILT ON {BRAND.network.toUpperCase()}</span>
          <span>TESTNET TOKENS HAVE NO VALUE</span>
        </div>
      </footer>
    </div>
  );
}
