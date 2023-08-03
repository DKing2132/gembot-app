import { NextRequest, NextResponse } from "next/server";
import { BuyQueue, WorkQueue } from "../../../../utilities/constants";

export async function DELETE(request: NextRequest) {
    await BuyQueue.pause();
    await BuyQueue.empty();
    await BuyQueue.resume();

    await WorkQueue.pause();
    await WorkQueue.empty();
    await WorkQueue.resume();

    return NextResponse.json({ message: 'success!' }, { status: 200 })
} 