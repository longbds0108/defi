import { useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { TOKENS, TRANSACTIONS, priceSeries, type Token, type TxType } from '../../data/demo';
import { formatPrice, formatUsd, timeAgo } from '../../lib/format';
import { useChain } from '../../state/chain';
import { Change, DemoBadge, PageHeader, Segmented, Sparkline, SubNav, TokenMark, appPath } from '../../components/ui';

const totals = {
  tvl: TOKENS.reduce((sum, t) => sum + t.tvl, 0),
  volume: TOKENS.reduce((sum, t) => sum + t.volume24h, 0),
};

export function ExploreLayout() {
  const { config } = useChain();
  return (
    <div className="page">
      <PageHeader kicker="EXPLORE" title="Markets at a glance" actions={<DemoBadge />} />
      <div className="stat-row">
        <div className="stat">
          <span>Total value locked</span>
          <strong>{formatUsd(totals.tvl)}</strong>
        </div>
        <div className="stat">
          <span>24h volume</span>
          <strong>{formatUsd(totals.volume)}</strong>
        </div>
        <div className="stat">
          <span>Tokens listed</span>
          <strong>{TOKENS.length}</strong>
        </div>
        <div className="stat">
          <span>Network</span>
          <strong>{config.chain.name}</strong>
        </div>
      </div>
      <SubNav
        items={[
          { label: 'Tokens', to: '/explore/tokens' },
          { label: 'Transactions', to: '/explore/transactions' },
        ]}
      />
      <Outlet />
    </div>
  );
}

type SortKey = 'tvl' | 'volume24h' | 'change24h' | 'price';

export function ExploreTokens() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('tvl');

  const rows = useMemo(
    () =>
      TOKENS.filter((t) => `${t.symbol} ${t.name}`.toLowerCase().includes(query.trim().toLowerCase())).sort(
        (a, b) => (b[sort] as number) - (a[sort] as number),
      ),
    [query, sort],
  );

  const header = (key: SortKey, label: string) => (
    <th scope="col" className="num">
      <button type="button" className={sort === key ? 'is-sorted' : undefined} onClick={() => setSort(key)}>
        {label} {sort === key ? '↓' : ''}
      </button>
    </th>
  );

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <input className="search" placeholder="Search tokens" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search tokens" />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Token</th>
              {header('price', 'Price')}
              {header('change24h', '24h')}
              {header('volume24h', 'Volume')}
              {header('tvl', 'TVL')}
              <th scope="col" className="num hide-sm">
                Last 24h
              </th>
              <th scope="col" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((token: Token, index) => (
              <tr key={token.symbol}>
                <td className="muted">{index + 1}</td>
                <td>
                  <span className="cell-token">
                    <TokenMark symbol={token.symbol} size={30} />
                    <span>
                      <strong>{token.name}</strong>
                      <small>{token.symbol}</small>
                    </span>
                  </span>
                </td>
                <td className="num mono">{formatPrice(token.price)}</td>
                <td className="num mono">
                  <Change value={token.change24h} />
                </td>
                <td className="num mono">{formatUsd(token.volume24h)}</td>
                <td className="num mono">{formatUsd(token.tvl)}</td>
                <td className="num hide-sm">
                  <Sparkline values={priceSeries(token.symbol, 32)} />
                </td>
                <td className="num">
                  <Link className="row-action" to={appPath('/trade/swap')}>
                    Trade
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TX_FILTERS: Array<{ value: 'all' | TxType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'Swap', label: 'Swaps' },
  { value: 'Add liquidity', label: 'Adds' },
  { value: 'Remove liquidity', label: 'Removes' },
  { value: 'Bridge', label: 'Bridges' },
];

export function ExploreTransactions() {
  const [filter, setFilter] = useState<'all' | TxType>('all');
  const rows = TRANSACTIONS.filter((tx) => filter === 'all' || tx.type === filter);

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <Segmented label="Transaction type" options={TX_FILTERS} value={filter} onChange={setFilter} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Type</th>
              <th scope="col">Details</th>
              <th scope="col" className="num">
                Value
              </th>
              <th scope="col" className="num hide-sm">
                Account
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td className="muted nowrap">{timeAgo(tx.minutesAgo)}</td>
                <td>
                  <span className={`tx-type tx-type--${tx.type.split(' ')[0].toLowerCase()}`}>{tx.type}</span>
                </td>
                <td className="mono small">{tx.summary}</td>
                <td className="num mono">{formatUsd(tx.valueUsd)}</td>
                <td className="num mono muted hide-sm">{tx.account}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
