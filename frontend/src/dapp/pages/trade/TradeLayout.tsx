import { NavLink, Outlet } from 'react-router-dom';
import { appPath } from '../../components/ui';

const TABS = [
  { label: 'Swap', to: '/trade/swap' },
  { label: 'Bridge', to: '/trade/bridge' },
  { label: 'Buy', to: '/trade/buy' },
  { label: 'Sell', to: '/trade/sell' },
];

/// Trade flows share one centred card; the tabs sit on top like a widget.
export function TradeLayout() {
  return (
    <div className="trade">
      <div className="trade__glow" aria-hidden="true" />
      <div className="trade__column">
        <nav className="trade-tabs" aria-label="Trade">
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={appPath(tab.to)} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
