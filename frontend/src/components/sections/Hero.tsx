import { motion } from 'framer-motion';
import { BRAND, LINKS } from '../../config/site';
import { GlyphField } from '../GlyphField';
import { PillButton } from '../PillButton';
import { TextScramble } from '../TextScramble';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="hero" id="top" data-header-theme="dark">
      <div className="hero__card">
        <GlyphField />
        <div className="hero__glow" aria-hidden="true" />

        <div className="hero__content">
          <motion.p
            className="hero__kicker"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <TextScramble text={`STABLECOIN YIELD · CROSS-ASSET CREDIT · ${BRAND.network.toUpperCase()}`} speed={30} />
          </motion.p>

          <h1 className="hero__title">
            <motion.span
              className="hero__line"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <TextScramble text="One balance." delay={150} speed={70} />
            </motion.span>
            <motion.span
              className="hero__line hero__line--serif"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            >
              <TextScramble text="Always working." delay={420} speed={70} />
            </motion.span>
          </h1>

          <motion.p
            className="hero__body"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          >
            {BRAND.name} lets you stake USDC or EURC, earn funded rewards, and borrow against the same position —
            without putting your capital to sleep.
          </motion.p>

          <motion.div
            className="hero__actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: EASE }}
          >
            <PillButton onClick={onLaunch}>Launch app</PillButton>
            <PillButton variant="ghost" href={LINKS.docs}>
              Read docs
            </PillButton>
          </motion.div>
        </div>

        <div className="hero__footer" aria-hidden="true">
          <span>01 — STAKE</span>
          <span>02 — BORROW</span>
          <span>03 — EARN</span>
          <span className="hero__scroll">SCROLL ↓</span>
        </div>
      </div>
    </section>
  );
}
