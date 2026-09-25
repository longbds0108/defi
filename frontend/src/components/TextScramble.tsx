import { useEffect, useRef, useState, type CSSProperties } from 'react';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ$€#+*◆';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

// Pick a glyph of the same kind as the original so the scrambled line keeps
// roughly the same width and doesn't reflow mid-animation.
function randomGlyph(character: string) {
  const pool = /[a-z]/.test(character) ? LOWER : /[0-9]/.test(character) ? DIGITS : UPPER;
  return pool[Math.floor(Math.random() * pool.length)];
}
const REROLL_MS = 70; // how often unresolved glyphs change; slower reads calmer
const WINDOW = 5; // only this many glyphs ahead of the cursor scramble; the rest stay hidden

type TextScrambleProps = {
  text: string;
  className?: string;
  replayKey?: number;
  /** Extra wait before starting, e.g. to stagger heading lines. */
  delay?: number;
  /** Milliseconds per character; total duration is clamped to 550–1400ms. */
  speed?: number;
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/// Text resolves left-to-right from random glyphs the first time it scrolls
/// into view. Unresolved glyphs are tinted along a violet → blue gradient and
/// the character about to resolve glows. Screen readers get the final text.
export function TextScramble({ text, className = '', replayKey, delay = 0, speed = 28 }: TextScrambleProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [scramble, setScramble] = useState({ display: text, resolved: text.length, pending: true });

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScramble({ display: text, resolved: text.length, pending: false });
      return;
    }

    let animationFrame = 0;
    let startTimer = 0;
    const characters = Array.from(text);
    const randomize = (settled: number) =>
      characters
        .map((character, index) =>
          character === ' ' || index < settled ? character : randomGlyph(character),
        )
        .join('');

    const runScramble = () => {
      window.cancelAnimationFrame(animationFrame);
      const duration = Math.max(550, Math.min(1400, characters.length * speed));
      const startedAt = performance.now();
      let lastRoll = 0;
      let display = randomize(0);

      const update = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const settled = Math.floor(easeOut(progress) * characters.length);
        if (now - lastRoll >= REROLL_MS) {
          display = randomize(settled);
          lastRoll = now;
        } else {
          // Keep glyphs stable between rolls but still reveal settled letters.
          display = characters.slice(0, settled).join('') + Array.from(display).slice(settled).join('');
        }
        setScramble({ display, resolved: settled, pending: false });

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(update);
          return;
        }
        setScramble({ display: text, resolved: characters.length, pending: false });
      };

      animationFrame = window.requestAnimationFrame(update);
    };

    const start = () => {
      startTimer = window.setTimeout(runScramble, delay);
    };

    let observer: IntersectionObserver | null = null;
    if (replayKey !== undefined && replayKey > 0) {
      start();
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer?.disconnect();
          start();
        },
        { threshold: 0.35 },
      );
      observer.observe(element);
    }

    return () => {
      observer?.disconnect();
      window.clearTimeout(startTimer);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [replayKey, text, delay, speed]);

  const total = Math.max(1, text.length - 1);
  // Once resolved, show the real text node again: per-character spans lose
  // kerning and can wrap differently from the measured text.
  const done = !scramble.pending && scramble.resolved >= text.length;

  return (
    <span
      ref={rootRef}
      className={`text-scramble${scramble.pending ? ' is-pending' : ''}${done ? ' is-done' : ''} ${className}`}
      aria-label={text}
    >
      <span className="text-scramble__measure" aria-hidden="true">
        {text}
      </span>
      <span className="text-scramble__visual" aria-hidden="true">
        {Array.from(scramble.display).map((character, index) => {
          const unresolved = index >= scramble.resolved && character !== ' ';
          const edge = index === scramble.resolved && scramble.resolved < text.length;
          // Glyphs beyond the scramble window keep their space but stay invisible,
          // so the text types in behind a short band of noise instead of all at once.
          const ahead = index >= scramble.resolved + WINDOW;
          return (
            <span
              key={index}
              className={
                ahead
                  ? 'text-scramble__ahead'
                  : unresolved
                    ? `text-scramble__unresolved${edge ? ' text-scramble__edge' : ''}`
                    : undefined
              }
              style={unresolved ? ({ '--mix': `${Math.round((index / total) * 100)}%` } as CSSProperties) : undefined}
            >
              {character}
            </span>
          );
        })}
      </span>
    </span>
  );
}

type Segment = string | { em: string };
type Line = Segment | Segment[];

/// Scrambles each line of a multi-line heading, staggering the lines.
/// A line is a string, `{ em: '...' }` for the serif italic accent, or an
/// array of both to mix styles on one line.
export function ScrambleLines({ lines, stagger = 140 }: { lines: Line[]; stagger?: number }) {
  return (
    <>
      {lines.map((line, index) => {
        const segments = Array.isArray(line) ? line : [line];
        return (
          <span key={index}>
            {index > 0 && <br />}
            {segments.map((segment, part) => {
              const text = typeof segment === 'string' ? segment : segment.em;
              const node = <TextScramble text={text} delay={index * stagger + part * 80} />;
              return typeof segment === 'string' ? (
                <span key={part}>{node}</span>
              ) : (
                <em key={part}>{node}</em>
              );
            })}
          </span>
        );
      })}
    </>
  );
}
