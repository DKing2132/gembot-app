require('dotenv').config();
const Queue = require('bull');
const { PrismaClient } = require('@prisma/client');
const throng = require('throng');
const process = require('process');
const {
  Fetcher,
  Pair,
  ChainId,
  TokenAmount,
  Route,
  Trade,
  TradeType,
  Percent,
  WETH,
} = require('@uniswap/sdk');
const { ethers } = require('ethers');
const { UniswapV2PairABI, UniswapV2RouterABI, ERC20Abi } = require('./abis');
const { AnalyticsTracker } = require('./workerHelpers/AnalyticsTracker');
const crypto = require('crypto');

const REDIS_URL = process.env.REDIS_URL;
const workers = process.env.WEB_CONCURRENCY || 1;
const CHAINID =
  process.env.CHAIN_ENV === 'development' ? ChainId.GÖRLI : ChainId.MAINNET;
const provider = new ethers.providers.JsonRpcProvider(
  process.env.CHAIN_ENV === 'development'
    ? process.env.TESTNET_HTTPS_NODE_PROVIDER_URL
    : process.env.HTTPS_NODE_PROVIDER_URL
);
const keyStr = process.env.ENCRYPTION_KEY;
const ivStr = process.env.ENCRYPTION_IV;
const BUY_SELL_FEE_PERCENTAGE = process.env.BUY_SELL_FEE_PERCENTAGE;
const SLIPPAGE = process.env.SLIPPAGE;
const UNISWAP_V2_ROUTER_ADDRESS = process.env.UNISWAP_V2_ROUTER_ADDRESS;
const GAS_BUFFER = process.env.GAS_BUFFER;
const FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR_ADDRESS;

const algorithm = 'aes-256-cbc'; //Using AES encryption
const key = Buffer.from(keyStr, 'hex'); //Creating Key
const iv = Buffer.from(ivStr, 'hex'); //Creating IV

// Decrypting text
function decrypt(text) {
  let iv = Buffer.from(text.iv, 'hex');
  let encryptedText = Buffer.from(text.encryptedData, 'hex');
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

const maxJobsPerWorker = 50;

const prisma = new PrismaClient();
const analyticsTracker = new AnalyticsTracker(prisma);

class SendTxHelper {
  static getGasLimitWithBuffer(gasLimit) {
    console.log('Estimated Gas Limit: ', gasLimit.toString());
    // 110 is 10% buffer over the estimated gas limit
    return gasLimit.mul(Number(GAS_BUFFER)).div(100);
  }
}

class ERC20Helper {
  static async approve(
    tokenAddress,
    spenderAddress,
    walletAddress,
    amount,
    signer
  ) {
    try {
      const ERC20Token = new ethers.Contract(tokenAddress, ERC20Abi, signer);

      const currentGasPrice = ethers.utils.hexlify(
        await provider.getGasPrice()
      );

      const estimatedGas = await ERC20Token.estimateGas.approve(
        spenderAddress,
        amount
      );

      const approveTx = await ERC20Token.approve(spenderAddress, amount, {
        from: walletAddress,
        gasLimit: SendTxHelper.getGasLimitWithBuffer(estimatedGas),
        gasPrice: currentGasPrice,
      });

      await approveTx.wait();

      console.log('Token transfer approved');
    } catch (error) {
      console.error(error);
    }
  }

  static async transfer(tokenAddress, wallet, recipientAddress, amountToSend) {
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

  static async transferETH(wallet, recipientAddress, amountToSend) {
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

function start() {
  const buyQueue = new Queue('buy', REDIS_URL, {
    redis: {
      tls: {
        rejectUnauthorized: false,
        requestCert: true,
      },
    },
  });

  buyQueue.process(maxJobsPerWorker, async (job) => {
    console.log('Processing buy job: ', job.id);

    const user = await prisma.user.findUnique({
      where: {
        id: job.data.userId,
      },
    });

    if (!user) {
      return Promise.reject({ success: false, message: 'User not found' });
    }

    try {
      const depositedToken = await Fetcher.fetchTokenData(
        CHAINID,
        job.data.depositedTokenAddress,
        provider
      );

      const desiredToken = await Fetcher.fetchTokenData(
        CHAINID,
        job.data.desiredTokenAddress,
        provider
      );

      let walletPrivateKey;
      if (job.data.walletOwnerAddress === user.wallet1) {
        walletPrivateKey = decrypt({
          iv: iv.toString('hex'),
          encryptedData: user.wallet1PrivateKey,
        });
      } else if (job.data.walletOwnerAddress === user.wallet2) {
        walletPrivateKey = decrypt({
          iv: iv.toString('hex'),
          encryptedData: user.wallet2PrivateKey,
        });
      } else if (job.data.walletOwnerAddress === user.wallet3) {
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
        return Promise.reject({
          success: false,
          message: 'Pair not found on uniswap',
        });
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
        job.data.depositedTokenAmount
          .toFixed(depositedToken.decimals)
          .toString(),
        depositedToken.decimals
      );

      // take 1% from amount as a fee
      let fee = ethers.BigNumber.from(0);
      let trade;
      if (job.data.type === 'buy') {
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
      if (job.data.type === 'sell') {
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
      const to = job.data.walletOwnerAddress;
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
      const value = trade.inputAmount.raw; // needs to be converted to e.g. hex
      const valueHex = ethers.BigNumber.from(value.toString()).toHexString();

      const currentGasPrice = ethers.utils.hexlify(
        await provider.getGasPrice()
      );

      const UniswapV2Router = new ethers.Contract(
        UNISWAP_V2_ROUTER_ADDRESS,
        UniswapV2RouterABI,
        signer
      );

      let tx;
      if (
        job.data.isNativeETH &&
        job.data.depositedTokenAddress === WETH[CHAINID].address
      ) {
        console.log('ETH to ERC20');
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
        job.data.isNativeETH &&
        desiredToken.address === WETH[CHAINID].address
      ) {
        console.log('ERC20 to ETH');
        await ERC20Helper.approve(
          depositedToken.address,
          UNISWAP_V2_ROUTER_ADDRESS,
          job.data.walletOwnerAddress,
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
        console.log('ERC20 to ERC20');
        await ERC20Helper.approve(
          depositedToken.address,
          UNISWAP_V2_ROUTER_ADDRESS,
          job.data.walletOwnerAddress,
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
      if (job.data.type === 'buy') {
        if (
          job.data.depositedTokenAddress === WETH[CHAINID].address &&
          job.data.isNativeETH
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
      } else if (job.data.type === 'sell') {
        if (
          job.data.desiredTokenAddress === WETH[CHAINID].address &&
          job.data.isNativeETH
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

      if (job.data.type === 'buy') {
        await analyticsTracker.recordTokenTotalAmountIncrease(
          job.data.depositedTokenAddress,
          '',
          '',
          job.data.depositedTokenAmount
        );
        await analyticsTracker.recordBuyTxSucceded();
      } else if (job.data.type === 'sell') {
        await analyticsTracker.recordTokenTotalAmountIncrease(
          job.data.depositedTokenAddress,
          '',
          '',
          job.data.depositedTokenAmount
        );
        await analyticsTracker.recordSellTxSucceded();
      }

      return Promise.resolve({
        success: true,
        transactionHash: tx.hash,
        message: 'Transaction executed successfully.',
      });
    } catch (err) {
      if (job.data.type === 'buy') {
        await analyticsTracker.recordBuyTxFailed();
      } else if (job.data.type === 'sell') {
        await analyticsTracker.recordSellTxFailed();
      }

      if (err.code === 'INSUFFICIENT_FUNDS') {
        return Promise.reject({
          success: false,
          message: `Insufficient funds, missing gas fee${
            job.data.isNativeETH &&
            job.data.depositedTokenAddress === WETH[CHAINID].address
              ? ' or ETH'
              : ''
          }.`,
        });
      } else if (
        err.code === 'CALL_EXCEPTION' &&
        err.method?.includes('getReserves')
      ) {
        return Promise.reject({
          success: false,
          message:
            'Error getting reserves. Pair does not exist in Uniswap. Please make sure you have verified that both tokens are on Uniswap V2 and are ERC20 token addresses.',
        });
      } else if (err.isInsufficientReservesError) {
        return Promise.reject({
          success: false,
          message:
            'Insufficient reserves. Pool does not have enough liquidity.',
        });
      } else {
        console.log(err);
        return Promise.reject({
          success: false,
          message: 'Error executing transaction',
        });
      }
    }
  });

  buyQueue.on('completed', async (job, result) => {
    console.log(`Completed job: ${job.id}`);
    console.log(result);
  });

  buyQueue.on('failed', async (job, err) => {
    console.log(`Failed job: ${job.id}`);
    console.log(err);
  });
}

throng({ workers: workers, start: start });
