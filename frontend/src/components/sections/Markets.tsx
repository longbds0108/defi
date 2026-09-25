import { motion } from 'framer-motion';
import { BRAND, RISK_PARAMS } from '../../config/site';
import usdcLogo from '../../assets/usdc-logo.png';
import eurcLogo from '../../assets/eurc-logo.png';
import { Kicker } from '../PillButton';
import { ScrambleLines, TextScramble } from '../TextScramble';

const MARKETS = [
  { symbol: 'USDC', name: 'US Dollar Coin', logo: usdcLogo, borrowApr: RISK_PARAMS.borrowAprUsdc, tone: 'violet' },
  { symbol: 'EURC', name: 'Euro Coin', logo: eurcLogo, borrowApr: RISK_PARAMS.borrowAprEurc, tone: 'blue' },
] as const;

const TIERS = ['FLEXIBLE', 'GROWTH / 6M', 'DIAMOND / 12M'];

/// Shiny-style market showcase: a sticky headline rail on the left while tall
/// market cards scroll past on the right.
export function Markets() {
  return (
    <section className="markets ink" id="markets" data-header-theme="dark">
      <div className="markets__rail">
        <Kicker>{`MARKETS · ${BRAND.network.toUpperCase()}`}</Kicker>
        <h2>
          <ScrambleLines lines={['Two markets.', 'One productive', { em: 'balance.' }]} />
        </h2>
        <p>Vault tiers and borrow rates below are the testnet configuration. Live values are read from the deployed contracts inside the app.</p>
      </div>

      <div className="markets__cards">
        {MARKETS.map((market, index) => (
          <motion.article
            key={market.symbol}
            className={`market-card market-card--${market.tone}`}
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: index * 0.08 }}
          >
            <div className="market-card__top">
              <span>0{index + 1}</span>
              <span className="market-card__status">
                <i /> {BRAND.network.toUpperCase()}
              </span>
            </div>

            <div className="market-card__identity">
              <img src={market.logo} alt="" />
              <div>
                <h3>
                  <TextScramble text={market.symbol} />
                </h3>
                <p>{market.name}</p>
              </div>
            </div>

            <div className="market-card__rates">
              {TIERS.map((tier) => (
                <div key={tier}>
                  <span>{tier}</span>
                  <strong>Revenue-based</strong>
                </div>
              ))}
              <div>
                <span>BORROW APR</span>
                <strong>
                  <TextScramble text={`${(market.borrowApr * 100).toFixed(0)}%`} />
                </strong>
              </div>
            </div>
            <p className="market-card__footnote">REWARDS · FUNDED BY SETTLED BORROW INTEREST · TESTNET DEFAULTS</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
