import { NextRequest, NextResponse } from 'next/server';
import { OrderValidator } from '../../../../../utilities/validators/OrderValidator';
import { prisma } from '../../../../../utilities/constants';
import { OrderResponse } from '../../../../../types/responses/OrderResponse';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    console.log('Order ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve order id.' },
      { status: 400 }
    );
  }

  const validation = await OrderValidator.validateUserOwnsOrder(
    userId,
    orderId
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: {
      orderId: orderId,
    },
  });

  if (!order) {
    return NextResponse.json(
      { message: 'Failed to retrieve order.' },
      { status: 400 }
    );
  }

  const response: OrderResponse = {
    orderID: order.orderId,
    walletOwnerAddress: order.walletOwnerAddress,
    depositedTokenAddress: order.depositedTokenAddress,
    depositedTokenAmount: Number(order.depositedTokenAmount),
    desiredTokenAddress: order.desiredTokenAddress,
    isNativeETH: order.isNativeETH,
    unitOfTime: order.unitOfTime,
    frequency: order.frequency,
  };

  if (order.isLimitOrder) {
    response.isLimitOrder = order.isLimitOrder;
    response.marketCapTarget = Number(order.marketCapTarget);
  }

  return NextResponse.json(response, { status: 200 });
}
