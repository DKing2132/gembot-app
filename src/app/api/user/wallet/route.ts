import { NextRequest, NextResponse } from 'next/server';
import { UserValidator } from '../../../../../utilities/validators/UserValidator';
import { prisma } from '../../../../../utilities/constants';
import { GetWalletResponse } from '../../../../../types/responses/GetWalletResponse';

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

  // get params from request can either be wallets= and includeEPK=true/false
  const { searchParams } = new URL(request.url);
  const walletsToInclude = searchParams.get('wallet');

  if (!walletsToInclude) {
    return NextResponse.json(
      { message: 'Failed to retrieve wallets to include.' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  let walletAddress: GetWalletResponse = {};
  if (walletsToInclude === '1') {
    walletAddress.walletAddress = user!.wallet1;
  } else if (walletsToInclude === '2') {
    walletAddress.walletAddress = user!.wallet2;
  } else if (walletsToInclude === '3') {
    walletAddress.walletAddress = user!.wallet3;
  } else {
    return NextResponse.json(
      { message: 'Failed to retrieve wallets to include.' },
      { status: 400 }
    );
  }

  return NextResponse.json(walletAddress, { status: 200 });
}
