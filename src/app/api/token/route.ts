import { NextRequest, NextResponse } from 'next/server';
import { TokenResponse } from '../../../../types/responses/TokenResponse';
import {
  CHAINID,
  COINGECKO_API_URL,
  prisma,
} from '../../../../utilities/constants';
import { AnalyticsTracker } from '../../../../utilities/AnalyticsTracker';
import { TokenValidator } from '../../../../utilities/validators/TokenValidator';
import { RedisHelper } from '../../../../utilities/RedisHelper';
import { DEXScreenerTokenResponse } from '../../../../types/responses/DEXScreenerTokenResponse';
import BigNumber from 'bignumber.js';
import { WETH } from '@uniswap/sdk';
import { CoinGeckoTokenPrice } from '../../../../types/responses/CoinGeckoTokenPrice';

const getTokenMarketCapFromCoinGecko = async (tokenAddress: string) => {
  try {
    const response = await fetch(
      `${COINGECKO_API_URL}simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd&include_market_cap=true`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const coinGeckTokenPrice: CoinGeckoTokenPrice = await response.json();
      const lowercaseTokenAddress = tokenAddress.toLowerCase();
      if (
        !coinGeckTokenPrice[lowercaseTokenAddress] ||
        !coinGeckTokenPrice[lowercaseTokenAddress].usd_market_cap
      ) {
        return '0';
      }

      console.log('Found token with market cap from coingecko.');

      return new BigNumber(
        coinGeckTokenPrice[lowercaseTokenAddress].usd_market_cap
      ).toString();
    }

    return '0';
  } catch (error) {
    console.log(error);
    console.log('Failed to retrieve token market cap from coingecko.');
    return '0';
  }
};

const getTokenInfoFromDEXScreener = async (
  tokenAddress: string
): Promise<TokenResponse> => {
  try {
    const response = await fetch(
      `${process.env.DEX_SCREENER_API_URL}${tokenAddress}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const tokenAPIResponse: DEXScreenerTokenResponse = await response.json();
      if (
        tokenAPIResponse.pairs === null ||
        tokenAPIResponse.pairs.length === 0
      ) {
        const tokenResponse: TokenResponse = {
          name: '',
          symbol: '',
          message: 'Failed to retrieve token.',
          isSuccess: false,
        };
        return tokenResponse;
      }

      const correctTokenPair = tokenAPIResponse.pairs.filter((pair) => {
        return (
          pair.chainId === 'ethereum' &&
          pair.dexId === 'uniswap' &&
          pair.labels[0] === 'v2' &&
          pair.quoteToken.address === WETH[CHAINID].address
        );
      });

      if (correctTokenPair.length === 0) {
        const tokenResponse: TokenResponse = {
          name: '',
          symbol: '',
          message: 'Failed to retrieve pair from dexscreener.',
          isSuccess: false,
        };
        return tokenResponse;
      }

      if (!correctTokenPair[0].fdv) {
        return {
          name: correctTokenPair[0].baseToken.name,
          symbol: correctTokenPair[0].baseToken.symbol,
          message: 'Failed to retrieve fdv from dexscreener.',
          isSuccess: false,
        };
      }

      const tokenResponse: TokenResponse = {
        name: tokenAPIResponse.pairs[0].baseToken.name,
        symbol: tokenAPIResponse.pairs[0].baseToken.symbol,
        message: 'Found token in dexscreener.',
        isSuccess: true,
        marketCap: new BigNumber(correctTokenPair[0].fdv).toString(),
      };

      console.log('Found token with market cap (fdv) from dexscreener.');

      return tokenResponse;
    } else {
      console.log(
        `Response from dexscreener was not ok for token ${tokenAddress}.`
      );
      const tokenResponse: TokenResponse = {
        name: '',
        symbol: '',
        message: 'Failed to retrieve token.',
        isSuccess: false,
      };

      return tokenResponse;
    }
  } catch (error) {
    console.log(`failed to retrieve token from dexscreener. ${tokenAddress}`);
    console.log(error);
    const tokenResponse: TokenResponse = {
      name: '',
      symbol: '',
      message: 'Failed to retrieve token.',
      isSuccess: false,
    };

    return tokenResponse;
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get('address');
  const onlyMarketCap = searchParams.get('onlyMarketCap');

  if (!tokenAddress) {
    const tokenResponse: TokenResponse = {
      name: '',
      symbol: '',
      message: 'Invalid token address.',
      isSuccess: false,
    };
    return NextResponse.json(tokenResponse, { status: 400 });
  }

  const validation = await TokenValidator.validateToken(tokenAddress);
  if (!validation.valid) {
    const tokenResponse: TokenResponse = {
      name: '',
      symbol: '',
      message: validation.message!,
      isSuccess: false,
    };

    return NextResponse.json(tokenResponse, { status: 400 });
  }

  if (onlyMarketCap && onlyMarketCap === 'true') {
    const key = await RedisHelper.GetTokenMarketCapKey(tokenAddress);
    const marketCapInRedis = await RedisHelper.get(key);
    if (!marketCapInRedis) {
      const coingeckoMarketCap = await getTokenMarketCapFromCoinGecko(
        tokenAddress
      );
      console.log('got market cap from coingecko');
      console.log(coingeckoMarketCap);
      console.log(coingeckoMarketCap !== '0');
      console.log(typeof coingeckoMarketCap);
      if (coingeckoMarketCap !== '0') {
        console.log('I am in here!');
        await RedisHelper.set(key, coingeckoMarketCap);
        const tokenResponse: TokenResponse = {
          name: '',
          symbol: '',
          message: 'Found token market cap in coingecko.',
          isSuccess: true,
          marketCap: coingeckoMarketCap,
        };

        return NextResponse.json(tokenResponse, { status: 200 });
      }

      const tokenResponse = await getTokenInfoFromDEXScreener(tokenAddress);

      if (!tokenResponse.isSuccess) {
        return NextResponse.json(tokenResponse, { status: 400 });
      }

      await RedisHelper.set(key, tokenResponse.marketCap!);
      return NextResponse.json(tokenResponse, { status: 200 });
    } else {
      console.log('got market cap from redis');
      const tokenResponse: TokenResponse = {
        name: '',
        symbol: '',
        message: 'Found token in redis.',
        isSuccess: true,
        marketCap: marketCapInRedis,
      };

      return NextResponse.json(tokenResponse, { status: 200 });
    }
  }

  const tokenInDB = await prisma.token.findUnique({
    where: {
      address: tokenAddress,
    },
  });

  if (tokenInDB) {
    const tokenResponse: TokenResponse = {
      name: tokenInDB.name,
      symbol: tokenInDB.symbol,
      message: 'Found token in database.',
      isSuccess: true,
    };

    await AnalyticsTracker.recordTokenSearch(
      tokenAddress,
      tokenInDB.name,
      tokenInDB.symbol
    );

    return NextResponse.json(tokenResponse, { status: 200 });
  } else {
    const tokenResponse = await getTokenInfoFromDEXScreener(tokenAddress);

    if (!tokenResponse.isSuccess) {
      return NextResponse.json(tokenResponse, { status: 400 });
    } else {
      // update db with new token
      await prisma.token.create({
        data: {
          address: tokenAddress,
          name: tokenResponse.name,
          symbol: tokenResponse.symbol,
        },
      });

      await AnalyticsTracker.recordTokenSearch(
        tokenAddress,
        tokenResponse.name,
        tokenResponse.symbol
      );

      const key = await RedisHelper.GetTokenMarketCapKey(tokenAddress);
      await RedisHelper.set(key, tokenResponse.marketCap!);

      return NextResponse.json(tokenResponse, { status: 200 });
    }
  }
}
