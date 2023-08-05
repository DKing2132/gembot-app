import { NextRequest, NextResponse } from 'next/server';
import { LinkOrderBody } from '../../../../types/requests/LinkOrderBody';
import { LinkValidator } from '../../../../utilities/validators/LinkValidator';
import { prisma } from '../../../../utilities/constants';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('genesis-bot-user-id');
  if (!userId) {
    console.log('User ID not found in request header');
    return NextResponse.json(
      { message: 'Failed to retrieve user id.' },
      { status: 400 }
    );
  }

  const linkOrderBody: LinkOrderBody = await request.json();
  const validation = await LinkValidator.validateLink(userId, linkOrderBody);
  if (!validation.valid) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  try {
    await prisma.link.upsert({
      create: {
        userId: userId,
        walletAddress: linkOrderBody.walletAddress,
      },
      update: {
        walletAddress: linkOrderBody.walletAddress,
      },
      where: {
        userId: userId,
      },
    });

    return NextResponse.json(
      {
        message: 'Successfully linked wallet address',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Failed to link wallet address to user.' },
      { status: 400 }
    );
  }
}
