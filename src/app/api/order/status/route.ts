import { NextRequest, NextResponse } from 'next/server';
import { UserValidator } from '../../../../../utilities/validators/UserValidator';
import { prisma } from '../../../../../utilities/constants';
import {
  OrderStatusHistoryResponse,
  OrderStatusTrack,
} from '../../../../../types/responses/OrderStatusHistoryResponse';
import { AnalyticsTracker } from '../../../../../utilities/AnalyticsTracker';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const validation = await UserValidator.validateUserExists(userId);
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const orderHistories = await prisma.orderStatusHistory.findMany({
    where: {
      userId: userId,
    },
  });

  const response: OrderStatusHistoryResponse = {
    wallet1Orders: [],
    wallet2Orders: [],
    wallet3Orders: [],
  };

  orderHistories.forEach((orderHistory) => {
    const ordeStatusHistoryResponse: OrderStatusTrack = {
      orderId: orderHistory.orderId,
      status: orderHistory.status,
      depositedTokenAddress: orderHistory.depositedTokenAddress,
      desiredTokenAddress: orderHistory.desiredTokenAddress,
      depositedTokenAmount: Number(orderHistory.depositedTokenAmount),
      lastUpdatedAt: orderHistory.lastUpdatedAt.toISOString(),
      nextUpdateAt: orderHistory.nextUpdateAt.toISOString(),
      unitOfTime: orderHistory.unitOfTime,
      frequency: orderHistory.frequency,
      walletOwnerAddress: orderHistory.walletOwnerAddress,
      message: orderHistory.message,
      isNativeETH: orderHistory.isNativeETH,
    };

    if (orderHistory.walletOwnerAddress === validation.user!.wallet1) {
      response.wallet1Orders.push(ordeStatusHistoryResponse);
    } else if (orderHistory.walletOwnerAddress === validation.user!.wallet2) {
      response.wallet2Orders.push(ordeStatusHistoryResponse);
    } else if (orderHistory.walletOwnerAddress === validation.user!.wallet3) {
      response.wallet3Orders.push(ordeStatusHistoryResponse);
    } else {
      console.log('Wallet owner address not found');
    }
  });

  await AnalyticsTracker.recordOrderStatusCheck();

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const validation = await UserValidator.validateUserExists(userId);
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  // delete status for non existing orders
  const orderHistories = await prisma.orderStatusHistory.findMany({
    where: {
      userId: userId,
    },
  });

  if (orderHistories.length === 0) {
    return NextResponse.json(
      { message: 'No order history found for you.' },
      { status: 200 }
    );
  }

  const orderIds = orderHistories.map((orderHistory) => orderHistory.orderId);

  const orders = await prisma.order.findMany({
    where: {
      orderId: {
        in: orderIds,
      },
    },
  });

  const existingOrderIds = orders.map((order) => order.orderId);

  const nonExistingOrderIds = orderIds.filter(
    (orderId) => !existingOrderIds.includes(orderId)
  );

  if (nonExistingOrderIds.length === 0) {
    return NextResponse.json(
      { message: 'No non existing orders found.' },
      { status: 200 }
    );
  }

  await prisma.orderStatusHistory.deleteMany({
    where: {
      orderId: {
        in: nonExistingOrderIds,
      },
    },
  });

  return NextResponse.json(
    { message: 'Successfully deleted orders history for non existing orders.' },
    { status: 200 }
  );
}
