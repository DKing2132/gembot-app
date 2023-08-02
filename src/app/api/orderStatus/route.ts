import { NextRequest, NextResponse } from 'next/server';
import { DeleteOrderStatusRequestBody } from '../../../../types/requests/DeleteOrderStatusRequestBody';
import { prisma } from '../../../../utilities/constants';
import { OrderValidator } from '../../../../utilities/validators/OrderValidator';

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const orderStatusToDelete: DeleteOrderStatusRequestBody =
    await request.json();
  const validation = await OrderValidator.validateUserOwnsOrder(
    userId,
    orderStatusToDelete.orderId
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  try {
    await prisma.orderStatus.delete({
      where: {
        orderId: orderStatusToDelete.orderId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to delete order status or no order to delete.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      message: `Order status with id ${orderStatusToDelete.orderId} has been successfully deleted.`,
    },
    { status: 200 }
  );
}
