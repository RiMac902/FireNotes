import Redis from 'ioredis';

export class RedisService {
  private static redis: Redis;
  private static isConnected: boolean = false;

  static async initialize() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      this.redis.on('error', (error) => {
        console.warn('Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      console.warn('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  private static async ensureConnection() {
    if (!this.isConnected) {
      try {
        await this.initialize();
      } catch (error) {
        console.warn('Failed to reconnect to Redis:', error);
        return false;
      }
    }
    return this.isConnected;
  }

  // Онлайн статуси
  static async setUserOnline(userId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.set(`user:${userId}:online`, 'true', 'EX', 60);
    } catch (error) {
      console.warn('Failed to set user online status:', error);
    }
  }

  static async setUserOffline(userId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.del(`user:${userId}:online`);
    } catch (error) {
      console.warn('Failed to set user offline status:', error);
    }
  }

  static async isUserOnline(userId: string): Promise<boolean> {
    if (!await this.ensureConnection()) return false;
    return (await this.redis.get(`user:${userId}:online`)) === 'true';
  }

  // Активні чати
  static async addActiveChat(userId: string, chatId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.sadd(`user:${userId}:activeChats`, chatId);
    } catch (error) {
      console.warn('Failed to add active chat:', error);
    }
  }

  static async removeActiveChat(userId: string, chatId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.srem(`user:${userId}:activeChats`, chatId);
    } catch (error) {
      console.warn('Failed to remove active chat:', error);
    }
  }

  static async getActiveChats(userId: string): Promise<string[]> {
    if (!await this.ensureConnection()) return [];
    return this.redis.smembers(`user:${userId}:activeChats`);
  }

  // Типінг індикатор
  static async setTyping(chatId: string, userId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.set(`chat:${chatId}:typing:${userId}`, 'true', 'EX', 10);
    } catch (error) {
      console.warn('Failed to set typing status:', error);
    }
  }

  static async removeTyping(chatId: string, userId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.del(`chat:${chatId}:typing:${userId}`);
    } catch (error) {
      console.warn('Failed to remove typing status:', error);
    }
  }

  static async getTypingUsers(chatId: string): Promise<string[]> {
    if (!await this.ensureConnection()) return [];
    const keys = await this.redis.keys(`chat:${chatId}:typing:*`);
    return keys.map(key => key.split(':').pop() || '');
  }

  // Кешування повідомлень
  static async cacheMessage(chatId: string, message: any): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      const key = `chat:${chatId}:messages`;
      await this.redis.lpush(key, JSON.stringify(message));
      await this.redis.ltrim(key, 0, 99); // Keep only last 100 messages
    } catch (error) {
      console.warn('Failed to cache message:', error);
    }
  }

  static async getCachedMessages(chatId: string): Promise<any[]> {
    if (!await this.ensureConnection()) return [];
    try {
      const messages = await this.redis.lrange(`chat:${chatId}:messages`, 0, -1);
      return messages.map(msg => JSON.parse(msg));
    } catch (error) {
      console.warn('Failed to get cached messages:', error);
      return [];
    }
  }

  // Непрочитані повідомлення
  static async incrementUnreadCount(userId: string, chatId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.incr(`user:${userId}:chat:${chatId}:unread`);
    } catch (error) {
      console.warn('Failed to increment unread count:', error);
    }
  }

  static async resetUnreadCount(userId: string, chatId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    try {
      await this.redis.del(`user:${userId}:chat:${chatId}:unread`);
    } catch (error) {
      console.warn('Failed to reset unread count:', error);
    }
  }

  static async getUnreadCount(userId: string, chatId: string): Promise<number> {
    if (!await this.ensureConnection()) return 0;
    try {
      const count = await this.redis.get(`user:${userId}:chat:${chatId}:unread`);
      return parseInt(count || '0');
    } catch (error) {
      console.warn('Failed to get unread count:', error);
      return 0;
    }
  }

  static async getAllUnreadCounts(userId: string): Promise<Record<string, number>> {
    if (!await this.ensureConnection()) return {};
    const counts = await this.redis.hgetall(`user:${userId}:unread`);
    return Object.entries(counts).reduce((acc, [chatId, count]) => ({
      ...acc,
      [chatId]: parseInt(count)
    }), {});
  }

  // Статуси повідомлень
  static async setMessageStatus(messageId: string, status: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    await this.redis.set(`message:${messageId}:status`, status);
  }

  static async getMessageStatus(messageId: string): Promise<string | null> {
    if (!await this.ensureConnection()) return null;
    return this.redis.get(`message:${messageId}:status`);
  }

  // Очищення даних
  static async clearUserData(userId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    const keys = await this.redis.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  static async clearChatData(chatId: string): Promise<void> {
    if (!await this.ensureConnection()) return;
    const keys = await this.redis.keys(`chat:${chatId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
} 