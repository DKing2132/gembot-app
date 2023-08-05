import { WETH } from '@uniswap/sdk';
import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { CHAINID } from '../constants';

export class NativeETHValidator {
  public static async validateNativeETH(
    isNativeETH: boolean,
    depositedTokenAddress: string,
    desiredTokenAddress: string
  ): Promise<ValidatorResult> {
    // check that if isNativeETH is true that either of deposited or desired token is WETH
    if (isNativeETH) {
      if (
        depositedTokenAddress !== WETH[CHAINID].address &&
        desiredTokenAddress !== WETH[CHAINID].address
      ) {
        return {
          valid: false,
          message:
            'If isNativeETH is true, either deposited or desired token must be WETH',
        };
      }
    }

    return {
      valid: true,
    };
  }

  public static async validateNativeETHWithdrawal(
    isNativeETH: boolean,
    tokenToWithdrawAddress: string
  ): Promise<ValidatorResult> {
    // check that if isNativeETH is true that tokenToWithdraw is WETH
    if (isNativeETH) {
      if (tokenToWithdrawAddress !== WETH[CHAINID].address) {
        return {
          valid: false,
          message: 'This token is not native ETH, please review your order',
        };
      }
    }

    return {
      valid: true,
    };
  }
}
