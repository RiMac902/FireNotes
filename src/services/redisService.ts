import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class RedisService {
  // Онлайн статуси
  static async setUserOnline(userId: string): Promise<void> {
    await redis.set(`user:${userId}:online`, 'true', 'EX', 30);
  }

  static async setUserOffline(userId: string): Promise<void> {
    await redis.del(`user:${userId}:online`);
  }

  static async isUserOnline(userId: string): Promise<boolean> {
    return (await redis.get(`user:${userId}:online`)) === 'true';
  }

  // Активні чати
  static async addActiveChat(userId: string, chatId: string): Promise<void> {
    await redis.sadd(`user:${userId}:active_chats`, chatId);
  }

  static async removeActiveChat(userId: string, chatId: string): Promise<void> {
    await redis.srem(`user:${userId}:active_chats`, chatId);
  }

  static async getActiveChats(userId: string): Promise<string[]> {
    return redis.smembers(`user:${userId}:active_chats`);
  }

  // Типінг індикатор
  static async setTyping(chatId: string, userId: string): Promise<void> {
    await redis.set(`chat:${chatId}:typing:${userId}`, 'true', 'EX', 5);
  }

  static async removeTyping(chatId: string, userId: string): Promise<void> {
    await redis.del(`chat:${chatId}:typing:${userId}`);
  }

  static async getTypingUsers(chatId: string): Promise<string[]> {
    const keys = await redis.keys(`chat:${chatId}:typing:*`);
    return keys.map(key => key.split(':').pop() || '');
  }

  // Кешування повідомлень
  static async cacheMessage(chatId: string, message: any): Promise<void> {
    await redis.lpush(`chat:${chatId}:messages`, JSON.stringify(message));
    await redis.ltrim(`chat:${chatId}:messages`, 0, 99); // Останні 100 повідомлень
  }

  static async getCachedMessages(chatId: string): Promise<any[]> {
    const messages = await redis.lrange(`chat:${chatId}:messages`, 0, -1);
    return messages.map(msg => JSON.parse(msg));
  }

  // Непрочитані повідомлення
  static async incrementUnreadCount(userId: string, chatId: string): Promise<void> {
    await redis.hincrby(`user:${userId}:unread`, chatId, 1);
  }

  static async resetUnreadCount(userId: string, chatId: string): Promise<void> {
    await redis.hset(`user:${userId}:unread`, chatId, 0);
  }

  static async getUnreadCount(userId: string, chatId: string): Promise<number> {
    return parseInt(await redis.hget(`user:${userId}:unread`, chatId) || '0');
  }

  static async getAllUnreadCounts(userId: string): Promise<Record<string, number>> {
    const counts = await redis.hgetall(`user:${userId}:unread`);
    return Object.entries(counts).reduce((acc, [chatId, count]) => ({
      ...acc,
      [chatId]: parseInt(count)
    }), {});
  }

  // Статуси повідомлень
  static async setMessageStatus(messageId: string, status: string): Promise<void> {
    await redis.set(`message:${messageId}:status`, status);
  }

  static async getMessageStatus(messageId: string): Promise<string | null> {
    return redis.get(`message:${messageId}:status`);
  }

  // Очищення даних
  static async clearUserData(userId: string): Promise<void> {
    const keys = await redis.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  static async clearChatData(chatId: string): Promise<void> {
    const keys = await redis.keys(`chat:${chatId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
} 