import { prisma } from './constants';
import { Analytics, TokenStats } from '@prisma/client';

export class AnalyticsTracker {
  public static async recordBuy() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            buyCount: analytic.buyCount + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track buy');
      console.log(error);
    }
  }

  public static async recordSell() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            sellCount: analytic.sellCount + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track sell');
      console.log(error);
    }
  }

  public static async recordOrderStatusCheck() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            orderStatusChecks: analytic.orderStatusChecks + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track order status check');
      console.log(error);
    }
  }

  public static async recordActiveOrdersCheck() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            activeOrdersChecks: analytic.activeOrdersChecks + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track active orders check');
      console.log(error);
    }
  }

  public static async recordOrderCreation() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            ordersCreated: analytic.ordersCreated + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track order creation');
      console.log(error);
    }
  }

  public static async recordOrderDeletion() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            ordersDeleted: analytic.ordersDeleted + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track order deletion');
      console.log(error);
    }
  }

  public static async recordOrderUpdate() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            ordersUpdated: analytic.ordersUpdated + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track order update');
      console.log(error);
    }
  }

  public static async recordTokenSearch(
    tokenAddress: string,
    name: string,
    symbol: string
  ) {
    try {
      const tokenStats = await this.confirmTokenStatsForDay(
        tokenAddress,
        name,
        symbol
      );

      if (tokenStats) {
        await prisma.tokenStats.update({
          where: {
            address: tokenStats.address,
          },
          data: {
            searchCount: tokenStats.searchCount + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to track token search');
      console.log(error);
    }
  }

  public static async confirmTokenStatsForDay(
    tokenAddress: string,
    name: string,
    symbol: string
  ): Promise<TokenStats | null> {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        const tokenStats = await prisma.tokenStats.findFirst({
          where: {
            address: tokenAddress,
            analyticsId: analytic.id,
          },
        });

        if (tokenStats) {
          // done because workers do not have access to name and symbol
          // in the odd chance that they are the ones recording the stats
          // first we will update the name and symbol if they are empty
          if (tokenStats.name === '' || tokenStats.symbol === '') {
            return await prisma.tokenStats.update({
              where: {
                address: tokenStats.address,
              },
              data: {
                name: name,
                symbol: symbol,
              },
            });
          }

          return tokenStats;
        } else {
          const newAssetStats = await prisma.tokenStats.create({
            data: {
              address: tokenAddress,
              name: name,
              symbol: symbol,
              analyticsId: analytic.id,
            },
          });

          return newAssetStats;
        }
      } else {
        return null;
      }
    } catch (error) {
      console.log('Failed to confirm asset stats for day');
      console.log(error);
      return null;
    }
  }

  // creates day analytics for the current day
  // if it already exists it will just return true
  public static async confirmAnalyticsForDay(): Promise<Analytics | null> {
    try {
      // get the latest analytic recorded
      const analytic = await prisma.analytics.findFirst({
        orderBy: {
          date: 'desc',
        },
      });

      // check if we are in the same 24 hour period as analytic
      if (analytic) {
        const now = new Date();
        const analyticDate = new Date(analytic.date);
        var diff = Math.abs(now.getTime() - analyticDate.getTime()); // get difference in milliseconds
        if (diff <= 24 * 60 * 60 * 1000) {
          // less than 24 hours
          return analytic;
        } else {
          const newAnalytic = await prisma.analytics.create({
            data: {
              date: new Date(),
            },
          });

          return newAnalytic;
        }
      } else {
        const newAnalytic = await prisma.analytics.create({
          data: {
            date: new Date(),
          },
        });

        return newAnalytic;
      }
    } catch (err) {
      console.log('Failed to confirm analytics for day');
      console.log(err);
      return null;
    }
  }
}
