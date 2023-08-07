export type OrderStatusHistoryResponse = {
  wallet1Orders: OrderStatusTrack[];
  wallet2Orders: OrderStatusTrack[];
  wallet3Orders: OrderStatusTrack[];
};

export type OrderStatusTrack = {
  orderId: string;
  status: string;
  depositedTokenAddress: string;
  desiredTokenAddress: string;
  depositedTokenAmount: number;
  lastUpdatedAt: string;
  nextUpdateAt: string;
  unitOfTime: string;
  frequency: number;
  walletOwnerAddress: string;
  message: string;
  isNativeETH: boolean;
  isLimitOrder?: boolean;
  marketCapTarget?: string;
};
