import { NextRequest, NextResponse } from 'next/server';
import { UserValidator } from '../../../../../utilities/validators/UserValidator';
import { prisma } from '../../../../../utilities/constants';
import {
  OrderStatusHistoryResponse,
  OrderStatusTrack,
} from '../../../../../types/responses/OrderStatusHistoryResponse';

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
      lastUpdatedAt: orderHistory.lastUpdatedAt,
      nextUpdateAt: orderHistory.nextUpdateAt,
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

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
