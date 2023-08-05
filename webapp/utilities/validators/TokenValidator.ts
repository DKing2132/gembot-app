import { ethers } from 'ethers';
import { TokenValidatorResult } from '../../types/validators/TokenValidatorResult';
import { SingleTokenValidatorResult } from '../../types/validators/SingleTokenValidatorResult';
import { UniswapV2Helper } from '../UniswapHelper';

export class TokenValidator {
  public static async validateTokens(
    depositedTokenAddress: string,
    desiredTokenAddress: string
  ): Promise<TokenValidatorResult> {
    if (depositedTokenAddress === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Deposited token is the empty address',
      };
    }

    if (desiredTokenAddress === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Desired token is the empty address',
      };
    }

    if (depositedTokenAddress === desiredTokenAddress) {
      return {
        valid: false,
        message: 'Deposited token and desired token are the same',
      };
    }

    // check that uniswap is able to retrieve the tokens
    const depositedToken = await UniswapV2Helper.getToken(
      depositedTokenAddress
    );

    if (depositedToken.address === ethers.constants.AddressZero) {
      return {
        valid: false,
        message:
          'Uniswap does not contain information about given deposited token.',
      };
    }

    const desiredToken = await UniswapV2Helper.getToken(desiredTokenAddress);

    if (desiredToken.address === ethers.constants.AddressZero) {
      return {
        valid: false,
        message:
          'Uniswap does not contain information about given desired token.',
      };
    }

    return {
      valid: true,
      depositedToken,
      desiredToken,
    };
  }

  public static async validateToken(
    tokenAddress: string
  ): Promise<SingleTokenValidatorResult> {
    if (tokenAddress === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Token is the empty address',
      };
    }

    const token = await UniswapV2Helper.getToken(tokenAddress);

    if (token.address === ethers.constants.AddressZero) {
      return {
        valid: false,
        message: 'Uniswap does not contain information about given token.',
      };
    }

    return {
      valid: true,
      token,
    };
  }
}
