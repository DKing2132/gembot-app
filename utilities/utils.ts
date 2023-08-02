import 'dotenv/config';
import { ethers } from 'ethers';

export const provider = new ethers.providers.JsonRpcProvider(
  process.env.CHAIN_ENV === 'development'
    ? process.env.TESTNET_HTTPS_NODE_PROVIDER_URL
    : process.env.HTTPS_NODE_PROVIDER_URL!
);
