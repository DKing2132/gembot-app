class AnalyticsTracker {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async recordBuyTxFailed() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await this.prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            buyTxFailed: analytic.buyTxFailed + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to record buy tx failed');
      console.log(error);
    }
  }

  async recordBuyTxSucceeded() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await this.prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            buyTxSucceeded: analytic.buyTxSucceeded + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to record buy tx succeded');
      console.log(error);
    }
  }

  async recordSellTxFailed() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await this.prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            sellTxFailed: analytic.sellTxFailed + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to record sell tx failed');
      console.log(error);
    }
  }

  async recordSellTxSucceeded() {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        await this.prisma.analytics.update({
          where: {
            id: analytic.id,
          },
          data: {
            sellTxSucceeded: analytic.sellTxSucceeded + 1,
          },
        });
      }
    } catch (error) {
      console.log('Failed to record sell tx succeded');
      console.log(error);
    }
  }

  async recordTokenTotalAmountIncrease(tokenAddress, name, symbol, amount) {
    try {
      const tokenStats = await this.confirmTokenStatsForDay(
        tokenAddress,
        name,
        symbol
      );

      if (tokenStats) {
        await this.prisma.tokenStats.update({
          where: {
            address: tokenStats.address,
          },
          data: {
            totalAmount: tokenStats.totalAmount + amount,
          },
        });
      }
    } catch (error) {
      console.log('Failed to record token total amount increase');
      console.log(error);
    }
  }

  async confirmTokenStatsForDay(tokenAddress, name, symbol) {
    try {
      const analytic = await this.confirmAnalyticsForDay();

      if (analytic) {
        const tokenStats = await this.prisma.tokenStats.findFirst({
          where: {
            address: tokenAddress,
            analyticsId: analytic.id,
          },
        });

        if (tokenStats) {
          return tokenStats;
        } else {
          const newAssetStats = await this.prisma.tokenStats.create({
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
  async confirmAnalyticsForDay() {
    try {
      // get the latest analytic recorded
      const analytic = await this.prisma.analytics.findFirst({
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
          const newAnalytic = await this.prisma.analytics.create({
            data: {
              date: new Date(),
            },
          });

          return newAnalytic;
        }
      } else {
        const newAnalytic = await this.prisma.analytics.create({
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

exports.AnalyticsTracker = AnalyticsTracker;
