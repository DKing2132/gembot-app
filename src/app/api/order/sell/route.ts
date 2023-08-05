import { NextRequest, NextResponse } from 'next/server';
import { SellRequestBody } from '../../../../../types/requests/SellRequestBody';
import { OrderValidator } from '../../../../../utilities/validators/OrderValidator';
import { BuyQueue } from '../../../../../utilities/constants';
import { AnalyticsTracker } from '../../../../../utilities/AnalyticsTracker';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const sellOrderBody: SellRequestBody = await request.json();
  const validation = await OrderValidator.validateSellOrder(
    userId,
    sellOrderBody
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  console.log('Sell order validated');

  try {
    const job = await BuyQueue.add(
      {
        userId: validation.user!.id,
        walletOwnerAddress: sellOrderBody.walletOwnerAddress,
        depositedTokenAddress: sellOrderBody.depositedTokenAddress,
        desiredTokenAddress: sellOrderBody.desiredTokenAddress,
        depositedTokenAmount: sellOrderBody.depositedTokenAmount,
        isNativeETH: sellOrderBody.isNativeETH,
        orderId: sellOrderBody.orderId,
        type: 'sell',
      },
      { attempts: 1 }
    );
    console.log('Job added to queue: ' + job.id);

    await AnalyticsTracker.recordSell();

    return NextResponse.json({ message: job.id }, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { message: 'Failed to queue sell job' },
      { status: 500 }
    );
  }
}
