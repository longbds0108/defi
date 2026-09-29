import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { encodeAbiParameters, erc20Abi, formatUnits, isAddress, parseUnits, toHex, type Address } from 'viem';
import { useAuth } from '../../auth/AuthProvider';
import { LAUNCHPAD, NATIVE } from '../../chains';
import { useChain } from '../../state/chain';
import { useFlow } from '../../hooks/useFlow';
import { ccaAbi, ccaFactoryAbi, uerc20FactoryAbi, uerc20MetadataAbi } from '../../cca/abi';
import { encodeAuctionConfig, floorAndSpacing, priceToQ96, uniformSteps } from '../../cca/math';
import { clientFor, saveAuction } from '../../cca/useAuctions';
import { recordActivity } from '../../state/activity';
import { formatAmount, formatUsd, sanitizeAmount } from '../../lib/format';
import { Segmented, appPath, useToast } from '../../components/ui';
import { FlowSteps } from '../../components/chainUi';

type TokenSource = 'new' | 'existing';

function ReleaseCurve({ startMinutes, hours }: { startMinutes: number; hours: number }) {
  // Uniform release: cumulative supply grows linearly from start to end.
  return (
    <div className="curve">
      <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Token release schedule">
        <line x1="0" x2="600" y1="164" y2="164" stroke="rgba(255,255,255,0.12)" vectorEffect="non-scaling-stroke" />
        <path d="M0,164 L60,164 L600,16 L600,180 L0,180 Z" fill="rgba(155,93,229,0.14)" />
        <path d="M0,164 L60,164 L600,16" fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="curve__axis">
        <span>Starts in {startMinutes}m</span>
        <span>Supply released evenly each block</span>
        <span>{hours}h</span>
      </div>
    </div>
  );
}

export function LaunchAuction() {
  const { config, chainId, ensureChain } = useChain();
  const { address, connected } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const flow = useFlow();
  const factory = config.tokenFactory;

  const [source, setSource] = useState<TokenSource>(factory ? 'new' : 'existing');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('10000000');
  const [existing, setExisting] = useState('');
  const [salePct, setSalePct] = useState('20');
  const usdc = config.tokens.find((t) => t.symbol === 'USDC' && t.address !== NATIVE);
  const [currencyKey, setCurrencyKey] = useState<'native' | 'usdc'>('native');
  const currency = currencyKey === 'usdc' && usdc ? usdc : { ...config.tokens[0], address: NATIVE, symbol: config.chain.nativeCurrency.symbol, decimals: config.chain.nativeCurrency.decimals };
  const [floor, setFloor] = useState('0.0001');
  const [startMinutes, setStartMinutes] = useState(5);
  const [hours, setHours] = useState(24);
  const [required, setRequired] = useState('0');

  // Existing token metadata + balance.
  const existingToken = useQuery({
    queryKey: ['token-meta', chainId, existing, address],
    enabled: source === 'existing' && isAddress(existing),
    queryFn: async () => {
      const client = clientFor(chainId);
      const [sym, dec, bal] = await client.multicall({
        contracts: [
          { address: existing as Address, abi: erc20Abi, functionName: 'symbol' },
          { address: existing as Address, abi: erc20Abi, functionName: 'decimals' },
          { address: existing as Address, abi: erc20Abi, functionName: 'balanceOf', args: [address ?? NATIVE] },
        ],
      });
      if (sym.status !== 'success') throw new Error('Not an ERC-20 token on this network.');
      return { symbol: sym.result as string, decimals: dec.result as number, balance: bal.result as bigint };
    },
    retry: false,
  });

  const tokenDecimals = source === 'new' ? 18 : existingToken.data?.decimals ?? 18;
  const tokenSymbol = source === 'new' ? symbol || 'TOKEN' : existingToken.data?.symbol ?? 'TOKEN';
  const supplyN = source === 'new' ? Number(supply) || 0 : Number(formatUnits(existingToken.data?.balance ?? 0n, tokenDecimals));
  const pct = Math.min(100, Number(salePct) || 0);
  const forSale = (supplyN * pct) / 100;
  const floorN = Number(floor) || 0;
  const blocks = Math.max(1, Math.round((hours * 3600) / config.blockTimeSec));

  const errors = [
    !connected && 'Connect a wallet to launch',
    source === 'new' && !factory && `No token factory on ${config.chain.name}; use an existing token`,
    source === 'new' && !name.trim() && 'Token name is required',
    source === 'new' && !/^[A-Z0-9]{2,11}$/.test(symbol) && 'Symbol: 2–11 capital letters or digits',
    source === 'new' && supplyN <= 0 && 'Total supply must be positive',
    source === 'existing' && !isAddress(existing) && 'Enter the token address',
    source === 'existing' && existingToken.error && (existingToken.error as Error).message,
    source === 'existing' && existingToken.data && existingToken.data.balance === 0n && 'Your wallet holds none of this token',
    (pct <= 0 || pct > 100) && 'Sale amount must be 1–100% of supply',
    floorN <= 0 && 'Floor price must be positive',
    currencyKey === 'usdc' && !usdc && `No USDC listed on ${config.chain.name}`,
  ].filter(Boolean) as string[];

  const configPreview = useMemo(() => {
    try {
      const { floorPrice, tickSpacing } = floorAndSpacing(priceToQ96(floor || '0', tokenDecimals, currency.decimals));
      return { floorPrice, tickSpacing };
    } catch {
      return null;
    }
  }, [floor, tokenDecimals, currency.decimals]);

  async function launch() {
    if (!address || !configPreview) return;
    let tokenAddress = (source === 'existing' ? existing : '') as Address;
    const saleRaw = parseUnits(String(forSale), tokenDecimals);
    let auction: Address | undefined;

    const ok = await flow.run(
      [
        { id: 'network', label: `Use ${config.chain.name}` },
        ...(source === 'new' ? [{ id: 'token', label: `Create ${symbol} token` }] : []),
        { id: 'auction', label: 'Deploy auction (CCA factory)' },
        { id: 'fund', label: `Transfer ${formatAmount(forSale)} ${tokenSymbol} to auction` },
        { id: 'activate', label: 'Register tokens (onTokensReceived)' },
      ],
      async () => {
        flow.update('network', { status: 'active' });
        await ensureChain();
        flow.update('network', { status: 'done' });

        if (source === 'new' && factory) {
          const metadata = encodeAbiParameters(uerc20MetadataAbi, [{ description: `${name} — launched with Lumora`, website: '', image: '', extraData: '0x' }]);
          const data =
            factory.kind === 'uerc20'
              ? metadata
              : encodeAbiParameters(
                  [{ type: 'uint256' }, { type: 'address' }, uerc20MetadataAbi[0]],
                  [BigInt(chainId), address, { description: `${name} — launched with Lumora`, website: '', image: '', extraData: '0x' }],
                );
          const graffiti = toHex(crypto.getRandomValues(new Uint8Array(32)));
          const { result } = await flow.contract(
            'token',
            { address: factory.address, abi: uerc20FactoryAbi, functionName: 'createToken', args: [name.trim(), symbol, 18, parseUnits(supply, 18), address, data, graffiti], chainId },
            { kind: 'Create token', summary: `${name} (${symbol})` },
          );
          tokenAddress = result as Address;
        }

        const client = clientFor(chainId);
        const now = await client.getBlockNumber();
        const startBlock = now + BigInt(Math.max(5, Math.ceil((startMinutes * 60) / config.blockTimeSec)));
        const endBlock = startBlock + BigInt(blocks);
        const configData = encodeAuctionConfig({
          currency: currency.address,
          tokensRecipient: address,
          fundsRecipient: address,
          startBlock,
          endBlock,
          claimBlock: endBlock,
          tickSpacing: configPreview.tickSpacing,
          validationHook: NATIVE,
          floorPrice: configPreview.floorPrice,
          requiredCurrencyRaised: parseUnits(required || '0', currency.decimals),
          auctionStepsData: uniformSteps(blocks),
        });
        const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
        const created = await flow.contract(
          'auction',
          { address: LAUNCHPAD.ccaFactory, abi: ccaFactoryAbi, functionName: 'create', args: [tokenAddress, saleRaw, configData, salt], chainId },
          { kind: 'Launch', summary: `CCA auction for ${tokenSymbol}` },
        );
        auction = created.result as Address;
        saveAuction(chainId, auction);

        await flow.contract('fund', { address: tokenAddress, abi: erc20Abi, functionName: 'transfer', args: [auction, saleRaw], chainId });
        await flow.contract('activate', { address: auction, abi: ccaAbi, functionName: 'onTokensReceived', chainId });
      },
    );

    if (ok && auction) {
      recordActivity({ kind: 'Launch', chainId, summary: `Auction live soon: ${auction}`, account: address });
      toast({ title: 'Auction scheduled', body: `${formatAmount(forSale)} ${tokenSymbol} for sale, starting in ~${startMinutes} min.`, tone: 'success' });
      navigate(appPath('/launches'));
    }
  }

  return (
    <div className="split">
      <section className="panel panel--pad" aria-label="Auction setup">
        <div className="panel__head">
          <h2 className="panel__title">Token</h2>
          <span className="live-badge">
            <i aria-hidden="true" />
            Uniswap CCA · {config.chain.name}
          </span>
        </div>
        <Segmented
          label="Token source"
          options={[
            { value: 'new' as TokenSource, label: 'Create new token' },
            { value: 'existing' as TokenSource, label: 'Use existing token' },
          ]}
          value={source}
          onChange={setSource}
        />
        {source === 'new' ? (
          <div className="form-grid">
            <label>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit Finance" />
            </label>
            <label>
              <span>Symbol</span>
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))} placeholder="ORB" />
            </label>
            <label className="form-grid__wide">
              <span>Total supply (minted to you, 18 decimals)</span>
              <input inputMode="numeric" value={supply} onChange={(e) => setSupply(sanitizeAmount(e.target.value, 0))} />
            </label>
            {!factory && <p className="form-grid__wide inline-warn">{config.chain.name} has no Launchpad token factory. Use an existing token.</p>}
          </div>
        ) : (
          <div className="form-grid">
            <label className="form-grid__wide">
              <span>Token address</span>
              <input value={existing} onChange={(e) => setExisting(e.target.value.trim())} placeholder="0x…" />
            </label>
            {existingToken.data && (
              <p className="form-grid__wide muted small">
                {existingToken.data.symbol} · you hold {formatAmount(Number(formatUnits(existingToken.data.balance, existingToken.data.decimals)))}
              </p>
            )}
          </div>
        )}

        <h2 className="panel__title">Auction</h2>
        <p className="modal__hint">Continuous Clearing Auction: supply is released every block and sold to the highest bids at one clearing price, so timing matters less than valuation.</p>
        <div className="form-grid">
          <label>
            <span>Sold in auction (% of {source === 'new' ? 'supply' : 'your balance'})</span>
            <input inputMode="decimal" value={salePct} onChange={(e) => setSalePct(sanitizeAmount(e.target.value, 2))} />
          </label>
          <label>
            <span>Raise in</span>
            <Segmented
              label="Currency"
              options={[
                { value: 'native' as const, label: config.chain.nativeCurrency.symbol },
                ...(usdc ? [{ value: 'usdc' as const, label: 'USDC' }] : []),
              ]}
              value={currencyKey}
              onChange={setCurrencyKey}
            />
          </label>
          <label>
            <span>
              Floor price ({currency.symbol} per {tokenSymbol})
            </span>
            <input inputMode="decimal" value={floor} onChange={(e) => setFloor(sanitizeAmount(e.target.value, 18))} />
          </label>
          <label>
            <span>Graduation minimum ({currency.symbol}, 0 = none)</span>
            <input inputMode="decimal" value={required} onChange={(e) => setRequired(sanitizeAmount(e.target.value, currency.decimals))} />
          </label>
          <label>
            <span>Starts in · {startMinutes} min</span>
            <input type="range" min={2} max={120} step={1} value={startMinutes} onChange={(e) => setStartMinutes(Number(e.target.value))} />
          </label>
          <label>
            <span>Duration · {hours} hours</span>
            <input type="range" min={1} max={168} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
        </div>
      </section>

      <aside className="panel panel--pad summary" aria-label="Auction preview">
        <h2 className="panel__title">Preview</h2>
        <ReleaseCurve startMinutes={startMinutes} hours={hours} />
        <dl className="quote quote--flat">
          <div>
            <dt>Tokens for sale</dt>
            <dd>
              {formatAmount(forSale)} {tokenSymbol}
            </dd>
          </div>
          <div>
            <dt>Raise at floor</dt>
            <dd>
              {formatAmount(forSale * floorN)} {currency.symbol}
            </dd>
          </div>
          {currency.symbol === 'USDC' && (
            <div>
              <dt>FDV at floor</dt>
              <dd>{formatUsd(supplyN * floorN)}</dd>
            </div>
          )}
          <div>
            <dt>Length</dt>
            <dd>
              {blocks.toLocaleString()} blocks (~{hours}h)
            </dd>
          </div>
          <div>
            <dt>Proceeds & leftovers</dt>
            <dd>to your wallet</dd>
          </div>
        </dl>
        <p className="modal__hint">
          Seeding a Uniswap v4 pool from the proceeds uses the Launchpad’s LBP strategy — do that on{' '}
          <a className="link" href="https://app.uniswap.org/liquidity/launch-auction" target="_blank" rel="noreferrer">
            Uniswap Launch Auction ↗
          </a>{' '}
          or add liquidity afterwards in Create position.
        </p>
        {errors.length > 0 && (
          <ul className="form-errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <FlowSteps steps={flow.steps} error={flow.error} />
        <button type="button" className="cta" disabled={errors.length > 0 || flow.running} onClick={() => void launch()}>
          {flow.running ? 'Working…' : 'Launch auction'}
        </button>
      </aside>
    </div>
  );
}
