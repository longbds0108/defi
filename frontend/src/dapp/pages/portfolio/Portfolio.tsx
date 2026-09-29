import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { CHAINS, NATIVE, explorerTx, type ChainConfig } from '../../chains';
import { useChain } from '../../state/chain';
import { useActivity } from '../../state/activity';
import { useBalances } from '../../hooks/useBalances';
import { formatAmount, formatUsd, shortAddress, timeAgo } from '../../lib/format';
import { DemoBadge, PairMark, SubNav, TokenMark, appPath } from '../../components/ui';
import { ChainDot } from '../../components/chainUi';
import { DEMO_POSITIONS, POOLS } from '../../data/demo';

/** Balances on every supported chain; value uses rough USD hints (estimate). */
function useAllBalances() {
  // CHAINS is a fixed list, so the number of hook calls never changes.
  const perChain = CHAINS.map((config) => ({ config, b: useBalances(config.chain.id, config.tokens) })); // eslint-disable-line react-hooks/rules-of-hooks
  const rows = perChain.flatMap(({ config, b }) =>
    config.tokens.map((token) => {
      const amount = b.get(token) ?? 0;
      return { config, token, amount, value: amount * token.usdHint };
    }),
  );
  return { rows, total: rows.reduce((sum, r) => sum + r.value, 0), loading: perChain.some(({ b }) => b.isLoading) };
}

type Rows = ReturnType<typeof useAllBalances>['rows'];

export function PortfolioLayout() {
  const { address, email, method } = useAuth();
  const { total, loading } = useAllBalances();

  return (
    <div className="page">
      <div className="portfolio-head">
        <span className="account__avatar account__avatar--lg" aria-hidden="true" />
        <div>
          <p className="page-header__kicker">{!address ? 'NOT CONNECTED' : method === 'google' ? `GOOGLE · ${email ?? ''}` : 'EXTERNAL WALLET'}</p>
          <h1>{address ? shortAddress(address) : 'Your portfolio'}</h1>
        </div>
        <div className="portfolio-head__total">
          <small>Testnet balance (est.)</small>
          <strong>{!address ? '—' : loading ? '…' : formatUsd(total)}</strong>
        </div>
      </div>
      <SubNav
        items={[
          { label: 'Overview', to: '/portfolio/overview' },
          { label: 'Tokens', to: '/portfolio/tokens' },
          { label: 'Activity', to: '/portfolio/activity' },
        ]}
      />
      {!address ? (
        <div className="empty-state">
          <p>Connect a wallet to see balances across Sepolia, Base Sepolia, Unichain Sepolia and Arc Testnet.</p>
          <Link className="cta cta--sm" to={appPath('/connect')}>
            Connect
          </Link>
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

const ALLOC_COLORS = ['#9B5DE5', '#3F91FF', '#4FD1C5', '#E8B54C', '#E5484D', '#B57DEE'];

function ChainSummary({ config, rows }: { config: ChainConfig; rows: Rows }) {
  const mine = rows.filter((r) => r.config.chain.id === config.chain.id && r.amount > 0);
  const value = mine.reduce((s, r) => s + r.value, 0);
  return (
    <li>
      <ChainDot config={config} size={24} />
      <span>
        <strong>{config.chain.name}</strong>
        <small>{mine.length ? mine.map((r) => `${formatAmount(r.amount)} ${r.token.symbol}`).join(' · ') : 'No balances'}</small>
      </span>
      <b>{formatUsd(value)}</b>
    </li>
  );
}

export function PortfolioOverview() {
  const { rows, total } = useAllBalances();
  const bySymbol = Object.values(
    rows.reduce<Record<string, { label: string; value: number }>>((acc, r) => {
      const key = r.token.symbol === 'WETH' ? 'ETH' : r.token.symbol;
      acc[key] = { label: key, value: (acc[key]?.value ?? 0) + r.value };
      return acc;
    }, {}),
  )
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="grid-2">
      <section className="panel panel--pad">
        <div className="panel__head">
          <h2 className="panel__title">By network</h2>
          <span className="live-badge">
            <i aria-hidden="true" />
            On-chain
          </span>
        </div>
        <ul className="mini-list">
          {CHAINS.map((c) => (
            <ChainSummary key={c.chain.id} config={c} rows={rows} />
          ))}
        </ul>
      </section>

      <section className="panel panel--pad">
        <h2 className="panel__title">Allocation</h2>
        {bySymbol.length === 0 ? (
          <p className="muted small">No testnet balances yet. Get test ETH or USDC from a faucet, then swap or bridge.</p>
        ) : (
          <>
            <div className="alloc-bar" role="img" aria-label={bySymbol.map((a) => `${a.label} ${((a.value / total) * 100).toFixed(0)}%`).join(', ')}>
              {bySymbol.map((a, i) => (
                <span key={a.label} style={{ flexGrow: a.value, background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
              ))}
            </div>
            <ul className="alloc-list">
              {bySymbol.map((a, i) => (
                <li key={a.label}>
                  <i style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                  {a.label}
                  <span>{((a.value / total) * 100).toFixed(1)}%</span>
                  <b>{formatUsd(a.value)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="modal__hint">USD values use fixed reference prices (ETH ≈ $3,400, EURC ≈ $1.08). Testnet tokens have no market price.</p>
      </section>

      <section className="panel panel--pad span-2">
        <div className="panel__head">
          <h2 className="panel__title">Liquidity positions</h2>
          <span className="page-header__actions">
            <DemoBadge />
            <Link className="link" to={appPath('/pool/create')}>
              + New
            </Link>
          </span>
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
        <p className="modal__hint">Listing positions needs an indexer (Uniswap Data API or a subgraph). Positions you create here appear in Activity.</p>
      </section>
    </div>
  );
}

export function PortfolioTokens() {
  const { config, chainId } = useChain();
  const b = useBalances(chainId, config.tokens);

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <span className="muted small">
          Balances on <strong>{config.chain.name}</strong>. Switch network in the header to see others.
        </span>
        <span className="live-badge">
          <i aria-hidden="true" />
          On-chain
        </span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col" className="num">
                Balance
              </th>
              <th scope="col" className="num">
                Value (est.)
              </th>
              <th scope="col" className="num hide-sm">
                Contract
              </th>
            </tr>
          </thead>
          <tbody>
            {config.tokens.map((t) => {
              const amount = b.get(t);
              return (
                <tr key={t.address}>
                  <td>
                    <span className="cell-token">
                      <TokenMark symbol={t.symbol} color={t.color} size={30} />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.symbol}</small>
                      </span>
                    </span>
                  </td>
                  <td className="num mono">{amount === undefined ? (b.isLoading ? '…' : '—') : formatAmount(amount)}</td>
                  <td className="num mono">{amount === undefined ? '—' : formatUsd(amount * t.usdHint)}</td>
                  <td className="num mono muted hide-sm">{t.address === NATIVE ? 'Native' : shortAddress(t.address)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortfolioActivity() {
  const { address } = useAuth();
  const items = useActivity(address);

  return (
    <div className="panel">
      <div className="panel__toolbar">
        <span className="muted small">Transactions sent from this app on this device.</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state empty-state--inline">
          <p>No activity yet. Swaps, bridges, liquidity and bids you make will show up here with explorer links.</p>
        </div>
      ) : (
        <ul className="activity">
          {items.map((tx) => {
            const ago = timeAgo(Math.round((Date.now() - tx.time) / 60_000));
            return (
              <li key={tx.id}>
                <span className={`tx-type tx-type--${tx.kind.split(' ')[0].toLowerCase()}`}>{tx.kind}</span>
                <span className="activity__summary mono">{tx.summary}</span>
                <span className="activity__value muted small">{CHAINS.find((c) => c.chain.id === tx.chainId)?.short ?? tx.chainId}</span>
                <span className="muted nowrap">
                  {tx.hash ? (
                    <a className="link" href={explorerTx(tx.chainId, tx.hash)} target="_blank" rel="noreferrer">
                      {ago} ↗
                    </a>
                  ) : (
                    ago
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
