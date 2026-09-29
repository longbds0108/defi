import { Outlet } from 'react-router-dom';
import { DEMO_POSITIONS, POOLS, tokenBySymbol } from '../../data/demo';
import { formatUsd } from '../../lib/format';
import { DemoBadge, PageHeader, PairMark, SubNav } from '../../components/ui';

export function PoolLayout() {
  return (
    <div className="page">
      <PageHeader
        kicker="POOL"
        title={
          <>
            Provide liquidity. <em>Launch markets.</em>
          </>
        }
      />
      <div className="positions-strip" aria-label="Your positions">
        {DEMO_POSITIONS.map((position) => {
          const pool = POOLS.find((p) => p.id === position.pool)!;
          return (
            <div key={position.pool} className="position-pill">
              <PairMark a={pool.a} b={pool.b} size={22} />
              <span>
                <strong>
                  {pool.a}/{pool.b}
                </strong>
                <small>
                  {formatUsd(position.liquidityUsd)} · fees {formatUsd(position.feesUsd)}
                </small>
              </span>
              <span className={`range-dot${position.inRange ? ' is-in' : ''}`}>{position.inRange ? 'In range' : 'Out of range'}</span>
            </div>
          );
        })}
        <DemoBadge>Demo positions</DemoBadge>
        <div className="position-pill position-pill--muted">
          <span>
            <strong>{POOLS.length} pools</strong>
            <small>Top APR {Math.max(...POOLS.map((p) => p.apr)).toFixed(1)}% · {tokenBySymbol('LUM').symbol}/USDC</small>
          </span>
        </div>
      </div>
      <SubNav
        items={[
          { label: 'Create position', to: '/pool/create' },
          { label: 'Launch auction', to: '/pool/auction' },
        ]}
      />
      <Outlet />
    </div>
  );
}
