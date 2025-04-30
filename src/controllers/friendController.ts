import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma';
import { AuthRequest } from '../types/auth';
import { WebhookService } from '../services/webhookService';
import { fcmService } from '../services/fcmService';

const prisma = new PrismaClient();

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
};

export const sendFriendRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId: receiverId } = req.body;
    const senderId = req.user.id;

    // Prevent self-friend requests
    if (senderId === receiverId) {
      res.status(400).json({ error: 'Cannot send friend request to yourself' });
      return;
    }

    // Check if users exist
    const [sender, receiver] = await Promise.all([
      prisma.user.findUnique({ where: { id: senderId } }),
      prisma.user.findUnique({ where: { id: receiverId } })
    ]);

    if (!sender || !receiver) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      }
    });

    if (existingRequest) {
      res.status(400).json({ error: 'Friend request already exists' });
      return;
    }

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId
      }
    });

    // Trigger webhook for receiver
    await WebhookService.triggerWebhook(receiverId, 'friend_request.received', {
      type: 'friend_request.received',
      data: {
        requestId: friendRequest.id,
        sender: {
          id: sender.id,
          name: sender.name,
          email: sender.email
        }
      }
    });

    // Send FCM notification
    await fcmService.sendFriendRequestNotification(
      receiverId,
      sender.name || sender.email,
      friendRequest.id
    );

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Error sending friend request' });
  }
};

export const respondToFriendRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user.id;

    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        sender: true
      }
    });

    if (!friendRequest) {
      res.status(404).json({ error: 'Friend request not found' });
      return;
    }

    // Prevent accepting self-friend requests
    if (friendRequest.senderId === friendRequest.receiverId) {
      res.status(400).json({ error: 'Cannot accept friend request from yourself' });
      return;
    }

    if (action === 'accept') {
      // Create friendship
      await prisma.$transaction([
        prisma.userFriend.create({
          data: {
            userId: friendRequest.senderId,
            friendId: friendRequest.receiverId
          }
        }),
        prisma.userFriend.create({
          data: {
            userId: friendRequest.receiverId,
            friendId: friendRequest.senderId
          }
        }),
        prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTED' }
        })
      ]);

      // Trigger webhook for sender
      await WebhookService.triggerWebhook(friendRequest.senderId, 'friend_request.accepted', {
        type: 'friend_request.accepted',
        data: {
          requestId: friendRequest.id,
          receiver: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email
          }
        }
      });

      // Send FCM notification
      await fcmService.sendFriendRequestAcceptedNotification(
        friendRequest.senderId,
        req.user.name || req.user.email
      );
    } else if (action === 'reject') {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' }
      });

      // Trigger webhook for sender
      await WebhookService.triggerWebhook(friendRequest.senderId, 'friend_request.rejected', {
        type: 'friend_request.rejected',
        data: {
          requestId: friendRequest.id,
          receiver: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email
          }
        }
      });

      // Send FCM notification
      await fcmService.sendFriendRequestRejectedNotification(
        friendRequest.senderId,
        req.user.name || req.user.email
      );
    } else {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    res.json({ message: `Friend request ${action}ed successfully` });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ error: 'Error responding to friend request' });
  }
};

export const getFriendRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;

    const friendRequests = await prisma.friendRequest.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(friendRequests);
  } catch (error) {
    console.error('Error fetching friend requests:', error);
    res.status(500).json({ error: 'Error fetching friend requests' });
  }
};

export const getFriends = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;

    const friends = await prisma.userFriend.findMany({
      where: { userId },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json(friends.map((f: { friend: { id: string; name: string | null; email: string } }) => f.friend));
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Error fetching friends' });
  }
}; 