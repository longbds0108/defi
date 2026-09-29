import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { erc20Abi, formatUnits, isAddress, maxUint256, parseUnits, type Address } from 'viem';
import { useReadContract } from 'wagmi';
import { useAuth } from '../auth/AuthProvider';
import { LAUNCHPAD, NATIVE, explorerAddress } from '../chains';
import { useChain } from '../state/chain';
import { useFlow } from '../hooks/useFlow';
import { ccaAbi, permit2Abi } from '../cca/abi';
import { priceToQ96, q96ToPrice, snapToTick } from '../cca/math';
import { clientFor, saveAuction, useAuctions, useMyBids, type AuctionStatus, type AuctionView } from '../cca/useAuctions';
import { formatAmount, sanitizeAmount } from '../lib/format';
import { Modal, PageHeader, Segmented, TokenMark, appPath, useToast } from '../components/ui';
import { FlowSteps } from '../components/chainUi';

const FILTERS: Array<{ value: 'all' | AuctionStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
];

function duration(seconds: number) {
  if (seconds <= 0) return 'now';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

function colorFor(address: string) {
  const hue = parseInt(address.slice(2, 6), 16) % 360;
  return `hsl(${hue} 70% 58%)`;
}

function AuctionCard({ a, onOpen }: { a: AuctionView; onOpen: () => void }) {
  const raised = Number(formatUnits(a.currencyRaised, a.currencyDecimals));
  const supply = Number(formatUnits(a.totalSupply, a.tokenDecimals));
  const color = colorFor(a.token);
  return (
    <motion.article className={`launch-card launch-card--${a.status}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ '--launch-color': color } as React.CSSProperties}>
      <div className="launch-card__top">
        <TokenMark symbol={a.tokenSymbol} size={44} color={color} plain />
        <span className={`status status--${a.status}`}>
          <i aria-hidden="true" />
          {a.status === 'live' ? 'Live' : a.status === 'upcoming' ? 'Upcoming' : 'Ended'}
        </span>
      </div>
      <h3>
        {a.tokenName} <small>${a.tokenSymbol}</small>
      </h3>
      <p className="mono small muted">
        <a href={explorerAddress(a.chainId, a.address)} target="_blank" rel="noreferrer">
          Auction {a.address.slice(0, 8)}…{a.address.slice(-4)} ↗
        </a>
      </p>
      <div className="launch-card__meta">
        <span>Continuous clearing</span>
        <span>{a.status === 'live' ? `Ends in ${duration(a.secondsLeft)}` : a.status === 'upcoming' ? `Starts in ${duration(a.secondsLeft)}` : `Ended · ${a.graduated === false ? 'not graduated' : 'graduated'}`}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.progress * 100)} aria-label="Auction time elapsed">
        <span style={{ width: `${a.progress * 100}%` }} />
      </div>
      <dl className="launch-card__stats">
        <div>
          <dt>Raised</dt>
          <dd>
            {formatAmount(raised)} {a.currencySymbol}
          </dd>
        </div>
        <div>
          <dt>Supply</dt>
          <dd>{formatAmount(supply)}</dd>
        </div>
        <div>
          <dt>Clearing</dt>
          <dd title={`${a.clearingPrice} ${a.currencySymbol} per ${a.tokenSymbol}`}>{formatAmount(a.clearingPrice)}</dd>
        </div>
      </dl>
      <button type="button" className={a.status === 'live' ? 'cta cta--sm' : 'ghost-btn'} onClick={onOpen}>
        {a.status === 'live' ? 'Place bid' : a.status === 'upcoming' ? 'View details' : 'Your bids'}
      </button>
    </motion.article>
  );
}

function AuctionModal({ auction, onClose }: { auction: AuctionView; onClose: () => void }) {
  const { address, connected } = useAuth();
  const { ensureChain } = useChain();
  const toast = useToast();
  const queryClient = useQueryClient();
  const flow = useFlow();
  const bids = useMyBids(auction, address);
  const native = auction.currency === NATIVE;

  const suggested = q96ToPrice(snapToTick((auction.clearingPriceQ96 * 12n) / 10n, auction.floorPriceQ96, auction.tickSpacingQ96, auction.clearingPriceQ96), auction.tokenDecimals, auction.currencyDecimals);
  const [maxPrice, setMaxPrice] = useState(() => String(Number(suggested.toPrecision(6))));
  const [amount, setAmount] = useState('');

  const currencyBalance = useReadContract({
    address: auction.currency,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    chainId: auction.chainId,
    query: { enabled: Boolean(address) && !native },
  });

  const priceQ96 = useMemo(() => {
    try {
      const raw = priceToQ96(maxPrice || '0', auction.tokenDecimals, auction.currencyDecimals);
      return raw > 0n ? snapToTick(raw, auction.floorPriceQ96, auction.tickSpacingQ96, auction.clearingPriceQ96) : 0n;
    } catch {
      return 0n;
    }
  }, [maxPrice, auction]);
  const snapped = priceQ96 ? q96ToPrice(priceQ96, auction.tokenDecimals, auction.currencyDecimals) : 0;
  const amountNum = Number(amount) || 0;

  async function bid() {
    if (!address) return;
    const raw = parseUnits(amount, auction.currencyDecimals);
    const summary = `${formatAmount(amountNum)} ${auction.currencySymbol} on ${auction.tokenSymbol} ≤ ${formatAmount(snapped)}`;
    const ok = await flow.run(
      [
        { id: 'network', label: 'Switch network' },
        ...(native
          ? []
          : [
              { id: 'erc20', label: `Approve ${auction.currencySymbol} for Permit2` },
              { id: 'permit2', label: 'Allow auction via Permit2' },
            ]),
        { id: 'bid', label: 'Submit bid' },
      ],
      async () => {
        flow.update('network', { status: 'active' });
        await ensureChain(auction.chainId);
        flow.update('network', { status: 'done' });

        if (!native) {
          // CCA pulls ERC-20 currency with Permit2 (AllowanceTransfer).
          const client = clientFor(auction.chainId);
          const erc20Allowance = await client.readContract({ address: auction.currency, abi: erc20Abi, functionName: 'allowance', args: [address, LAUNCHPAD.permit2] });
          if (erc20Allowance < raw) {
            await flow.contract('erc20', { address: auction.currency, abi: erc20Abi, functionName: 'approve', args: [LAUNCHPAD.permit2, maxUint256], chainId: auction.chainId }, { kind: 'Approve', summary: `Approve ${auction.currencySymbol} for Permit2` });
          } else flow.update('erc20', { status: 'skipped', note: 'Already approved' });

          const [p2Amount, p2Expiry] = await client.readContract({ address: LAUNCHPAD.permit2, abi: permit2Abi, functionName: 'allowance', args: [address, auction.currency, auction.address] });
          if (p2Amount < raw || p2Expiry * 1000 < Date.now() + 60_000) {
            const expiry = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
            await flow.contract('permit2', { address: LAUNCHPAD.permit2, abi: permit2Abi, functionName: 'approve', args: [auction.currency, auction.address, raw, expiry], chainId: auction.chainId });
          } else flow.update('permit2', { status: 'skipped', note: 'Allowance in place' });
        }

        await flow.contract(
          'bid',
          { address: auction.address, abi: ccaAbi, functionName: 'submitBid', args: [priceQ96, raw, address, '0x'], value: native ? raw : undefined, chainId: auction.chainId },
          { kind: 'Bid', summary },
        );
      },
    );
    if (ok) {
      toast({ title: 'Bid placed', body: summary, tone: 'success' });
      setAmount('');
      void queryClient.invalidateQueries({ queryKey: ['my-bids'] });
      void queryClient.invalidateQueries({ queryKey: ['auctions', auction.chainId] });
    }
  }

  async function act(kind: 'exit' | 'claim', id: bigint) {
    const ok = await flow.run([{ id: 'network', label: 'Switch network' }, { id: kind, label: kind === 'exit' ? `Exit bid #${id}` : `Claim tokens for bid #${id}` }], async () => {
      flow.update('network', { status: 'active' });
      await ensureChain(auction.chainId);
      flow.update('network', { status: 'done' });
      await flow.contract(kind, { address: auction.address, abi: ccaAbi, functionName: kind === 'exit' ? 'exitBid' : 'claimTokens', args: [id], chainId: auction.chainId }, { kind: kind === 'exit' ? 'Exit' : 'Claim', summary: `${kind === 'exit' ? 'Exit' : 'Claim'} ${auction.tokenSymbol} bid #${id}` });
    });
    if (ok) void bids.refetch();
  }

  const balance = native ? undefined : currencyBalance.data !== undefined ? Number(formatUnits(currencyBalance.data, auction.currencyDecimals)) : undefined;

  return (
    <Modal open onClose={() => !flow.running && onClose()} title={`${auction.tokenName} (${auction.tokenSymbol})`}>
      <dl className="quote quote--flat">
        <div>
          <dt>Clearing price</dt>
          <dd>
            {formatAmount(auction.clearingPrice)} {auction.currencySymbol}
          </dd>
        </div>
        <div>
          <dt>Floor price</dt>
          <dd>
            {formatAmount(auction.floorPrice)} {auction.currencySymbol}
          </dd>
        </div>
        <div>
          <dt>Blocks</dt>
          <dd>
            {auction.startBlock.toString()} → {auction.endBlock.toString()} (claim {auction.claimBlock.toString()})
          </dd>
        </div>
      </dl>

      {auction.status === 'live' && (
        <>
          <div className="field">
            <div className="field__top">
              <span>Max price ({auction.currencySymbol} per {auction.tokenSymbol})</span>
              <span>snaps to {formatAmount(snapped)}</span>
            </div>
            <div className="field__row">
              <input inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(sanitizeAmount(e.target.value, 18))} aria-label="Max price" />
            </div>
          </div>
          <div className="field">
            <div className="field__top">
              <span>You commit</span>
              <span>{balance !== undefined ? `Balance ${formatAmount(balance)}` : auction.currencySymbol}</span>
            </div>
            <div className="field__row">
              <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(sanitizeAmount(e.target.value, auction.currencyDecimals))} aria-label={`${auction.currencySymbol} to commit`} />
              <span className="token-static">{auction.currencySymbol}</span>
            </div>
            <div className="field__foot">≤ {snapped ? formatAmount(amountNum / snapped) : 0} {auction.tokenSymbol} if cleared at your max price</div>
          </div>
          <p className="modal__hint">Your bid buys a share of every block’s supply while the clearing price stays below your max price. Everyone pays the clearing price; the rest is refunded.</p>
          <FlowSteps steps={flow.steps} error={flow.error} />
          <button type="button" className="cta" disabled={!connected || !amountNum || !priceQ96 || flow.running} onClick={() => void bid()}>
            {!connected ? 'Connect wallet to bid' : flow.running ? 'Working…' : !amountNum ? 'Enter an amount' : 'Submit bid'}
          </button>
        </>
      )}

      {connected && (
        <div className="my-bids">
          <p className="modal__label">Your bids</p>
          {bids.isLoading ? (
            <p className="muted small">Loading…</p>
          ) : !bids.data?.length ? (
            <p className="muted small">No bids from this wallet.</p>
          ) : (
            <ul className="mini-list">
              {bids.data.map(({ id, bid }) => (
                <li key={id.toString()}>
                  <span>
                    <strong>Bid #{id.toString()}</strong>
                    <small>
                      max {bid ? formatAmount(q96ToPrice(bid.maxPrice, auction.tokenDecimals, auction.currencyDecimals)) : '—'} · filled{' '}
                      {bid ? formatAmount(Number(formatUnits(bid.tokensFilled, auction.tokenDecimals))) : '—'} {auction.tokenSymbol}
                      {bid && bid.exitedBlock > 0n ? ' · exited' : ''}
                    </small>
                  </span>
                  {auction.status === 'ended' && bid && (
                    <span className="row-actions">
                      {bid.exitedBlock === 0n && (
                        <button type="button" className="row-action" disabled={flow.running} onClick={() => void act('exit', id)}>
                          Exit
                        </button>
                      )}
                      <button type="button" className="row-action" disabled={flow.running} onClick={() => void act('claim', id)}>
                        Claim
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {auction.status !== 'live' && <FlowSteps steps={flow.steps} error={flow.error} />}
        </div>
      )}
    </Modal>
  );
}

export function Launches() {
  const { config, chainId } = useChain();
  const [filter, setFilter] = useState<'all' | AuctionStatus>('all');
  const [active, setActive] = useState<AuctionView | null>(null);
  const [addInput, setAddInput] = useState('');
  const auctions = useAuctions(chainId);
  const queryClient = useQueryClient();
  const rows = (auctions.data ?? []).filter((a) => filter === 'all' || a.status === filter).sort((x, y) => (x.status === 'live' ? -1 : 0) - (y.status === 'live' ? -1 : 0));

  return (
    <div className="page">
      <PageHeader
        kicker={`LAUNCHES · ${config.chain.name.toUpperCase()}`}
        title={
          <>
            New tokens, <em>fair price discovery.</em>
          </>
        }
        actions={
          <>
            <span className="live-badge">
              <i aria-hidden="true" />
              On-chain · Uniswap CCA
            </span>
            <Link className="ghost-btn" to={appPath('/pool/auction')}>
              Launch your token →
            </Link>
          </>
        }
      />
      <div className="panel__toolbar panel__toolbar--bare">
        <Segmented label="Launch status" options={FILTERS} value={filter} onChange={setFilter} />
        <form
          className="add-auction"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isAddress(addInput)) return;
            saveAuction(chainId, addInput as Address);
            setAddInput('');
            void queryClient.invalidateQueries({ queryKey: ['auctions', chainId] });
          }}
        >
          <input className="search" placeholder="Add auction by address (0x…)" value={addInput} onChange={(e) => setAddInput(e.target.value.trim())} aria-label="Auction address" />
          <button type="submit" className="ghost-btn" disabled={!isAddress(addInput)}>
            Add
          </button>
        </form>
      </div>

      {auctions.isLoading ? (
        <div className="launch-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="launch-card launch-card--skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <p>
            No {filter === 'all' ? '' : `${filter} `}auctions found in recent blocks on {config.chain.name}.
          </p>
          <Link className="cta cta--sm" to={appPath('/pool/auction')}>
            Launch one →
          </Link>
        </div>
      ) : (
        <div className="launch-grid">
          {rows.map((a) => (
            <AuctionCard key={a.address} a={a} onOpen={() => setActive(a)} />
          ))}
        </div>
      )}
      {auctions.error && <p className="inline-error">Could not load auctions: {(auctions.error as Error).message}</p>}

      {active && <AuctionModal auction={active} onClose={() => setActive(null)} />}
    </div>
  );
}
