import { NextRequest, NextResponse } from 'next/server';
import { TokenInfo } from '../../../../types/responses/TokenInfo';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { TokenValidator } from '../../../../utilities/validators/TokenValidator';
import { ChainId, Token, WETH, Fetcher, Route } from '@uniswap/sdk'
import { ERC20Abi } from '../../../../abis';

const getTotalSupply = async (tokenAddress: string): Promise<string> => {
  const web3 = new Web3(new Web3.providers.HttpProvider(`${process.env.HTTPS_NODE_PROVIDER_URL}`));

  try {
    const contract = new web3.eth.Contract(AbiItem(ERC20Abi), tokenAddress);
    const totalSupply = await contract.methods.totalSupply().call();
    
    return totalSupply;
  } catch (err) {
    console.log('Failed to retrieve token total supply.', err);
    return '-1';
  }
};

export const getTokenPrice = async (tokenAddress: string): Promise<string> => {
    const web3 = new Web3(new Web3.providers.HttpProvider(`${process.env.HTTPS_NODE_PROVIDER_URL}`));
    // currently only eth mainnet
    const usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    try{
        const contract = new web3.eth.Contract(AbiItem(ERC20Abi), tokenAddress);
        const decimals = await contract.methods.decimals().call();
        const token = new Token(ChainId.MAINNET, tokenAddress, decimals);
        const usdt = new Token(ChainId.MAINNET, usdtAddress, 6);

        const wethPair = await Fetcher.fetchPairData(token, WETH[token.chainId]);
        const wethRoute = new Route([wethPair], WETH[token.chainId]);
        const tokenWethRatio = wethRoute.midPrice;

        const wethUsdtPair = await Fetcher.fetchPairData(usdt, WETH[token.chainId]);
        const wethUsdtRoute = new Route([wethUsdtPair], WETH[token.chainId]);
        const wethPrice = wethUsdtRoute.midPrice;

        const price = parseFloat(wethPrice.toSignificant(6)) / parseFloat(tokenWethRatio.toSignificant(6));

        return price.toString();

    } catch (err) {
        console.log('Failed to retrieve token price.', err);
        return '-1';
      }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenAddress = searchParams.get('address');

  if (!tokenAddress) {
    const tokenInfo: TokenInfo = {
      name: '',
      symbol: '',
      message: 'Invalid token address.',
      isSuccess: false,
      totalSupply: '',
      price:'',
    };
    return NextResponse.json(tokenInfo, { status: 400 });
  }

  const validation = await TokenValidator.validateToken(tokenAddress);
  if (!validation.valid) {
    const tokenInfo: TokenInfo = {
      name: '',
      symbol: '',
      message: validation.message!,
      isSuccess: false,
      totalSupply: '',
      price:'',
    };

    return NextResponse.json(tokenInfo, { status: 400 });
  }

  const totalSupply = await getTotalSupply(tokenAddress);
  const price = await getTokenPrice(tokenAddress);

  if (totalSupply === '-1') {
    const tokenInfo: TokenInfo = {
      name: '',
      symbol: '',
      message: 'Failed to retrieve total supply.',
      isSuccess: false,
      totalSupply: '',
      price:'',
    };
    return NextResponse.json(tokenInfo, { status: 400 });
  }

  if (price === '-1') {
    const tokenInfo: TokenInfo = {
      name: '',
      symbol: '',
      message: 'Failed to retrieve price.',
      isSuccess: false,
      totalSupply: '',
      price:'',
    };
    return NextResponse.json(tokenInfo, { status: 400 });
  }

  const tokenInfo: TokenInfo = {
    name: '', 
    symbol: '', 
    message: 'Found token total supply.',
    isSuccess: true,
    totalSupply: totalSupply,
    price: price,
  };

  return NextResponse.json(tokenInfo, { status: 200 });
}
