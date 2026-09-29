import { useMemo } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { formatUnits } from 'viem';
import { useBalance } from 'wagmi';
import { useAuth } from '../../auth/AuthProvider';
import { arcTestnet } from '../../chains';
import { DEMO_HOLDINGS, DEMO_POSITIONS, POOLS, TRANSACTIONS, priceSeries, tokenBySymbol } from '../../data/demo';
import { formatAmount, formatPrice, formatUsd, shortAddress, timeAgo } from '../../lib/format';
import { AreaChart, Change, DemoBadge, PairMark, SubNav, TokenMark, appPath } from '../../components/ui';

/** Native USDC on Arc Testnet is read from chain; everything else is demo. */
function useNativeBalance() {
  const { address } = useAuth();
  const { data, isLoading, isError } = useBalance({ address, chainId: arcTestnet.id, query: { enabled: Boolean(address), refetchInterval: 15_000 } });
  const amount = data ? Number(formatUnits(data.value, data.decimals)) : 0;
  return { amount, isLoading, isError };
}

function useHoldings() {
  const native = useNativeBalance();
  return useMemo(() => {
    const rows = DEMO_HOLDINGS.map((h) => {
      const token = tokenBySymbol(h.symbol);
      return { ...h, token, value: h.amount * token.price, source: 'demo' as const };
    });
    const liquidity = DEMO_POSITIONS.reduce((sum, p) => sum + p.liquidityUsd, 0);
    const tokensValue = rows.reduce((sum, r) => sum + r.value, 0);
    return { rows, liquidity, total: tokensValue + liquidity + native.amount, native };
  }, [native]);
}

export function PortfolioLayout() {
  const { address, email, method } = useAuth();
  const { total } = useHoldings();

  return (
    <div className="page">
      <div className="portfolio-head">
        <span className="account__avatar account__avatar--lg" aria-hidden="true" />
        <div>
          <p className="page-header__kicker">{!address ? 'PREVIEW · NOT CONNECTED' : method === 'google' ? `GOOGLE · ${email ?? ''}` : 'EXTERNAL WALLET'}</p>
          <h1>{address ? shortAddress(address) : 'Demo portfolio'}</h1>
        </div>
        <div className="portfolio-head__total">
          <small>Net worth</small>
          <strong>{formatUsd(total)}</strong>
        </div>
      </div>
      <SubNav
        items={[
          { label: 'Overview', to: '/portfolio/overview' },
          { label: 'Tokens', to: '/portfolio/tokens' },
          { label: 'Activity', to: '/portfolio/activity' },
        ]}
      />
      <Outlet />
    </div>
  );
}

const ALLOC_COLORS = ['#9B5DE5', '#3F91FF', '#4FD1C5', '#E8B54C', '#E5484D', '#B57DEE'];

export function PortfolioOverview() {
  const { rows, liquidity, total } = useHoldings();
  const history = useMemo(() => priceSeries('portfolio', 60, total, 6.4), [total]);
  const labels = history.map((_, i) => `${60 - 1 - i}d ago`.replace(/^0d ago$/, 'Today'));
  const allocation = [...rows.map((r) => ({ label: r.symbol, value: r.value })), { label: 'Liquidity', value: liquidity }].sort((a, b) => b.value - a.value);

  return (
    <div className="grid-2">
      <section className="panel panel--pad span-2">
        <div className="panel__head">
          <h2 className="panel__title">Portfolio value · 60d</h2>
          <DemoBadge />
        </div>
        <AreaChart values={history} labels={labels} format={formatUsd} />
      </section>

      <section className="panel panel--pad">
        <h2 className="panel__title">Allocation</h2>
        <div className="alloc-bar" role="img" aria-label={allocation.map((a) => `${a.label} ${((a.value / total) * 100).toFixed(0)}%`).join(', ')}>
          {allocation.map((a, i) => (
            <span key={a.label} style={{ flexGrow: a.value, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
          ))}
        </div>
        <ul className="alloc-list">
          {allocation.map((a, i) => (
            <li key={a.label}>
              <i style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
              {a.label}
              <span>{((a.value / total) * 100).toFixed(1)}%</span>
              <b>{formatUsd(a.value)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel--pad">
        <div className="panel__head">
          <h2 className="panel__title">Liquidity positions</h2>
          <Link className="link" to={appPath('/pool/create')}>
            + New
          </Link>
        </div>
        <ul className="mini-list">
          {DEMO_POSITIONS.map((p) => {
            const pool = POOLS.find((x) => x.id === p.pool)!;
            return (
              <li key={p.pool}>
                <PairMark a={pool.a} b={pool.b} size={24} />
                <span>
                  <strong>
                    {pool.a}/{pool.b}
                  </strong>
                  <small>
                    {formatAmount(p.min)} – {formatAmount(p.max)} · {p.inRange ? 'in range' : 'out of range'}
                  </small>
                </span>
                <b>{formatUsd(p.liquidityUsd)}</b>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export function PortfolioTokens() {
  const { rows, native } = useHoldings();

  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col" className="num">
                Price
              </th>
              <th scope="col" className="num">
                Balance
              </th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col" className="num hide-sm">
                Source
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="cell-token">
                  <TokenMark symbol="USDC" size={30} />
                  <span>
                    <strong>USDC (native gas)</strong>
                    <small>{arcTestnet.name}</small>
                  </span>
                </span>
              </td>
              <td className="num mono">$1</td>
              <td className="num mono">{native.isLoading ? '…' : native.isError ? '—' : formatAmount(native.amount)}</td>
              <td className="num mono">{native.isError ? 'RPC unavailable' : formatUsd(native.amount)}</td>
              <td className="num hide-sm">
                <span className="source source--chain">On-chain</span>
              </td>
            </tr>
            {rows.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <span className="cell-token">
                    <TokenMark symbol={r.symbol} size={30} />
                    <span>
                      <strong>{r.token.name}</strong>
                      <small>{r.symbol}</small>
                    </span>
                  </span>
                </td>
                <td className="num mono">
                  {formatPrice(r.token.price)} <Change value={r.token.change24h} />
                </td>
                <td className="num mono">{formatAmount(r.amount)}</td>
                <td className="num mono">{formatUsd(r.value)}</td>
                <td className="num hide-sm">
                  <span className="source">Demo</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortfolioActivity() {
  const { address } = useAuth();
  // Demo: a slice of protocol activity attributed to the connected account.
  const rows = TRANSACTIONS.filter((_, i) => i % 3 === 0).map((tx) => ({ ...tx, account: address ? shortAddress(address) : 'you' }));

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <DemoBadge>Demo history</DemoBadge>
      </div>
      <ul className="activity">
        {rows.map((tx) => (
          <li key={tx.id}>
            <span className={`tx-type tx-type--${tx.type.split(' ')[0].toLowerCase()}`}>{tx.type}</span>
            <span className="activity__summary mono">{tx.summary}</span>
            <span className="activity__value mono">{formatUsd(tx.valueUsd)}</span>
            <span className="muted nowrap">{timeAgo(tx.minutesAgo)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
