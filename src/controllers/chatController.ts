import { Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { AuthRequest } from '../types/auth';
import { fcmService } from '../services/fcmService';

const prisma = new PrismaClient();

// Створення групового чату
export const createGroupChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, description, avatar, memberIds } = req.body;
    const creatorId = req.user.id;

    // Створюємо чат
    const chat = await prisma.chat.create({
      data: {
        name,
        description,
        avatar,
        type: 'GROUP',
        members: {
          create: [
            {
              userId: creatorId,
              role: 'ADMIN'
            },
            ...memberIds.map((userId: string) => ({
              userId,
              role: 'MEMBER'
            }))
          ]
        }
      },
      include: {
        members: {
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

    // Створюємо системне повідомлення про створення групи
    await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: 'system',
        content: `${req.user.name || req.user.email} created the group`,
        type: 'SYSTEM'
      }
    });

    // Відправляємо FCM повідомлення всім учасникам
    for (const member of chat.members) {
      if (member.userId !== creatorId) {
        await fcmService.sendToUser(member.userId, {
          title: 'New Group Chat',
          body: `You were added to the group "${name}"`,
          data: {
            type: 'GROUP_CREATED',
            chatId: chat.id,
            groupName: name
          }
        });
      }
    }

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating group chat:', error);
    res.status(500).json({ error: 'Error creating group chat' });
  }
};

// Оновлення інформації про групу (тільки адмін)
export const updateGroupInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;
    const { name, description, avatar } = req.body;

    // Перевіряємо чи користувач є адміном групи
    const member = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId: req.user.id,
        role: 'ADMIN'
      }
    });

    if (!member) {
      res.status(403).json({ error: 'Only group admins can update group info' });
      return;
    }

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        name,
        description,
        avatar
      },
      include: {
        members: {
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

    // Створюємо системне повідомлення про оновлення
    await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: 'system',
        content: `${req.user.name || req.user.email} updated group info`,
        type: 'SYSTEM'
      }
    });

    res.json(chat);
  } catch (error) {
    console.error('Error updating group info:', error);
    res.status(500).json({ error: 'Error updating group info' });
  }
};

// Додавання учасників до групи (тільки адмін)
export const addGroupMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;
    const { userIds } = req.body;

    // Перевіряємо чи користувач є адміном групи
    const member = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId: req.user.id,
        role: 'ADMIN'
      }
    });

    if (!member) {
      res.status(403).json({ error: 'Only group admins can add members' });
      return;
    }

    // Отримуємо інформацію про групу
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
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

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Додаємо нових учасників
    await prisma.chatMember.createMany({
      data: userIds.map((userId: string) => ({
        chatId,
        userId,
        role: 'MEMBER'
      })),
      skipDuplicates: true
    });

    // Створюємо системне повідомлення
    await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: 'system',
        content: `${req.user.name || req.user.email} added new members to the group`,
        type: 'SYSTEM'
      }
    });

    // Відправляємо FCM повідомлення новим учасникам
    for (const userId of userIds) {
      await fcmService.sendToUser(userId, {
        title: 'Added to Group',
        body: `You were added to the group "${chat.name}"`,
        data: {
          type: 'ADDED_TO_GROUP',
          chatId: chat.id,
          groupName: chat.name || 'Unnamed Group'
        }
      });
    }

    res.json({ message: 'Members added successfully' });
  } catch (error) {
    console.error('Error adding group members:', error);
    res.status(500).json({ error: 'Error adding group members' });
  }
};

// Видалення учасників з групи (тільки адмін)
export const removeGroupMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;
    const { userIds } = req.body;

    // Перевіряємо чи користувач є адміном групи
    const member = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId: req.user.id,
        role: 'ADMIN'
      }
    });

    if (!member) {
      res.status(403).json({ error: 'Only group admins can remove members' });
      return;
    }

    // Отримуємо інформацію про групу
    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    });

    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Видаляємо учасників
    await prisma.chatMember.deleteMany({
      where: {
        chatId,
        userId: {
          in: userIds
        }
      }
    });

    // Створюємо системне повідомлення
    await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: 'system',
        content: `${req.user.name || req.user.email} removed members from the group`,
        type: 'SYSTEM'
      }
    });

    // Відправляємо FCM повідомлення видаленим учасникам
    for (const userId of userIds) {
      await fcmService.sendToUser(userId, {
        title: 'Removed from Group',
        body: `You were removed from the group "${chat.name}"`,
        data: {
          type: 'REMOVED_FROM_GROUP',
          chatId: chat.id,
          groupName: chat.name || 'Unnamed Group'
        }
      });
    }

    res.json({ message: 'Members removed successfully' });
  } catch (error) {
    console.error('Error removing group members:', error);
    res.status(500).json({ error: 'Error removing group members' });
  }
};

// Отримання списку групових чатів користувача
export const getUserGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groups = await prisma.chat.findMany({
      where: {
        type: 'GROUP',
        members: {
          some: {
            userId: req.user.id
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        lastMessage: true
      }
    });

    res.json(groups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    res.status(500).json({ error: 'Error fetching user groups' });
  }
};

// Створення one-on-one чату
export const createOneOnOneChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId } = req.body;
    const creatorId = req.user.id;

    // Перевіряємо чи користувачі є друзями
    const friendship = await prisma.userFriend.findFirst({
      where: {
        OR: [
          { userId: creatorId, friendId: userId },
          { userId: userId, friendId: creatorId }
        ]
      }
    });

    if (!friendship) {
      res.status(403).json({ error: 'You can only chat with your friends' });
      return;
    }

    // Перевіряємо чи чат вже існує
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [creatorId, userId]
            }
          }
        }
      }
    });

    if (existingChat) {
      res.json(existingChat);
      return;
    }

    // Створюємо чат
    const chat = await prisma.chat.create({
      data: {
        type: 'PRIVATE',
        members: {
          create: [
            {
              userId: creatorId,
              role: 'MEMBER'
            },
            {
              userId,
              role: 'MEMBER'
            }
          ]
        }
      },
      include: {
        members: {
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

    // Відправляємо FCM повідомлення
    await fcmService.sendToUser(userId, {
      title: 'New Chat',
      body: `${req.user.name || req.user.email} started a chat with you`,
      data: {
        type: 'ONE_ON_ONE_CHAT_CREATED',
        chatId: chat.id
      }
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating one-on-one chat:', error);
    res.status(500).json({ error: 'Error creating one-on-one chat' });
  }
};

// Отримання повідомлень чату
export const getChatMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { chatId } = req.params;
    const userId = req.user.id;

    // Перевіряємо чи користувач є учасником чату
    const member = await prisma.chatMember.findFirst({
      where: {
        chatId,
        userId
      }
    });

    if (!member) {
      res.status(403).json({ error: 'You are not a member of this chat' });
      return;
    }

    // Отримуємо повідомлення
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        isDeleted: false
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        replyTo: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Оновлюємо lastReadAt
    await prisma.chatMember.update({
      where: {
        id: member.id
      },
      data: {
        lastReadAt: new Date()
      }
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Error fetching chat messages' });
  }
}; 