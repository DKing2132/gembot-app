import { NextRequest, NextResponse } from 'next/server';
import { TokenResponse } from '../../../../types/responses/TokenResponse';
import { prisma } from '../../../../utilities/constants';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get('address');

  if (!tokenAddress) {
    const tokenResponse: TokenResponse = {
      name: '',
      symbol: '',
      message: 'Invalid token address.',
    };
    return NextResponse.json(tokenResponse, { status: 400 });
  }

  const tokenInDB = await prisma.token.findUnique({
    where: {
      address: tokenAddress,
    },
  });

  if (tokenInDB) {
    console.log(`Found token ${tokenAddress} in database.`);
    console.log(tokenInDB);
    const tokenResponse: TokenResponse = {
      name: tokenInDB.name,
      symbol: tokenInDB.symbol,
      message: 'Found token in database.',
    };
    return NextResponse.json(tokenResponse, { status: 200 });
  }

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
      const tokenAPIResponse = await response.json();
      console.log(`Found token ${tokenAddress} in dexscreener.`);
      if (
        tokenAPIResponse.pairs === null ||
        tokenAPIResponse.pairs.length === 0
      ) {
        const tokenResponse: TokenResponse = {
          name: '',
          symbol: '',
          message: 'Failed to retrieve token.',
        };
        return NextResponse.json(tokenResponse, { status: 400 });
      }

      const tokenResponse: TokenResponse = {
        name: tokenAPIResponse.pairs[0].baseToken.name,
        symbol: tokenAPIResponse.pairs[0].baseToken.symbol,
        message: 'Found token in dexscreener.',
      };

      // update db with new token
      await prisma.token.create({
        data: {
          address: tokenAddress,
          name: tokenResponse.name,
          symbol: tokenResponse.symbol,
        },
      });

      return NextResponse.json(tokenResponse, { status: 200 });
    } else {
      console.log(`Response from dexscreener was not ok for token ${tokenAddress}.`);
      const tokenResponse: TokenResponse = {
        name: '',
        symbol: '',
        message: 'Failed to retrieve token.',
      };
      return NextResponse.json(tokenResponse, { status: 400 });
    }
  } catch (error) {
    console.log(`failed to retrieve token from dexscreener. ${tokenAddress}`);
    const tokenResponse: TokenResponse = {
      name: '',
      symbol: '',
      message: 'Failed to retrieve token.',
    };
    return NextResponse.json(tokenResponse, { status: 400 });
  }
}
