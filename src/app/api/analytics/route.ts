import { NextRequest, NextResponse } from 'next/server';
import { AnalyticsTracker } from '../../../../utilities/AnalyticsTracker';
import { prisma } from '../../../../utilities/constants';
import { AnalyticsResponse } from '../../../../types/responses/AnalyticsResponse';

export async function GET(request: NextRequest) {
  console.log(request.url);
  const analytic = await AnalyticsTracker.confirmAnalyticsForDay();

  if (!analytic) {
    return NextResponse.json(
      { message: 'Failed to retrieve analytics.' },
      { status: 400 }
    );
  }

  const tokenStats = await prisma.tokenStats.findMany();

  const response: AnalyticsResponse = {
    buyCount: analytic.buyCount,
    sellCount: analytic.sellCount,
    orderStatusChecks: analytic.orderStatusChecks,
    activeOrderChecks: analytic.activeOrdersChecks,
    ordersCreated: analytic.ordersCreated,
    ordersUpdated: analytic.ordersUpdated,
    ordersDeleted: analytic.ordersDeleted,
    buyTxFailures: analytic.buyTxFailed,
    buyTxSuccesses: analytic.buyTxSucceeded,
    sellTxFailures: analytic.sellTxFailed,
    sellTxSuccesses: analytic.sellTxSucceeded,
    tokens: tokenStats.map((token) => {
      return {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        totalVolume: token.totalAmount.toNumber(),
        searchCount: token.searchCount,
      };
    }),
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
