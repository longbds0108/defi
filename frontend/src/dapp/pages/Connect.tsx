import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../../config/site';
import { GlyphField } from '../../components/GlyphField';
import { TextScramble } from '../../components/TextScramble';
import { useAuth } from '../auth/AuthProvider';
import { appPath } from '../components/ui';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Z" />
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

/// Gate shown when the user opens the app without a session:
/// "Connect Google" (Privy embedded wallet) or "Connect wallet".
export function Connect() {
  const { connected, ready, googleEnabled, loginWithGoogle, connectWallet, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  useEffect(() => {
    if (connected) navigate(from ?? appPath('/trade/swap'), { replace: true });
  }, [connected, from, navigate]);

  return (
    <div className="connect">
      <GlyphField />
      <motion.div
        className="connect__card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="page-header__kicker">
          <TextScramble text={`WELCOME TO ${BRAND.wordmark}`} />
        </p>
        <h1>
          Connect to <em>start trading.</em>
        </h1>
        <p className="connect__lede">Swap, bridge, provide liquidity and join launches from one account.</p>

        <div className="connect__options">
          <button type="button" className="connect-option" onClick={loginWithGoogle} disabled={!ready || !googleEnabled}>
            <span className="connect-option__icon connect-option__icon--google">
              <GoogleIcon />
            </span>
            <span>
              <strong>Continue with Google</strong>
              <small>{googleEnabled ? 'We create a secure wallet for you — no seed phrase' : 'Needs a Privy app ID (VITE_PRIVY_APP_ID)'}</small>
            </span>
            <span className="connect-option__arrow">→</span>
          </button>

          <div className="connect__divider">
            <span>or</span>
          </div>

          <button type="button" className="connect-option" onClick={connectWallet} disabled={!ready}>
            <span className="connect-option__icon">
              <WalletIcon />
            </span>
            <span>
              <strong>Connect wallet</strong>
              <small>MetaMask, Rabby, Coinbase Wallet{googleEnabled ? ', WalletConnect' : ' or any browser wallet'}</small>
            </span>
            <span className="connect-option__arrow">→</span>
          </button>
        </div>

        {error && <p className="connect__error">{error}</p>}
        <p className="connect__legal">
          By connecting you agree to the Terms. {BRAND.name} runs on {BRAND.network}; tokens have no real value.
        </p>
      </motion.div>
    </div>
  );
}
