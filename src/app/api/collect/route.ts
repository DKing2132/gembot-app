import { NextRequest, NextResponse } from 'next/server';
import { CollectFundsRequestBody } from '../../../../types/requests/CollectFundsRequestBody';
import { CollectFundsValidator } from '../../../../utilities/validators/CollectFundsValidator';
import { SendTxHelper } from '../../../../utilities/SendTxHelper';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const collectOrderBody: CollectFundsRequestBody = await request.json();
  const validation = await CollectFundsValidator.validateCollectFunds(
    userId,
    collectOrderBody
  );
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const txResult = await SendTxHelper.sendTx(
    validation.user!,
    validation.link!,
    collectOrderBody
  );

  if (txResult.success) {
    return NextResponse.json(
      {
        message: txResult.message,
        transactionHash: txResult.transactionHash,
      },
      { status: 200 }
    );
  } else {
    return NextResponse.json({ message: txResult.message }, { status: 400 });
  }
}
