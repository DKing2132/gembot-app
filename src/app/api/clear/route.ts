import { NextRequest, NextResponse } from "next/server";
import { BuyQueue, REDIS_URL } from "../../../../utilities/constants";
import Queue from 'bull';

export async function DELETE(request: NextRequest) {
    await BuyQueue.pause();
    await BuyQueue.empty();
    await BuyQueue.resume();

    const workQueue = new Queue('dca', REDIS_URL, {
        redis: {
            tls: {
                rejectUnauthorized: false,
                requestCert: true,
            },
        },
    });

    await workQueue.pause();
    await workQueue.empty();
    await workQueue.resume();

    return NextResponse.json({ message: 'success!' }, { status: 200 })
} 