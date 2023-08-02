import { Wallet, ethers } from 'ethers';
import { IERC20MetadataAbi } from './abi/IERC20MetadataAbi';
import { provider } from './utils';
import { ERC20Abi } from './abi/ERC20Abi';
import { ERC20TransferResult } from '../types/ERC20TransferResult';
import { SendTxHelper } from './SendTxHelper';
import { FEE_COLLECTOR_ADDRESS } from './constants';

export class ERC20Helper {
  public static async approve(
    tokenAddress: string,
    spenderAddress: string,
    walletAddress: string,
    amount: string, // in hex
    signer: ethers.Wallet
  ) {
    try {
      const ERC20Token = new ethers.Contract(tokenAddress, ERC20Abi, signer);

      const approveTx = await ERC20Token.approve(spenderAddress, amount, {
        from: walletAddress,
      });

      await approveTx.wait();

      console.log('Token transfer approved');
    } catch (error) {
      console.error(error);
    }
  }

  public static async getDecimals(tokenAddress: string) {
    try {
      const iERC20Token = new ethers.Contract(
        tokenAddress,
        IERC20MetadataAbi,
        provider
      );
      const decimals = await iERC20Token.decimals();

      return Number(decimals);
    } catch (error) {
      console.log(error);
      return 0;
    }
  }

  public static async getBalanceOf(
    tokenAddress: string,
    walletAddress: string
  ) {
    try {
      const ERC20Token = new ethers.Contract(tokenAddress, ERC20Abi, provider);

      const balance = await ERC20Token.balanceOf(walletAddress);

      return ethers.BigNumber.from(balance);
    } catch (error) {
      console.error(error);
      return ethers.BigNumber.from(0);
    }
  }

  public static async transfer(
    tokenAddress: string,
    wallet: Wallet,
    recipientAddress: string,
    amountToSend: string
  ): Promise<ERC20TransferResult> {
    try {
      const ERC20Token = new ethers.Contract(tokenAddress, ERC20Abi, wallet);

      const currentGasPrice = ethers.utils.hexlify(
        await provider.getGasPrice()
      );

      const estimatedGas = await ERC20Token.estimateGas.transfer(
        recipientAddress,
        amountToSend
      );

      const tx = await ERC20Token.transfer(recipientAddress, amountToSend, {
        gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
        gasPrice: currentGasPrice,
      });

      if (recipientAddress === FEE_COLLECTOR_ADDRESS) {
        console.log('Collecting ERC20 fee...');
      } else {
        console.log('Sending ERC20 transfer...');
      }

      await tx.wait();

      if (recipientAddress === FEE_COLLECTOR_ADDRESS) {
        console.log('ERC20 fee collected');
      } else {
        console.log('ERC20 transfer sent');
      }

      return {
        transactionHash: tx.hash,
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        transactionHash: '',
        success: false,
      };
    }
  }

  public static async transferETH(
    wallet: Wallet,
    recipientAddress: string,
    amountToSend: ethers.BigNumber
  ): Promise<ERC20TransferResult> {
    try {
      const nonce = await wallet.getTransactionCount();
      const currentGasPrice = ethers.utils.hexlify(
        await provider.getGasPrice()
      );
      const estimatedGas = await provider.estimateGas({
        from: wallet.address,
        to: recipientAddress,
        value: amountToSend,
        nonce: nonce,
      });

      const transaction = {
        from: wallet.address,
        to: recipientAddress,
        value: amountToSend,
        nonce: nonce,
        gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
        gasPrice: currentGasPrice,
      };

      if (recipientAddress === FEE_COLLECTOR_ADDRESS) {
        console.log('Collecting ETH fee...');
      } else {
        console.log('Sending ETH transfer...');
      }

      const tx = await wallet.sendTransaction(transaction);
      await tx.wait();

      if (recipientAddress === FEE_COLLECTOR_ADDRESS) {
        console.log('ETH fee collected');
      } else {
        console.log('ETH transfer sent');
      }

      return {
        transactionHash: tx.hash,
        success: true,
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        transactionHash: '',
      };
    }
  }
}
