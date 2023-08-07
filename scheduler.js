require('dotenv').config();
let Queue = require('bull');
const { PrismaClient } = require('@prisma/client');
const process = require('process');
const BigNumber = require('bignumber.js');

let REDIS_URL = process.env.REDIS_URL;
let workQueue = new Queue('dca1', REDIS_URL, {
  redis: {
    tls: {
      rejectUnauthorized: false,
      requestCert: true,
    },
  },
});
const API_URL = process.env.API_URL;

console.log('scheduler connected to dca1');

const prisma = new PrismaClient();

async function processLimitOrder(order) {
  try {
    const response = await fetch(
      `${API_URL}/api/order/job?orderId=${order.orderId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log('Error scheduling order.');
      return;
    }

    const data = await response.json();
    if (data.status === 'NOJOB') {
      const response = await fetch(
        `${API_URL}/api/token?address=${order.desiredTokenAddress}&onlyMarketCap=true`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log('Error scheduling order.');
        return;
      }

      const tokenData = await response.json();
      if (!tokenData.isSuccess) {
        console.log('Error scheduling order.');
        return;
      }

      console.log('Scheduler - Got token data: ');
      console.log(tokenData);

      const currentTokenMarketCap = new BigNumber(tokenData.marketCap);
      const targetMarketCap = new BigNumber(order.marketCapTarget.toString());

      console.log('Scheduler - Comparing market caps: ');
      console.log(currentTokenMarketCap.toString());
      console.log(targetMarketCap.toString());

      if (currentTokenMarketCap.isLessThanOrEqualTo(targetMarketCap)) {
        await workQueue.add(
          {
            orderId: order.orderId,
            walletOwnerAddress: order.walletOwnerAddress,
            depositedTokenAddress: order.depositedTokenAddress,
            depositedTokenAmount: order.depositedTokenAmount / order.frequency,
            desiredTokenAddress: order.desiredTokenAddress,
            isNativeETH: order.isNativeETH,
            userId: order.userId,
            frequency: order.frequency,
            unitOfTime: order.unitOfTime,
            isLimitOrder: order.isLimitOrder,
            marketCapTarget: order.marketCapTarget,
            retryCount: order.retryCount,
            lastUpdatedAt: order.lastUpdatedAt,
            nextUpdateAt: order.nextUpdateAt,
          },
          { attempts: 1 }
        );

        console.log('Scheduler - Order queued: ', order.orderId);
      } else {
        console.log(
          'Scheduler - Order not queued due to market cap not reached: ',
          order.orderId
        );
      }
    } else {
      console.log('Scheduler - Order already in queue: ', order.orderId);
    }
  } catch (err) {
    console.log('Error scheduling order.', err);
  }
}

async function processOrder(order) {
  try {
    const response = await fetch(
      `${API_URL}/api/order/job?orderId=${order.orderId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log('Error scheduling order.');
      return;
    }

    const data = await response.json();
    if (data.status === 'NOJOB') {
      await workQueue.add(
        {
          orderId: order.orderId,
          walletOwnerAddress: order.walletOwnerAddress,
          depositedTokenAddress: order.depositedTokenAddress,
          depositedTokenAmount: order.depositedTokenAmount / order.frequency,
          desiredTokenAddress: order.desiredTokenAddress,
          isNativeETH: order.isNativeETH,
          userId: order.userId,
          frequency: order.frequency,
          unitOfTime: order.unitOfTime,
          retryCount: order.retryCount,
          lastUpdatedAt: order.lastUpdatedAt,
          nextUpdateAt: order.nextUpdateAt,
        },
        { attempts: 1 }
      );

      console.log('Scheduler - Order queued: ', order.orderId);
    } else {
      console.log('Scheduler - Order already in queue: ', order.orderId);
    }
  } catch (err) {
    console.log('Error scheduling order.', err);
  }
}

async function start() {
  // queue all orders that have next update time less than now and have not been queued
  const orders = await prisma.order.findMany({
    where: {
      nextUpdateAt: {
        lte: new Date(),
      },
    },
  });

  console.log('Scheduler - Orders to process: ', orders);

  const promises = orders.map((order) => {
    if (!order.isLimitOrder) {
      return processOrder(order);
    } else {
      return processLimitOrder(order);
    }
  });

  await Promise.all(promises);
}

start()
  .then(() => {
    console.log('Done scheduling orders');
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.log('Error scheduling orders: ', err);
    prisma.$disconnect();
    process.exit(1);
  });
