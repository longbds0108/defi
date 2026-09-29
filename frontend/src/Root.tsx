import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { BRAND } from './config/site';

// Landing and app are code-split so each only loads its own bundle and CSS.
const Landing = lazy(() => import('./Landing'));
const DappApp = lazy(() => import('./dapp/DappApp'));

/** On app.<domain> the dapp is served at the root; everywhere else it lives under /app. */
export const IS_APP_HOST = window.location.hostname.startsWith('app.');
export const APP_BASE = IS_APP_HOST ? '' : '/app';

/** Where "Launch app" goes. Set VITE_APP_URL=https://app.<domain> in production. */
const APP_URL: string = import.meta.env.VITE_APP_URL || '/app';

type CurtainContextValue = { launchApp: () => void };
const CurtainContext = createContext<CurtainContextValue>({ launchApp: () => undefined });
export const useLaunchApp = () => useContext(CurtainContext).launchApp;

/// Root keeps the route curtain above the router so it survives the switch
/// from landing to app: columns cover the page, the route changes underneath,
/// then the columns sweep away.
export function Root() {
  const navigate = useNavigate();
  const [curtain, setCurtain] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const launchApp = useCallback(() => {
    if (curtain) return;
    timers.current.forEach((t) => window.clearTimeout(t));
    setCurtain(true);
    timers.current = [
      window.setTimeout(() => {
        if (/^https?:\/\//.test(APP_URL)) window.location.href = APP_URL;
        else {
          navigate(APP_URL);
          window.scrollTo(0, 0);
        }
      }, 560),
      window.setTimeout(() => setCurtain(false), 1_350),
    ];
  }, [curtain, navigate]);

  return (
    <CurtainContext.Provider value={{ launchApp }}>
      <Suspense fallback={<div className="boot-screen" aria-busy="true" />}>
        {IS_APP_HOST ? (
          <DappApp />
        ) : (
          <Routes>
            <Route path="/app/*" element={<DappApp />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        )}
      </Suspense>

      <div className={`route-curtain${curtain ? ' route-curtain--active' : ''}`} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} style={{ '--curtain-index': index } as CSSProperties} />
        ))}
        <span>{BRAND.wordmark} / ENTERING PROTOCOL</span>
      </div>
    </CurtainContext.Provider>
  );
}
