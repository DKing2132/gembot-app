import { Link, User } from '@prisma/client';
import { CollectFundsRequestBody } from '../types/requests/CollectFundsRequestBody';
import { CollectFundsResponse } from '../types/responses/CollectFundsResponse';
import { decrypt, iv } from './decrypt';
import { ethers } from 'ethers';
import { provider } from './utils';
import { ERC20Helper } from './ERC20Helper';

export class SendTxHelper {
  public static async sendTx(
    user: User,
    link: Link,
    collectOrderBody: CollectFundsRequestBody
  ): Promise<CollectFundsResponse> {
    let walletPrivateKey: string;
    if (collectOrderBody.walletOwnerAddress === user.wallet1) {
      walletPrivateKey = decrypt({
        iv: iv.toString('hex'),
        encryptedData: user.wallet1PrivateKey,
      });
    } else if (collectOrderBody.walletOwnerAddress === user.wallet2) {
      walletPrivateKey = decrypt({
        iv: iv.toString('hex'),
        encryptedData: user.wallet2PrivateKey,
      });
    } else if (collectOrderBody.walletOwnerAddress === user.wallet3) {
      walletPrivateKey = decrypt({
        iv: iv.toString('hex'),
        encryptedData: user.wallet3PrivateKey,
      });
    } else {
      walletPrivateKey = '';
    }

    const wallet = new ethers.Wallet(walletPrivateKey, provider);

    if (collectOrderBody.isNativeETH) {
      const amountToSend = ethers.utils.parseEther(
        collectOrderBody.tokenToWithdrawAmount.toString()
      );

      try {
        const nonce = await wallet.getTransactionCount();
        const currentGasPrice = ethers.utils.hexlify(
          await provider.getGasPrice()
        );
        const estimatedGas = await provider.estimateGas({
          from: wallet.address,
          to: link.walletAddress,
          value: amountToSend,
          nonce: nonce,
        });

        const transaction = {
          from: wallet.address,
          to: link.walletAddress,
          value: amountToSend,
          nonce: nonce,
          gasLimit: this.getGasLimitWithBuffer(estimatedGas),
          gasPrice: currentGasPrice,
        };

        const tx = await wallet.sendTransaction(transaction);
        await tx.wait();

        return {
          message: 'Transaction Sent!',
          transactionHash: tx.hash,
          success: true,
        };
      } catch (error) {
        console.log(error);
        return {
          message: 'Transaction Failed',
          success: false,
          transactionHash: '',
        };
      }
    } else {
      const tokenDecimals = await ERC20Helper.getDecimals(
        collectOrderBody.tokenToWithdrawAddress
      );

      const amountToSend = ethers.utils.parseUnits(
        collectOrderBody.tokenToWithdrawAmount
          .toFixed(tokenDecimals)
          .toString(),
        tokenDecimals
      );

      const transferResult = await ERC20Helper.transfer(
        collectOrderBody.tokenToWithdrawAddress,
        wallet,
        link.walletAddress,
        amountToSend.toHexString()
      );
      if (transferResult.success) {
        return {
          message: 'Transaction Sent!',
          transactionHash: transferResult.transactionHash,
          success: true,
        };
      } else {
        return {
          message: 'Transaction Failed',
          success: false,
          transactionHash: '',
        };
      }
    }
  }

  public static getGasLimitWithBuffer(gasLimit: ethers.BigNumber) {
    console.log('Estimated Gas Limit: ', gasLimit.toString());
    // 110 is 10% buffer over the estimated gas limit
    return gasLimit.mul(Number(process.env.GAS_BUFFER)).div(100);
  }
}
