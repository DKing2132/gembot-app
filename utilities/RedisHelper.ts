import { RedisClient } from './constants';

export class RedisHelper {
  public static async get(key: string): Promise<string | null> {
    try {
      await RedisClient.connect();
      const result = await RedisClient.get(key);
      await RedisClient.disconnect();
      return result;
    } catch (error) {
      console.log('Failed to get key from redis');
      console.log(error);
      await RedisClient.disconnect();
      return null;
    }
  }

  public static async set(key: string, value: string): Promise<boolean> {
    try {
      await RedisClient.connect();
      await RedisClient.set(key, value, {
        EX: 60 * 5, // 5 minutes
      });
      await RedisClient.disconnect();
      return true;
    } catch (error) {
      console.log('Failed to set key in redis');
      console.log(error);
      await RedisClient.disconnect();
      return false;
    }
  }

  public static async GetTokenMarketCapKey(address: string) {
    return `${address}-market-cap`;
  }
}
