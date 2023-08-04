export type OrderStatusHistoryResponse = {
  wallet1Orders: OrderStatusTrack[];
  wallet2Orders: OrderStatusTrack[];
  wallet3Orders: OrderStatusTrack[];
};

export type OrderStatusTrack = {
  orderId: string;
  status: string;
  depositTokenAddress: string;
  desiredTokenAddress: string;
  depositTokenAmount: number;
  lastUpdatedAt: Date;
  nextUpdateAt: Date;
  unitOfTime: string;
  frequency: number;
  walletOwnerAddress: string;
  message: string;
};
