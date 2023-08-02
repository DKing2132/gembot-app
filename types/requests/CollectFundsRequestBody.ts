export type CollectFundsRequestBody = {
  tokenToWithdrawAddress: string;
  tokenToWithdrawAmount: number;
  walletOwnerAddress: string;
  isNativeETH: boolean;
};
