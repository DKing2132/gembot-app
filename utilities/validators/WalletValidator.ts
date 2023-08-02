import { ethers } from 'ethers';
import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { User } from '@prisma/client';

export class WalletValidator {
  public static validateUserWalletAddress(
    walletAddress: string,
    user: User
  ): ValidatorResult {
    if (walletAddress === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Wallet is the empty address',
      };
    }

    if (
      user.wallet1 !== walletAddress &&
      user.wallet2 !== walletAddress &&
      user.wallet3 !== walletAddress
    ) {
      return {
        valid: false,
        message: 'User does not own the wallet or it does not exist',
      };
    }

    return {
      valid: true,
    };
  }

  public static validateWalletAddress(
    walletAddress: string
  ): ValidatorResult {
    if (walletAddress === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Wallet is the empty address',
      };
    }

    if (!ethers.utils.isAddress(walletAddress)) {
      return {
        valid: false,
        message: 'Wallet is not a valid address',
      };
    }

    return {
      valid: true,
    };
  }
}
