require('dotenv').config();
let Queue = require('bull');
const { PrismaClient } = require('@prisma/client');
const process = require('process');

let REDIS_URL = process.env.REDIS_URL;
let workQueue = new Queue('dca1', REDIS_URL, {
  redis: {
    tls: {
      rejectUnauthorized: false,
      requestCert: true,
    },
  },
});

console.log('scheduler connected to dca1');

const prisma = new PrismaClient();

async function processOrder(order) {
  const orderStatus = await prisma.orderStatus.findUnique({
    where: {
      orderId: order.orderId,
    },
  });

  console.log('Schedulder - Processing order: ', order.orderId);
  console.log('Schedule - Order status: ', orderStatus);

  if (!orderStatus || orderStatus.inQueue === false) {
    await prisma.orderStatus.upsert({
      where: {
        orderId: order.orderId,
      },
      update: {
        inQueue: true,
      },
      create: {
        orderId: order.orderId,
        inQueue: true,
      },
    });

    console.log('Scheduler - Adding order to queue: ', order.orderId);

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
      },
      { attempts: 1 }
    );
  } else {
    console.log('Scheduler - Order already in queue: ', order.orderId);
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

  const promises = orders.map((order) => processOrder(order));

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
