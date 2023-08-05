export type BuyRequestBody = {
  walletOwnerAddress: string;
  depositedTokenAddress: string;
  desiredTokenAddress: string;
  depositedTokenAmount: number;
  isNativeETH: boolean;
  orderId?: string;
};
