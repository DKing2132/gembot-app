require('dotenv').config();
const Queue = require('bull');
const { PrismaClient } = require('@prisma/client');
const throng = require('throng');
const process = require('process');

const REDIS_URL = process.env.REDIS_URL;
const workers = process.env.WEB_CONCURRENCY || 1;
const API_URL = process.env.API_URL;

const maxJobsPerWorker = 50;

const prisma = new PrismaClient();

function addMinutesToDate(date, minutes) {
  const d = new Date(date);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d;
}

function addHoursToDate(date, hours) {
  const d = new Date(date);
  d.setUTCHours(d.getUTCHours() + hours);
  return d;
}

function addDaysToDate(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addWeeksToDate(date, weeks) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

function addMonthsToDate(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function start() {
  console.log('start');
  const workQueue = new Queue('dca1', REDIS_URL, {
    redis: {
      tls: {
        rejectUnauthorized: false,
        requestCert: true,
      },
    },
  });

  console.log('worker connected to dca1');

  workQueue.process(maxJobsPerWorker, async (job) => {
    console.log('Processing job: ', job.data.orderId);

    const orderStatus = await prisma.orderStatus.findUnique({
      where: {
        orderId: job.data.orderId,
      },
    });

    if (!orderStatus || orderStatus.inQueue === false) {
      return Promise.reject(new Error('Order not in queue'));
    }
    console.log('Order has been dequeued: ', job.data.orderId);
    await prisma.orderStatus.delete({
      where: {
        orderId: job.data.orderId,
      },
    });

    const response = await fetch(`${API_URL}/api/order/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'genesis-bot-user-id': job.data.userId,
      },
      body: JSON.stringify({
        walletOwnerAddress: job.data.walletOwnerAddress,
        depositedTokenAddress: job.data.depositedTokenAddress,
        desiredTokenAddress: job.data.desiredTokenAddress,
        depositedTokenAmount: job.data.depositedTokenAmount,
        isNativeETH: job.data.isNativeETH,
        orderId: job.data.orderId,
      }),
    });

    console.log('got response from API for order: ', job.data.orderId);

    try {
      if (response.ok) {
        const data = await response.json();
        console.log('data from API: ', data);
        const timer = setInterval(async () => {
          console.log('dca polling job for status for order');
          try {
            const jobResponse = await fetch(
              `${API_URL}/api/order/job?id=${data.message}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!jobResponse.ok) {
              const error = await jobResponse.json();
              clearInterval(timer);
              throw new Error(error.message);
            }

            const jobStatus = await jobResponse.json();
            console.log(
              `job status: ${jobStatus.status} for job: ${data.message}`
            );
            if (jobStatus.status === 'SUCCESS') {
              console.log('dca job completed successfully for order: ' + job.data.orderId);
              let nextUpdateAt;
              if (job.data.unitOfTime === 'HOURS') {
                nextUpdateAt = addHoursToDate(new Date(), 1);
              } else if (job.data.unitOfTime === 'DAYS') {
                nextUpdateAt = addDaysToDate(new Date(), 1);
              } else if (job.data.unitOfTime === 'WEEKS') {
                nextUpdateAt = addWeeksToDate(new Date(), 1);
              } else if (job.data.unitOfTime === 'MONTHS') {
                nextUpdateAt = addMonthsToDate(new Date(), 1);
              } else {
                throw new Error('Invalid unit of time');
              }

              if (job.data.frequency === 1) {
                // delete order
                await prisma.order.delete({
                  where: {
                    orderId: job.data.orderId,
                  },
                });
              } else {
                // update order balances
                await prisma.order.update({
                  where: { orderId: job.data.orderId },
                  data: {
                    depositedTokenAmount: {
                      decrement: job.data.depositedTokenAmount,
                    },
                    lastUpdatedAt: new Date(),
                    nextUpdateAt: nextUpdateAt,
                    frequency: job.data.frequency - 1,
                  },
                });

                console.log(`New DCA stats, order lastUpdated at ${new Date()} and nextUpdateAt: ${nextUpdateAt}`);
              }

              clearInterval(timer);
              return Promise.resolve(
                `Processed order: ${job.data.orderId} successfully!`
              );
            } else if (jobStatus.status === 'FAILED') {
              console.log('dca job failed');
              clearInterval(timer);
              throw new Error(jobStatus.message);
            } else {
              console.log('dca job still processing');
            }
          } catch (err) {
            console.log(err);
            clearInterval(timer);
            console.log('Failed to get job status');

            console.log('will try order again later!');

            // try the order again next time
            await prisma.order.update({
              where: { orderId: job.data.orderId },
              data: {
                nextUpdateAt: addMinutesToDate(new Date(), 1),
              },
            });
          }
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (err) {
      console.log('Worker - error from API: ', err);

      // try the order again next time
      await prisma.order.update({
        where: { orderId: job.data.orderId },
        data: {
          nextUpdateAt: addMinutesToDate(new Date(), 1),
        },
      });

      return Promise.reject(
        new Error(`Error processing order: ${job.data.orderId}`)
      );
    }
  });

  workQueue.on('completed', (job, result) => {
    console.log(`Job completed with result ${result}`);
  });

  workQueue.on('failed', (job, err) => {
    console.log(`Job failed with error ${err.message}`);
  });
}

throng({
  workers: workers,
  start: start,
});
