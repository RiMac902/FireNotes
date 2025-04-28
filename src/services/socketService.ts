import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { RedisService } from './redisService';
import { verifyToken } from '../utils/auth';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
  };
}

const prisma = new PrismaClient();

export class SocketService {
  private io: SocketIOServer;
  private prisma: PrismaClient;
  private redisService: RedisService;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    this.prisma = new PrismaClient();
    this.redisService = new RedisService();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    // Authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = await verifyToken(token);
        (socket as AuthenticatedSocket).user = {
          id: decoded.id,
          email: decoded.email
        };
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', async (socket) => {
      const userId = (socket as any).user.id;

      // Користувач онлайн
      await RedisService.setUserOnline(userId);
      this.io.emit('user:online', { userId });

      // Оновлення статусу кожні 30 секунд
      const interval = setInterval(async () => {
        await RedisService.setUserOnline(userId);
      }, 30000);

      // Приєднання до чату
      socket.on('chat:join', async (chatId: string) => {
        socket.join(chatId);
        await RedisService.addActiveChat(userId, chatId);
        
        // Отримання кешованих повідомлень
        const messages = await RedisService.getCachedMessages(chatId);
        socket.emit('chat:messages', { chatId, messages });
      });

      // Вихід з чату
      socket.on('chat:leave', async (chatId: string) => {
        socket.leave(chatId);
        await RedisService.removeActiveChat(userId, chatId);
      });

      // Типінг
      socket.on('chat:typing:start', async (chatId: string) => {
        await RedisService.setTyping(chatId, userId);
        socket.to(chatId).emit('chat:typing:start', { userId });
      });

      socket.on('chat:typing:stop', async (chatId: string) => {
        await RedisService.removeTyping(chatId, userId);
        socket.to(chatId).emit('chat:typing:stop', { userId });
      });

      // Надсилання повідомлення
      socket.on('message:send', async (data: {
        chatId: string;
        content: string;
        type: string;
        replyToId?: string;
      }) => {
        const { chatId, content, type, replyToId } = data;

        // Створення повідомлення в базі даних
        const message = await prisma.message.create({
          data: {
            chatId,
            userId,
            content,
            type: type as any,
            replyToId
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            replyTo: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        // Кешування повідомлення
        await RedisService.cacheMessage(chatId, message);

        // Відправка повідомлення всім учасникам чату
        this.io.to(chatId).emit('message:new', message);

        // Оновлення лічильника непрочитаних
        const members = await prisma.chatMember.findMany({
          where: { chatId }
        });

        for (const member of members) {
          if (member.userId !== userId) {
            await RedisService.incrementUnreadCount(member.userId, chatId);
            this.io.to(member.userId).emit('message:unread', {
              chatId,
              count: await RedisService.getUnreadCount(member.userId, chatId)
            });
          }
        }
      });

      // Видалення повідомлення
      socket.on('message:delete', async (messageId: string) => {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
          include: { chat: true }
        });

        if (message && message.userId === userId) {
          await prisma.message.update({
            where: { id: messageId },
            data: { isDeleted: true }
          });

          this.io.to(message.chatId).emit('message:deleted', { messageId });
        }
      });

      // Відключення
      socket.on('disconnect', async () => {
        clearInterval(interval);
        await RedisService.setUserOffline(userId);
        this.io.emit('user:offline', { userId });
      });
    });
  }

  // Методи для відправки повідомлень з сервера
  public async sendMessage(chatId: string, message: any) {
    this.io.to(chatId).emit('message:new', message);
  }

  public async sendSystemMessage(chatId: string, content: string) {
    const message = await prisma.message.create({
      data: {
        chatId,
        userId: 'system',
        content,
        type: 'SYSTEM'
      }
    });

    this.io.to(chatId).emit('message:new', message);
  }

  public async notifyUser(userId: string, event: string, data: any) {
    this.io.to(userId).emit(event, data);
  }
} 