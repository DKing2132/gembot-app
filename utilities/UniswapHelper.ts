import {
  Fetcher,
  Pair,
  Percent,
  Route,
  Token,
  TokenAmount,
  Trade,
  TradeType,
  WETH,
} from '@uniswap/sdk';
import { provider } from './utils';
import { ethers } from 'ethers';
import { BuyRequestBody } from '../types/requests/BuyRequestBody';
import { UniswapV2RouterABI } from './abi/UniswapV2RouterAbi';
import { User } from '@prisma/client';
import { decrypt, iv } from './decrypt';
import { ExecuteTransactionResponse } from '../types/responses/ExecuteTransactionResponse';
import {
  BUY_SELL_FEE as BUY_SELL_FEE_PERCENTAGE,
  CHAINID,
  FEE_COLLECTOR_ADDRESS,
  SLIPPAGE,
} from './constants';
import { ERC20Helper } from './ERC20Helper';
import { SellRequestBody } from '../types/requests/SellRequestBody';
import { SendTxHelper } from './SendTxHelper';
import { UniswapV2PairABI } from './abi/UniswapV2PairAbi';

export class UniswapV2Helper {
  public static async getToken(tokenAddress: string) {
    try {
      const token = await Fetcher.fetchTokenData(
        CHAINID,
        tokenAddress,
        provider
      );
      return token;
    } catch (err) {
      console.log(err);
      return new Token(CHAINID, ethers.constants.AddressZero, 0);
    }
  }

  public static async executeTransaction(
    user: User,
    orderToExecute: BuyRequestBody | SellRequestBody,
    type: 'buy' | 'sell'
  ): Promise<ExecuteTransactionResponse> {
    try {
      const depositedToken = await Fetcher.fetchTokenData(
        CHAINID,
        orderToExecute.depositedTokenAddress,
        provider
      );

      const desiredToken = await Fetcher.fetchTokenData(
        CHAINID,
        orderToExecute.desiredTokenAddress,
        provider
      );

      let walletPrivateKey: string;
      if (orderToExecute.walletOwnerAddress === user.wallet1) {
        walletPrivateKey = decrypt({
          iv: iv.toString('hex'),
          encryptedData: user.wallet1PrivateKey,
        });
      } else if (orderToExecute.walletOwnerAddress === user.wallet2) {
        walletPrivateKey = decrypt({
          iv: iv.toString('hex'),
          encryptedData: user.wallet2PrivateKey,
        });
      } else if (orderToExecute.walletOwnerAddress === user.wallet3) {
        walletPrivateKey = decrypt({
          iv: iv.toString('hex'),
          encryptedData: user.wallet3PrivateKey,
        });
      } else {
        walletPrivateKey = '';
      }

      const signer = new ethers.Wallet(walletPrivateKey, provider);

      const pairAddress = Pair.getAddress(depositedToken, desiredToken);
      console.log(
        `Pair address: ${pairAddress} for ${depositedToken.address} and ${desiredToken.address}`
      );
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          success: false,
          message: 'Pair does not exist in Uniswap',
          transactionHash: '',
        };
      }

      const UniswapV2Pair = new ethers.Contract(
        pairAddress,
        UniswapV2PairABI,
        signer
      );

      const reserves = await UniswapV2Pair.getReserves();

      const [reserve0, reserve1] = reserves;
      const tokens = [depositedToken, desiredToken];
      const [token0, token1] = tokens[0].sortsBefore(tokens[1])
        ? tokens
        : [tokens[1], tokens[0]];
      const pair = new Pair(
        new TokenAmount(token0, reserve0),
        new TokenAmount(token1, reserve1)
      );

      const route = new Route([pair], depositedToken);

      const amount = ethers.utils.parseUnits(
        orderToExecute.depositedTokenAmount
          .toFixed(depositedToken.decimals)
          .toString(),
        depositedToken.decimals
      );

      // take 1% from amount as a fee
      let fee: ethers.BigNumber = ethers.BigNumber.from(0);
      let trade: Trade;
      if (type === 'buy') {
        fee = amount.mul(Number(BUY_SELL_FEE_PERCENTAGE)).div(100);
        console.log(`Fee: ${fee.toString()}`);
        const amountWithFee = amount.sub(fee);
        console.log(`Amount with fee: ${amountWithFee.toString()}`);
        trade = new Trade(
          route,
          new TokenAmount(depositedToken, amountWithFee.toBigInt()),
          TradeType.EXACT_INPUT
        );
      } else {
        trade = new Trade(
          route,
          new TokenAmount(depositedToken, amount.toBigInt()),
          TradeType.EXACT_INPUT
        );
      }

      const slippageTolerance = new Percent(SLIPPAGE, '10000'); // slippage is in bps
      const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw; // needs to be converted to e.g. hex
      console.log(`Amount out min: ${amountOutMin.toString()}`);
      if (type === 'sell') {
        fee = ethers.BigNumber.from(amountOutMin.toString())
          .mul(Number(BUY_SELL_FEE_PERCENTAGE))
          .div(100)
          .mul(10000 + Number(SLIPPAGE))
          .div(10000);
        console.log(`Fee: ${fee.toString()}`);
      }
      const amountOutMinHex = ethers.BigNumber.from(
        amountOutMin.toString()
      ).toHexString();
      const path = [depositedToken.address, desiredToken.address];
      const to = orderToExecute.walletOwnerAddress;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
      const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
      const valueHex = ethers.BigNumber.from(value.toString()).toHexString();

      const currentGasPrice = ethers.utils.hexlify(
        await provider.getGasPrice()
      );

      const UniswapV2Router = new ethers.Contract(
        process.env.UNISWAP_V2_ROUTER_ADDRESS!,
        UniswapV2RouterABI,
        signer
      );

      let tx;
      if (
        orderToExecute.isNativeETH &&
        depositedToken.address === WETH[CHAINID].address
      ) {
        const estimatedGas =
          await UniswapV2Router.estimateGas.swapExactETHForTokens(
            amountOutMinHex,
            path,
            to,
            deadline,
            { value: valueHex }
          );

        tx = await UniswapV2Router.swapExactETHForTokens(
          amountOutMinHex,
          path,
          to,
          deadline,
          {
            value: valueHex,
            gasPrice: currentGasPrice,
            gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
          }
        );
      } else if (
        orderToExecute.isNativeETH &&
        desiredToken.address === WETH[CHAINID].address
      ) {
        await ERC20Helper.approve(
          depositedToken.address,
          process.env.UNISWAP_V2_ROUTER_ADDRESS!,
          orderToExecute.walletOwnerAddress,
          valueHex,
          signer
        );

        const estimatedGas =
          await UniswapV2Router.estimateGas.swapExactTokensForETH(
            valueHex,
            amountOutMinHex,
            path,
            to,
            deadline
          );

        tx = await UniswapV2Router.swapExactTokensForETH(
          valueHex,
          amountOutMinHex,
          path,
          to,
          deadline,
          {
            gasPrice: currentGasPrice,
            gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
          }
        );
      } else {
        await ERC20Helper.approve(
          depositedToken.address,
          process.env.UNISWAP_V2_ROUTER_ADDRESS!,
          orderToExecute.walletOwnerAddress,
          valueHex,
          signer
        );

        const estimatedGas =
          await UniswapV2Router.estimateGas.swapExactTokensForTokens(
            valueHex,
            amountOutMinHex,
            path,
            to,
            deadline
          );

        tx = await UniswapV2Router.swapExactTokensForTokens(
          valueHex,
          amountOutMinHex,
          path,
          to,
          deadline,
          {
            gasPrice: currentGasPrice,
            gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
          }
        );
      }

      await tx.wait();

      // take the fee
      if (type === 'buy') {
        if (
          orderToExecute.depositedTokenAddress === WETH[CHAINID].address &&
          orderToExecute.isNativeETH
        ) {
          await ERC20Helper.transferETH(signer, FEE_COLLECTOR_ADDRESS, fee);
        } else {
          await ERC20Helper.transfer(
            depositedToken.address,
            signer,
            FEE_COLLECTOR_ADDRESS,
            fee.toString()
          );
        }
      } else if (type === 'sell') {
        if (
          orderToExecute.desiredTokenAddress === WETH[CHAINID].address &&
          orderToExecute.isNativeETH
        ) {
          await ERC20Helper.transferETH(signer, FEE_COLLECTOR_ADDRESS, fee);
        } else {
          await ERC20Helper.transfer(
            desiredToken.address,
            signer,
            FEE_COLLECTOR_ADDRESS,
            fee.toString()
          );
        }
      }

      return {
        success: true,
        message: 'Transaction executed successfully.',
        transactionHash: tx.hash,
      };
    } catch (err: any) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        return {
          success: false,
          message: `Insufficient funds, missing gas fee${
            orderToExecute.isNativeETH &&
            orderToExecute.depositedTokenAddress === WETH[CHAINID].address
              ? ' or ETH'
              : ''
          }.`,
          transactionHash: '',
        };
      } else if (
        err.code === 'CALL_EXCEPTION' &&
        err.method.includes('getReserves')
      ) {
        return {
          success: false,
          message:
            'Error getting reserves. Pair does not exist in Uniswap. Please make sure you have verified that both tokens are on Uniswap V2 and are ERC20 token addresses.',
          transactionHash: '',
        };
      } else if (err.isInsufficientReservesError) {
        return {
          success: false,
          message:
            'Insufficient reserves. Pool does not have enough liquidity.',
          transactionHash: '',
        };
      } else {
        console.log(err);
        return {
          success: false,
          message: 'Error executing transaction',
          transactionHash: '',
        };
      }
    }
  }
}
