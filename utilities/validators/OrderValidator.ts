import { OrderRequestBody } from '../../types/requests/OrderRequestBody';
import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { UserValidator } from './UserValidator';
import { WalletValidator } from './WalletValidator';
import { TokenValidator } from './TokenValidator';
import { AmountValidator } from './AmountValidator';
import { NativeETHValidator } from './NativeETHValidator';
import { UnitOfTimeValidator } from './UnitOfTimeValidator';
import { FrequencyValidator } from './FrequencyValidator';
import { UpdateOrderRequestBody } from '../../types/requests/UpdateOrderRequestBody';
import { UpdateOrderValidatorResult } from '../../types/validators/UpdateOrderValidatorResult';
import { UsersOwnsOrderValidatorResult } from '../../types/validators/UsersOwnsOrderValidatorResult';
import { WETH } from '@uniswap/sdk';
import { BuyRequestBody } from '../../types/requests/BuyRequestBody';
import { BuyOrderValidatorResult } from '../../types/validators/BuyOrderValidatorResult';
import { CHAINID, prisma } from '../constants';
import { SellRequestBody } from '../../types/requests/SellRequestBody';
import { SellOrderValidatorResult } from '../../types/validators/SellOrderValidatorResult';

export class OrderValidator {
  public static async validateOrderToCreate(
    userId: string,
    order: OrderRequestBody
  ): Promise<ValidatorResult> {
    const userValidation = await UserValidator.validateUserExists(userId);
    if (!userValidation.valid) {
      return {
        valid: false,
        message: userValidation.message,
      };
    }

    const walletValidation = WalletValidator.validateUserWalletAddress(
      order.walletOwnerAddress,
      userValidation.user!
    );
    if (!walletValidation.valid) {
      return {
        valid: false,
        message: walletValidation.message,
      };
    }

    const tokenValidation = await TokenValidator.validateTokens(
      order.depositedTokenAddress,
      order.desiredTokenAddress
    );
    if (!tokenValidation.valid) {
      return {
        valid: false,
        message: tokenValidation.message,
      };
    }

    const nativeETHValidation = await NativeETHValidator.validateNativeETH(
      order.isNativeETH,
      order.depositedTokenAddress,
      order.desiredTokenAddress
    );
    if (!nativeETHValidation.valid) {
      return {
        valid: false,
        message: nativeETHValidation.message,
      };
    }

    const amountValidation = await AmountValidator.validateAmountForUser(
      order.depositedTokenAmount,
      tokenValidation.depositedToken!,
      order.walletOwnerAddress,
      order.isNativeETH && order.depositedTokenAddress === WETH[CHAINID].address
    );
    if (!amountValidation.valid) {
      return {
        valid: false,
        message: amountValidation.message,
      };
    }

    const unitOfTimeValidation = UnitOfTimeValidator.validateUnitOfTime(
      order.unitOfTime
    );
    if (!unitOfTimeValidation.valid) {
      return {
        valid: false,
        message: unitOfTimeValidation.message,
      };
    }

    const frequencyValidation = FrequencyValidator.validateFrequency(
      order.frequency
    );
    if (!frequencyValidation.valid) {
      return {
        valid: false,
        message: frequencyValidation.message,
      };
    }

    if (order.isLimitOrder) {
      if (!order.marketCapTarget) {
        return {
          valid: false,
          message: 'Market cap target must be specified for limit orders',
        };
      }

      if (order.marketCapTarget <= 0) {
        return {
          valid: false,
          message: 'Market cap target must be greater than 0',
        };
      }
    } else {
      if (order.marketCapTarget) {
        return {
          valid: false,
          message: 'Market cap target cannot be specified for non-limit orders',
        };
      }
    }

    return {
      valid: true,
    };
  }

  public static async validateUserOwnsOrder(
    userId: string,
    orderId: string
  ): Promise<UsersOwnsOrderValidatorResult> {
    // check if the user owns the order
    const userValidation = await UserValidator.validateUserExists(userId);
    if (!userValidation.valid) {
      return {
        valid: false,
        message: userValidation.message,
      };
    }

    const order = await prisma.order.findUnique({
      where: {
        orderId: orderId,
        userId: userId,
      },
    });

    if (!order) {
      console.log('user does not own order');
      return {
        valid: false,
        message: 'Order does not exist.',
      };
    }

    return {
      valid: true,
      order: order,
    };
  }

  public static async validateOrderToUpdate(
    userId: string,
    updateRequest: UpdateOrderRequestBody
  ): Promise<UpdateOrderValidatorResult> {
    let removeIsNativeETH = false;
    const userOwnsOrderValidation = await OrderValidator.validateUserOwnsOrder(
      userId,
      updateRequest.orderID
    );
    if (!userOwnsOrderValidation.valid) {
      return {
        valid: false,
        message: userOwnsOrderValidation.message,
      };
    }

    if (updateRequest.field === 'depositedTokenAmount') {
      if (typeof updateRequest.value !== 'number') {
        return {
          valid: false,
          message: 'Value must be a number.',
        };
      }

      const tokenValidation = await TokenValidator.validateToken(
        userOwnsOrderValidation.order!.depositedTokenAddress
      );
      if (!tokenValidation.valid) {
        return {
          valid: false,
          message: tokenValidation.message,
        };
      }

      const amountValidation = await AmountValidator.validateAmountForUser(
        updateRequest.value,
        tokenValidation.token!,
        userOwnsOrderValidation.order!.walletOwnerAddress,
        userOwnsOrderValidation.order!.isNativeETH &&
          userOwnsOrderValidation.order!.depositedTokenAddress ===
            WETH[CHAINID].address
      );
      if (!amountValidation.valid) {
        return {
          valid: false,
          message: amountValidation.message,
        };
      }
    } else if (updateRequest.field === 'desiredToken') {
      if (typeof updateRequest.value !== 'string') {
        return {
          valid: false,
          message: 'Value must be a string.',
        };
      }

      const tokenValidation = await TokenValidator.validateToken(
        updateRequest.value
      );
      if (!tokenValidation.valid) {
        return {
          valid: false,
          message: tokenValidation.message,
        };
      }

      if (
        userOwnsOrderValidation.order!.isNativeETH &&
        userOwnsOrderValidation.order?.desiredTokenAddress ===
          WETH[CHAINID].address
      ) {
        removeIsNativeETH = true;
      }
    } else if (updateRequest.field === 'frequency') {
      if (typeof updateRequest.value !== 'number') {
        return {
          valid: false,
          message: 'Value must be a number.',
        };
      }

      const frequencyValidation = FrequencyValidator.validateFrequency(
        updateRequest.value
      );
      if (!frequencyValidation.valid) {
        return {
          valid: false,
          message: frequencyValidation.message,
        };
      }
    } else if (updateRequest.field === 'unitOfTime') {
      if (typeof updateRequest.value !== 'string') {
        return {
          valid: false,
          message: 'Value must be a string.',
        };
      }

      const unitOfTimeValidation = UnitOfTimeValidator.validateUnitOfTime(
        updateRequest.value
      );
      if (!unitOfTimeValidation.valid) {
        return {
          valid: false,
          message: unitOfTimeValidation.message,
        };
      }
    } else if (updateRequest.field === 'marketCapTarget') {
      if (!updateRequest.isLimitOrder) {
        return {
          valid: false,
          message: 'Cannot update market cap target for non-limit orders.',
        };
      }
      if (typeof updateRequest.value !== 'number') {
        return {
          valid: false,
          message: 'Value must be a number.',
        };
      }

      if (updateRequest.value <= 0) {
        return {
          valid: false,
          message: 'Value must be greater than 0.',
        };
      }
    } else {
      return {
        valid: false,
        message: 'Field is not a valid field to update.',
      };
    }

    return {
      valid: true,
      removeIsNativeETH: removeIsNativeETH,
      fieldToUpdate: updateRequest.field,
      value: updateRequest.value,
    };
  }

  public static async validateBuyOrder(
    userId: string,
    buyOrder: BuyRequestBody
  ): Promise<BuyOrderValidatorResult> {
    try {
      const userValidation = await UserValidator.validateUserExists(userId);
      if (!userValidation.valid) {
        return {
          valid: false,
          message: userValidation.message,
        };
      }

      const walletValidation = WalletValidator.validateUserWalletAddress(
        buyOrder.walletOwnerAddress,
        userValidation.user!
      );
      if (!walletValidation.valid) {
        return {
          valid: false,
          message: walletValidation.message,
        };
      }

      const tokenValidation = await TokenValidator.validateTokens(
        buyOrder.depositedTokenAddress,
        buyOrder.desiredTokenAddress
      );
      if (!tokenValidation.valid) {
        return {
          valid: false,
          message: tokenValidation.message,
        };
      }

      const nativeETHValidation = await NativeETHValidator.validateNativeETH(
        buyOrder.isNativeETH,
        buyOrder.depositedTokenAddress,
        buyOrder.desiredTokenAddress
      );
      if (!nativeETHValidation.valid) {
        return {
          valid: false,
          message: nativeETHValidation.message,
        };
      }

      const amountValidation = await AmountValidator.validateAmountForUser(
        buyOrder.depositedTokenAmount,
        tokenValidation.depositedToken!,
        buyOrder.walletOwnerAddress,
        buyOrder.isNativeETH &&
          buyOrder.depositedTokenAddress === WETH[CHAINID].address,
        buyOrder.orderId
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
      };
    } catch (err) {
      console.log(err);
      return {
        valid: false,
        message: 'An error occurred while validating the buy order.',
      };
    }
  }

  public static async validateSellOrder(
    userId: string,
    sellOrder: SellRequestBody
  ): Promise<SellOrderValidatorResult> {
    try {
      const userValidation = await UserValidator.validateUserExists(userId);
      if (!userValidation.valid) {
        return {
          valid: false,
          message: userValidation.message,
        };
      }

      const walletValidation = WalletValidator.validateUserWalletAddress(
        sellOrder.walletOwnerAddress,
        userValidation.user!
      );
      if (!walletValidation.valid) {
        return {
          valid: false,
          message: walletValidation.message,
        };
      }

      const tokenValidation = await TokenValidator.validateTokens(
        sellOrder.depositedTokenAddress,
        sellOrder.desiredTokenAddress
      );
      if (!tokenValidation.valid) {
        return {
          valid: false,
          message: tokenValidation.message,
        };
      }

      const nativeETHValidation = await NativeETHValidator.validateNativeETH(
        sellOrder.isNativeETH,
        sellOrder.depositedTokenAddress,
        sellOrder.desiredTokenAddress
      );

      if (!nativeETHValidation.valid) {
        return {
          valid: false,
          message: nativeETHValidation.message,
        };
      }

      const amountValidation = await AmountValidator.validateAmountForUser(
        sellOrder.depositedTokenAmount,
        tokenValidation.depositedToken!,
        sellOrder.walletOwnerAddress,
        sellOrder.isNativeETH &&
          sellOrder.depositedTokenAddress === WETH[CHAINID].address,
        sellOrder.orderId
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
      };
    } catch (err) {
      console.log(err);
      return {
        valid: false,
        message: 'An error occurred while validating the sell order.',
      };
    }
  }
}
