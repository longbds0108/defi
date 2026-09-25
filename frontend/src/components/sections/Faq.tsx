import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FAQ_ITEMS } from '../../config/site';
import { Plus } from '../Icons';
import { Reveal } from '../Reveal';
import { ScrambleLines, TextScramble } from '../TextScramble';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="faq paper" id="faq" data-header-theme="light">
      <Reveal className="faq__head">
        <p className="eyebrow">Questions</p>
        <h2>
          <ScrambleLines lines={['Before you', { em: 'stake.' }]} />
        </h2>
      </Reveal>

      <div className="faq__list">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q} className={`faq__item${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className="faq__index">0{index + 1}</span>
                <span className="faq__q">
                  <TextScramble text={item.q} />
                </span>
                <Plus className="faq__icon" width={18} height={18} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`faq-${index}`}
                    className="faq__answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
