import { NextRequest, NextResponse } from 'next/server';
import { BuyQueue } from '../../../../../utilities/constants';
import { ExecuteTransactionResponse } from '../../../../../types/responses/ExecuteTransactionResponse';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('id');

  if (!jobId) {
    return NextResponse.json(
      { status: 'ERROR', message: 'Invalid job id.' },
      { status: 400 }
    );
  }

  const job = await BuyQueue.getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { status: 'ERROR', message: 'Failed to retrieve job.' },
      { status: 400 }
    );
  }

  if (await job.isCompleted()) {
    console.log('job completed');
    const returnValue: ExecuteTransactionResponse = await job.returnvalue;
    await BuyQueue.removeRepeatableByKey(jobId);
    return NextResponse.json(
      {
        status: 'SUCCESS',
        message: 'Job successfully completed.',
        transactionHash: returnValue.transactionHash,
      },
      { status: 200 }
    );
  } else if (await job.isFailed()) {
    console.log('job failed');
    const failedReason = job.failedReason;
    await BuyQueue.removeRepeatableByKey(jobId);
    return NextResponse.json(
      { status: 'FAILED', message: failedReason ?? 'Job failed.' },
      { status: 400 }
    );
  } else if (
    (await job.isActive()) ||
    (await job.isDelayed()) ||
    (await job.isWaiting()) ||
    (await job.isPaused())
  ) {
    return NextResponse.json(
      { status: 'PENDING', message: 'Job pending.' },
      { status: 200 }
    );
  } else {
    return NextResponse.json(
      { status: 'PENDING', message: 'Job is stuck in an unknown state.' },
      { status: 200 }
    );
  }
}
