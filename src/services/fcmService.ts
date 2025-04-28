import { credential } from 'firebase-admin';
import { App, initializeApp } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Platform = 'IOS' | 'ANDROID' | 'WEB';

interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

class FCMService {
  private static instance: FCMService;
  private app: App;

  private constructor() {
    // Ініціалізація Firebase Admin
    this.app = initializeApp({
      credential: credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  // Зберегти FCM токен для користувача
  async saveToken(userId: string, token: string, platform: Platform, device?: string): Promise<void> {
    await prisma.fcmToken.upsert({
      where: {
        token: token,
      },
      update: {
        isActive: true,
        platform,
        device,
        userId,
      },
      create: {
        token,
        platform,
        device,
        userId,
      },
    });
  }

  // Видалити FCM токен
  async removeToken(token: string): Promise<void> {
    await prisma.fcmToken.update({
      where: { token },
      data: { isActive: false },
    });
  }

  // Отримати активні токени користувача
  async getUserTokens(userId: string): Promise<string[]> {
    const tokens = await prisma.fcmToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: { token: true },
    });
    return tokens.map((t: { token: string }) => t.token);
  }

  // Надіслати push-повідомлення користувачу
  async sendToUser(userId: string, notification: FCMNotification): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    if (tokens.length === 0) return;

    try {
      const message: MulticastMessage = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
        tokens: tokens,
        android: {
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await getMessaging().sendEachForMulticast(message);

      // Обробка невалідних токенів
      if (response.failureCount > 0) {
        const failedTokens = response.responses
          .map((resp: { success: boolean }, idx: number) => resp.success ? null : tokens[idx])
          .filter((token: string | null): token is string => token !== null);

        // Деактивація невалідних токенів
        await prisma.fcmToken.updateMany({
          where: {
            token: {
              in: failedTokens,
            },
          },
          data: {
            isActive: false,
          },
        });
      }
    } catch (error) {
      console.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  // Надіслати push-повідомлення групі користувачів
  async sendToUsers(userIds: string[], notification: FCMNotification): Promise<void> {
    await Promise.all(userIds.map(userId => this.sendToUser(userId, notification)));
  }

  // Надіслати push-повідомлення для чату
  async sendChatNotification(chatId: string, senderId: string, message: FCMNotification): Promise<void> {
    // Отримуємо всіх учасників чату, крім відправника
    const members = await prisma.chatMember.findMany({
      where: {
        chatId,
        userId: {
          not: senderId,
        },
      },
      select: {
        userId: true,
      },
    });

    const userIds = members.map((member: { userId: string }) => member.userId);
    await this.sendToUsers(userIds, message);
  }

  // Надіслати повідомлення про запит на дружбу
  async sendFriendRequestNotification(
    receiverId: string,
    senderName: string,
    requestId: string
  ): Promise<void> {
    await this.sendToUser(receiverId, {
      title: 'You have a new friend request',
      body: `${senderName} sent you a friend request`,
      data: {
        type: 'FRIEND_REQUEST',
        requestId,
        senderName
      }
    });
  }

  // Надіслати повідомлення про прийняття запиту на дружбу
  async sendFriendRequestAcceptedNotification(
    userId: string,
    friendName: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Friend request accepted',
      body: `${friendName} accepted your friend request`,
      data: {
        type: 'FRIEND_REQUEST_ACCEPTED',
        friendName
      }
    });
  }

  // Надіслати повідомлення про відхилення запиту на дружбу
  async sendFriendRequestRejectedNotification(
    userId: string,
    friendName: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      title: 'Friend request rejected',
      body: `${friendName} rejected your friend request`,
      data: {
        type: 'FRIEND_REQUEST_REJECTED',
        friendName
      }
    });
  }
}

export const fcmService = FCMService.getInstance(); 