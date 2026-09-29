import { parseAbi, parseAbiItem } from 'viem';

// Uniswap Continuous Clearing Auction v2.1.0
// https://github.com/Uniswap/continuous-clearing-auction/tree/v2.1.0/src/interfaces

export const ccaAbi = parseAbi([
  'function token() view returns (address)',
  'function currency() view returns (address)',
  'function totalSupply() view returns (uint128)',
  'function startBlock() view returns (uint64)',
  'function endBlock() view returns (uint64)',
  'function claimBlock() view returns (uint64)',
  'function floorPrice() view returns (uint256)',
  'function tickSpacing() view returns (uint256)',
  'function clearingPrice() view returns (uint256)',
  'function currencyRaised() view returns (uint256)',
  'function totalCleared() view returns (uint256)',
  'function isGraduated() view returns (bool)',
  'function fundsRecipient() view returns (address)',
  'function MAX_BID_PRICE() view returns (uint256)',
  'function bids(uint256 bidId) view returns ((uint64 startBlock, uint24 startCumulativeMps, uint64 exitedBlock, uint256 maxPrice, address owner, uint256 amountQ96, uint256 tokensFilled))',
  'function submitBid(uint256 maxPriceQ96, uint128 amount, address owner, bytes hookData) payable returns (uint256)',
  'function exitBid(uint256 bidId)',
  'function claimTokens(uint256 bidId)',
  'function onTokensReceived()',
  'event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount)',
]);

export const ccaFactoryAbi = parseAbi([
  'function create(address token, uint256 amount, bytes configData, bytes32 salt) returns (address)',
  'function getAddress(address token, uint256 amount, bytes configData, bytes32 salt, address sender) view returns (address)',
]);

export const auctionCreatedEvent = parseAbiItem('event AuctionCreated(address indexed auction, address indexed token, uint256 amount, bytes configData)');
export const bidSubmittedEvent = parseAbiItem('event BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount)');

// struct AuctionParameters (abi-encoded as the factory's configData)
export const auctionParametersAbi = [
  {
    type: 'tuple',
    components: [
      { name: 'currency', type: 'address' },
      { name: 'tokensRecipient', type: 'address' },
      { name: 'fundsRecipient', type: 'address' },
      { name: 'startBlock', type: 'uint64' },
      { name: 'endBlock', type: 'uint64' },
      { name: 'claimBlock', type: 'uint64' },
      { name: 'tickSpacing', type: 'uint256' },
      { name: 'validationHook', type: 'address' },
      { name: 'floorPrice', type: 'uint256' },
      { name: 'requiredCurrencyRaised', type: 'uint128' },
      { name: 'auctionStepsData', type: 'bytes' },
    ],
  },
] as const;

// Launchpad token factories (UERC20 / Superchain USUPERC20)
export const uerc20FactoryAbi = parseAbi([
  'function createToken(string name, string symbol, uint8 decimals, uint256 initialSupply, address recipient, bytes data, bytes32 graffiti) returns (address)',
]);

export const uerc20MetadataAbi = [
  { type: 'tuple', components: [{ name: 'description', type: 'string' }, { name: 'website', type: 'string' }, { name: 'image', type: 'string' }, { name: 'extraData', type: 'bytes' }] },
] as const;

export const permit2Abi = parseAbi([
  'function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
]);
