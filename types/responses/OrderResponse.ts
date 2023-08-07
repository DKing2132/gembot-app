export type OrderResponse = {
  orderID?: string;
  walletOwnerAddress: string;
  depositedTokenAddress: string;
  desiredTokenAddress: string;
  depositedTokenAmount: number;
  isNativeETH: boolean;
  unitOfTime: string;
  frequency: number;
  isLimitOrder?: boolean;
  marketCapTarget?: number;
};
