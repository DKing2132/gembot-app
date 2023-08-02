import { Token } from '@uniswap/sdk';
import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { ERC20Helper } from '../ERC20Helper';
import { BigNumber, ethers } from 'ethers';
import { provider } from '../utils';
import { prisma } from '../constants';

export class AmountValidator {
  public static async validateAmountForUser(
    tokenAmount: number,
    token: Token,
    walletAddress: string,
    isNativeETH: boolean,
    orderId?: string
  ): Promise<ValidatorResult> {
    const decimals = token.decimals;
    const amountInCorrectUnits = ethers.utils.parseUnits(
      tokenAmount.toFixed(decimals).toString(),
      decimals
    );

    let balance: BigNumber;

    if (isNativeETH) {
      // get wallet eth balance
      balance = ethers.BigNumber.from(await provider.getBalance(walletAddress));
      console.log('ETH balance: ', balance.toString());
    } else {
      balance = await ERC20Helper.getBalanceOf(token.address, walletAddress);
      console.log(`ERC20 ${token.address} balance: `, balance.toString());
    }

    // get all other orders for this same wallet with the same token and remove from balance
    const orders = await prisma.order.findMany({
      where: {
        walletOwnerAddress: walletAddress,
        depositedTokenAddress: token.address,
      },
    });

    for (const order of orders) {
      // need this so that DCA orders don't get removed from balance
      // for their own orders
      if (
        orderId === undefined ||
        (orderId !== undefined && order.orderId !== orderId)
      ) {
        console.log('existing order: ', order);
        console.log(
          'order amount: ',
          ethers.utils
            .parseUnits(
              order.depositedTokenAmount.toFixed(token.decimals).toString(),
              token.decimals
            )
            .toString()
        );
        balance = balance.sub(
          ethers.utils.parseUnits(
            order.depositedTokenAmount.toFixed(token.decimals).toString(),
            token.decimals
          )
        );
      }
    }

    console.log('balance after removing existing orders: ', balance.toString());
    console.log('amount in correct units: ', amountInCorrectUnits.toString());

    if (balance.lt(amountInCorrectUnits)) {
      return {
        valid: false,
        message: 'User does not have enough balance to make this order.',
      };
    }

    return {
      valid: true,
    };
  }
}
