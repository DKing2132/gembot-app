import { NextRequest, NextResponse } from 'next/server';
import { OrderValidator } from '../../../../../utilities/validators/OrderValidator';
import { BuyRequestBody } from '../../../../../types/requests/BuyRequestBody';
import { BuyQueue } from '../../../../../utilities/constants';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const buyOrderBody: BuyRequestBody = await request.json();
  const validation = await OrderValidator.validateBuyOrder(
    userId,
    buyOrderBody
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }
  console.log('Buy order validated');

  try {
    const job = await BuyQueue.add(
      {
        userId: validation.user!.id,
        walletOwnerAddress: buyOrderBody.walletOwnerAddress,
        depositedTokenAddress: buyOrderBody.depositedTokenAddress,
        desiredTokenAddress: buyOrderBody.desiredTokenAddress,
        depositedTokenAmount: buyOrderBody.depositedTokenAmount,
        isNativeETH: buyOrderBody.isNativeETH,
        orderId: buyOrderBody.orderId,
        type: 'buy',
      },
      { attempts: 1 }
    );
    console.log('Job added to queue: ' + job.id);

    return NextResponse.json({ message: job.id }, { status: 200 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { message: 'Failed to queue buy job' },
      { status: 500 }
    );
  }
}
