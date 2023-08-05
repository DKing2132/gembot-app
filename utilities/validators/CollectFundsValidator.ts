import { WETH } from '@uniswap/sdk';
import { CollectFundsRequestBody } from '../../types/requests/CollectFundsRequestBody';
import { AmountValidator } from './AmountValidator';
import { NativeETHValidator } from './NativeETHValidator';
import { TokenValidator } from './TokenValidator';
import { UserValidator } from './UserValidator';
import { WalletValidator } from './WalletValidator';
import { CHAINID } from '../constants';
import { LinkValidator } from './LinkValidator';
import { CollectFundsValidatorResult } from '../../types/validators/CollectFundsValidatorResult';

export class CollectFundsValidator {
  public static async validateCollectFunds(
    userId: string,
    collectOrderBody: CollectFundsRequestBody
  ): Promise<CollectFundsValidatorResult> {
    const userValidation = await UserValidator.validateUserExists(userId);
    if (!userValidation.valid) {
      return {
        valid: false,
        message: userValidation.message,
      };
    }

    const walletValidation = WalletValidator.validateUserWalletAddress(
      collectOrderBody.walletOwnerAddress,
      userValidation.user!
    );
    if (!walletValidation.valid) {
      return {
        valid: false,
        message: walletValidation.message,
      };
    }

    const linkValidation = await LinkValidator.validateHasLink(userId);
    if (!linkValidation.valid) {
      return {
        valid: false,
        message: linkValidation.message,
      };
    }

    const tokenValidation = await TokenValidator.validateToken(
      collectOrderBody.tokenToWithdrawAddress
    );
    if (!tokenValidation.valid) {
      return {
        valid: false,
        message: tokenValidation.message,
      };
    }

    const nativeETHValidation =
      await NativeETHValidator.validateNativeETHWithdrawal(
        collectOrderBody.isNativeETH,
        collectOrderBody.tokenToWithdrawAddress
      );
    if (!nativeETHValidation.valid) {
      return {
        valid: false,
        message: nativeETHValidation.message,
      };
    }

    const amountValidation = await AmountValidator.validateAmountForUser(
      collectOrderBody.tokenToWithdrawAmount,
      tokenValidation.token!,
      collectOrderBody.walletOwnerAddress,
      collectOrderBody.isNativeETH &&
        collectOrderBody.tokenToWithdrawAddress === WETH[CHAINID].address
    );
    if (!amountValidation.valid) {
      return {
        valid: false,
        message: amountValidation.message,
      };
    }

    return {
      valid: true,
      user: userValidation.user!,
      link: linkValidation.link!,
    };
  }
}
