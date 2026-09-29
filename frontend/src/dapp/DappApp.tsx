import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { ChainProvider } from './state/chain';
import { AppHeader } from './components/AppHeader';
import { ToastProvider, appPath } from './components/ui';
import { Connect } from './pages/Connect';
import { TradeLayout } from './pages/trade/TradeLayout';
import { Swap } from './pages/trade/Swap';
import { Bridge } from './pages/trade/Bridge';
import { Buy, Sell } from './pages/trade/Ramp';
import { ExploreLayout, ExploreTokens, ExploreTransactions } from './pages/explore/Explore';
import { Launches } from './pages/Launches';
import { PoolLayout } from './pages/pool/PoolLayout';
import { CreatePosition } from './pages/pool/CreatePosition';
import { LaunchAuction } from './pages/pool/LaunchAuction';
import { PortfolioLayout, PortfolioActivity, PortfolioOverview, PortfolioTokens } from './pages/portfolio/Portfolio';
import './dapp.css';

/// While the connect flow is being finished, pages are browsable without a
/// session. Flip this to true to send unauthenticated visits to /connect.
const REQUIRE_CONNECT = false;

function RequireAuth() {
  const { ready, connected } = useAuth();
  const location = useLocation();
  if (!REQUIRE_CONNECT) return <Outlet />;
  if (!ready) return <div className="app-loading" aria-busy="true" />;
  if (!connected) return <Navigate to={appPath('/connect')} replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function PageTransition() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

export default function DappApp() {
  return (
    <AuthProvider>
      <ChainProvider>
      <ToastProvider>
        <div className="dapp">
          <AppHeader />
          <main className="dapp__main">
            <Routes>
              <Route path="connect" element={<Connect />} />
              <Route element={<RequireAuth />}>
                <Route element={<PageTransition />}>
                  <Route index element={<Navigate to={appPath('/trade/swap')} replace />} />
                  <Route path="trade" element={<TradeLayout />}>
                    <Route index element={<Navigate to={appPath('/trade/swap')} replace />} />
                    <Route path="swap" element={<Swap />} />
                    <Route path="bridge" element={<Bridge />} />
                    <Route path="buy" element={<Buy />} />
                    <Route path="sell" element={<Sell />} />
                  </Route>
                  <Route path="explore" element={<ExploreLayout />}>
                    <Route index element={<Navigate to={appPath('/explore/tokens')} replace />} />
                    <Route path="tokens" element={<ExploreTokens />} />
                    <Route path="transactions" element={<ExploreTransactions />} />
                  </Route>
                  <Route path="launches" element={<Launches />} />
                  <Route path="pool" element={<PoolLayout />}>
                    <Route index element={<Navigate to={appPath('/pool/create')} replace />} />
                    <Route path="create" element={<CreatePosition />} />
                    <Route path="auction" element={<LaunchAuction />} />
                  </Route>
                  <Route path="portfolio" element={<PortfolioLayout />}>
                    <Route index element={<Navigate to={appPath('/portfolio/overview')} replace />} />
                    <Route path="overview" element={<PortfolioOverview />} />
                    <Route path="tokens" element={<PortfolioTokens />} />
                    <Route path="activity" element={<PortfolioActivity />} />
                  </Route>
                  <Route path="*" element={<Navigate to={appPath('/trade/swap')} replace />} />
                </Route>
              </Route>
            </Routes>
          </main>
        </div>
      </ToastProvider>
      </ChainProvider>
    </AuthProvider>
  );
}
