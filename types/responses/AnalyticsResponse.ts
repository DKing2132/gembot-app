export type AnalyticsResponse = {
  buyCount: number;
  sellCount: number;
  orderStatusChecks: number;
  activeOrderChecks: number;
  ordersCreated: number;
  ordersUpdated: number;
  ordersDeleted: number;
  buyTxFailures: number;
  buyTxSuccesses: number;
  sellTxFailures: number;
  sellTxSuccesses: number;
  tokens: TokenAnalytics[];
};

export type TokenAnalytics = {
  address: string;
  name: string;
  symbol: string;
  totalVolume: number;
  searchCount: number;
};
