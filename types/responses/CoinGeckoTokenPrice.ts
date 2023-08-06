export type CoinGeckoTokenPrice = {
  [key: string]: {
    usd: number;
    usd_market_cap: number;
  };
};
