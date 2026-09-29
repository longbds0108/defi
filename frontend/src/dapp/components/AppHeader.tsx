import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BRAND } from '../../config/site';
import { LogoMark } from '../../components/Icons';
import { useAuth } from '../auth/AuthProvider';
import { arcTestnet } from '../chains';
import { shortAddress } from '../lib/format';
import { appPath, useToast } from './ui';

export const NAV = [
  {
    label: 'Trade',
    base: '/trade',
    items: [
      { label: 'Swap', to: '/trade/swap', hint: 'Exchange tokens instantly' },
      { label: 'Bridge', to: '/trade/bridge', hint: 'Move assets across chains' },
      { label: 'Buy', to: '/trade/buy', hint: 'Card or bank to crypto' },
      { label: 'Sell', to: '/trade/sell', hint: 'Crypto to your bank' },
    ],
  },
  {
    label: 'Explore',
    base: '/explore',
    items: [
      { label: 'Tokens', to: '/explore/tokens', hint: 'Prices, volume, liquidity' },
      { label: 'Transactions', to: '/explore/transactions', hint: 'Live protocol activity' },
    ],
  },
  { label: 'Launches', base: '/launches', to: '/launches' },
  {
    label: 'Pool',
    base: '/pool',
    items: [
      { label: 'Create position', to: '/pool/create', hint: 'Provide concentrated liquidity' },
      { label: 'Launch auction', to: '/pool/auction', hint: 'Bootstrap a new token' },
    ],
  },
  {
    label: 'Portfolio',
    base: '/portfolio',
    items: [
      { label: 'Overview', to: '/portfolio/overview', hint: 'Net worth and allocation' },
      { label: 'Tokens', to: '/portfolio/tokens', hint: 'Your balances' },
      { label: 'Activity', to: '/portfolio/activity', hint: 'Your transaction history' },
    ],
  },
] as const;

function NavGroup({ group }: { group: (typeof NAV)[number] }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const active = location.pathname.startsWith(appPath(group.base));

  useEffect(() => setOpen(false), [location.pathname]);

  if (!('items' in group)) {
    return (
      <NavLink to={appPath(group.to)} className={`app-nav__link${active ? ' is-active' : ''}`}>
        {group.label}
      </NavLink>
    );
  }

  return (
    <div className="app-nav__group" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        to={appPath(group.items[0].to)}
        className={`app-nav__link${active ? ' is-active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        onFocus={() => setOpen(true)}
      >
        {group.label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            className="app-nav__menu"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
            }}
          >
            {group.items.map((item) => (
              <NavLink key={item.to} to={appPath(item.to)} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenu() {
  const { address, email, method, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button type="button" className="account__button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="account__avatar" aria-hidden="true" />
        <span>{shortAddress(address)}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="account__menu" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }}>
            <p className="account__label">{method === 'google' ? 'Signed in with Google' : 'External wallet'}</p>
            {email && <p className="account__email">{email}</p>}
            <p className="account__address">{address}</p>
            <button
              type="button"
              onClick={() => {
                if (address) void navigator.clipboard?.writeText(address);
                toast({ title: 'Address copied', tone: 'info' });
                setOpen(false);
              }}
            >
              Copy address
            </button>
            <a href={`${arcTestnet.blockExplorers.default.url}/address/${address}`} target="_blank" rel="noreferrer">
              View on {arcTestnet.blockExplorers.default.name} ↗
            </a>
            <Link to={appPath('/portfolio/overview')} onClick={() => setOpen(false)}>
              Portfolio
            </Link>
            <button type="button" className="danger" onClick={() => void logout()}>
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppHeader() {
  const { connected } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <header className="app-header">
      <a className="app-header__brand" href={APP_HOME_HREF} aria-label={`${BRAND.name} home`}>
        <LogoMark size={26} />
        <span>{BRAND.wordmark}</span>
      </a>

      <nav className={`app-nav${mobileOpen ? ' is-open' : ''}`} aria-label="App">
        {NAV.map((group) => (
          <NavGroup key={group.label} group={group} />
        ))}
      </nav>

      <div className="app-header__right">
        <span className="chain-chip">
          <i aria-hidden="true" />
          {arcTestnet.name}
        </span>
        {connected ? (
          <AccountMenu />
        ) : (
          <Link className="connect-btn" to={appPath('/connect')} state={{ from: location.pathname }}>
            Connect
          </Link>
        )}
        <button type="button" className="icon-btn app-header__burger" aria-label="Menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
          ☰
        </button>
      </div>
    </header>
  );
}

// The logo returns to the marketing site (main domain in production).
const APP_HOME_HREF: string = import.meta.env.VITE_SITE_URL || '/';
