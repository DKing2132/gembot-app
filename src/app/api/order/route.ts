import { NextRequest, NextResponse } from 'next/server';
import { OrderRequestBody } from '../../../../types/requests/OrderRequestBody';
import { OrderValidator } from '../../../../utilities/validators/OrderValidator';
import { OrderResponse } from '../../../../types/responses/OrderResponse';
import { UserValidator } from '../../../../utilities/validators/UserValidator';
import { GetAllOrdersResponse } from '../../../../types/responses/GetAllOrdersResponse';
import { DeleteRequestBody } from '../../../../types/requests/DeleteRequestBody';
import { UpdateOrderRequestBody } from '../../../../types/requests/UpdateOrderRequestBody';
import { prisma } from '../../../../utilities/constants';

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

  const orders = await prisma.order.findMany({
    where: {
      userId: userId,
    },
  });

  const response: GetAllOrdersResponse = {
    wallet1Orders: [],
    wallet2Orders: [],
    wallet3Orders: [],
  };

  orders.forEach((order) => {
    const orderResponse: OrderResponse = {
      orderID: order.orderId,
      walletOwnerAddress: order.walletOwnerAddress,
      depositedTokenAddress: order.depositedTokenAddress,
      depositedTokenAmount: Number(order.depositedTokenAmount),
      desiredTokenAddress: order.desiredTokenAddress,
      isNativeETH: order.isNativeETH,
      unitOfTime: order.unitOfTime,
      frequency: order.frequency,
    };

    if (order.walletOwnerAddress === validation.user!.wallet1) {
      response.wallet1Orders.push(orderResponse);
    } else if (order.walletOwnerAddress === validation.user!.wallet2) {
      response.wallet2Orders.push(orderResponse);
    } else if (order.walletOwnerAddress === validation.user!.wallet3) {
      response.wallet3Orders.push(orderResponse);
    }
  });

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const body: OrderRequestBody = await request.json();

  const validation = await OrderValidator.validateOrderToCreate(userId, body);
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  // create the order
  const order = await prisma.order.create({
    data: {
      walletOwnerAddress: body.walletOwnerAddress,
      depositedTokenAddress: body.depositedTokenAddress,
      depositedTokenAmount: body.depositedTokenAmount,
      desiredTokenAddress: body.desiredTokenAddress,
      isNativeETH: body.isNativeETH,
      unitOfTime: body.unitOfTime,
      frequency: body.frequency,
      userId: userId,
    },
  });

  const orderResponse: OrderResponse = {
    walletOwnerAddress: order.walletOwnerAddress,
    depositedTokenAddress: order.depositedTokenAddress,
    depositedTokenAmount: Number(order.depositedTokenAmount),
    desiredTokenAddress: order.desiredTokenAddress,
    isNativeETH: order.isNativeETH,
    unitOfTime: order.unitOfTime,
    frequency: order.frequency,
  };

  return NextResponse.json(orderResponse, {
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

  const orderToDelete: DeleteRequestBody = await request.json();
  const validation = await OrderValidator.validateUserOwnsOrder(
    userId,
    orderToDelete.orderID
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  try {
    await prisma.orderStatus.delete({
      where: {
        orderId: orderToDelete.orderID,
      },
    });
  } catch (e) {
    console.log(`no order statuses found for order ${orderToDelete.orderID}`);
  }

  await prisma.order.delete({
    where: {
      orderId: orderToDelete.orderID,
    },
  });

  return NextResponse.json(
    {
      message: `Order with id ${orderToDelete.orderID} has been successfully deleted.`,
    },
    { status: 200 }
  );
}

export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const updateOrderBody: UpdateOrderRequestBody = await request.json();
  const validation = await OrderValidator.validateOrderToUpdate(
    userId,
    updateOrderBody
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  if (validation.fieldToUpdate === 'depositedTokenAmount') {
    await prisma.order.update({
      where: {
        orderId: updateOrderBody.orderID,
      },
      data: {
        depositedTokenAmount: updateOrderBody.value as number,
      },
    });
  } else if (validation.fieldToUpdate === 'desiredToken') {
    await prisma.order.update({
      where: {
        orderId: updateOrderBody.orderID,
      },
      data: {
        desiredTokenAddress: updateOrderBody.value as string,
      },
    });
  } else if (validation.fieldToUpdate === 'frequency') {
    await prisma.order.update({
      where: {
        orderId: updateOrderBody.orderID,
      },
      data: {
        frequency: updateOrderBody.value as number,
      },
    });
  } else if (validation.fieldToUpdate === 'unitOfTime') {
    await prisma.order.update({
      where: {
        orderId: updateOrderBody.orderID,
      },
      data: {
        unitOfTime: updateOrderBody.value as string,
      },
    });
  }

  return NextResponse.json(
    {
      message: `Order with id ${updateOrderBody.orderID} has been successfully updated.`,
    },
    { status: 200 }
  );
}
