import { PrismaClient } from '@prisma/client';
import { ChainId } from '@uniswap/sdk';
import Queue from 'bull';
import { createClient } from 'redis';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export const unitOfTimes = ['HOURS', 'DAYS', 'WEEKS', 'MONTHS'];

export const keyStr = process.env.ENCRYPTION_KEY!;
if (keyStr === undefined) {
  throw new Error('ENCRYPTION_KEY must be provided!');
}

export const ivStr = process.env.ENCRYPTION_IV!;
if (ivStr === undefined) {
  throw new Error('ENCRYPTION_IV must be provided!');
}

export const CHAINID =
  process.env.CHAIN_ENV === 'development' ? ChainId.GÖRLI : ChainId.MAINNET;

export const FEE_COLLECTOR_ADDRESS = process.env.FEE_COLLECTOR_ADDRESS!;
if (FEE_COLLECTOR_ADDRESS === undefined) {
  throw new Error('FEE_COLLECTOR_ADDRESS must be provided!');
}

export const BUY_SELL_FEE = process.env.BUY_SELL_FEE_PERCENTAGE!;
if (BUY_SELL_FEE === undefined) {
  throw new Error('BUY_SELL_FEE_PERCENTAGE must be provided!');
}

export const SLIPPAGE = process.env.SLIPPAGE!;
if (SLIPPAGE === undefined) {
  throw new Error('SLIPPAGE must be provided!');
}

export const COINGECKO_API_URL = process.env.COINGECKO_API_URL!;
if (COINGECKO_API_URL === undefined) {
  throw new Error('COINGECKO_API_URL must be provided!');
}

export const REDIS_URL = process.env.REDIS_URL!;
if (REDIS_URL === undefined) {
  throw new Error('REDIS_URL must be provided!');
}
export const BuyQueue = new Queue('buy', REDIS_URL, {
  redis: {
    tls: {
      rejectUnauthorized: false,
      requestCert: true,
    },
  },
});

export const WorkQueue = new Queue('dca1', REDIS_URL, {
  redis: {
    tls: {
      rejectUnauthorized: false,
      requestCert: true,
    },
  },
});

export const RedisClient = createClient({
  url: REDIS_URL,
  socket: {
    tls: false
  }
});
RedisClient.on('error', (err) => console.log('Redis Client Error', err));
