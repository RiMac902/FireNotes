import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  getAllUsers,
  sendFriendRequest,
  respondToFriendRequest,
  getFriendRequests,
  getFriends
} from '../controllers/friendController';

const router = Router();

/**
 * @swagger
 * /api/friends/users:
 *   get:
 *     summary: Get all users
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', auth, getAllUsers);

/**
 * @swagger
 * /api/friends/requests:
 *   post:
 *     summary: Send friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Friend request sent successfully
 */
router.post('/requests', auth, sendFriendRequest);

/**
 * @swagger
 * /api/friends/requests/{requestId}:
 *   post:
 *     summary: Respond to friend request
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: Friend request responded successfully
 */
router.post('/requests/:requestId', auth, respondToFriendRequest);

/**
 * @swagger
 * /api/friends/requests:
 *   get:
 *     summary: Get all friend requests
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friend requests
 */
router.get('/requests', auth, getFriendRequests);

/**
 * @swagger
 * /api/friends:
 *   get:
 *     summary: Get all friends
 *     tags: [Friends]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of friends
 */
router.get('/', auth, getFriends);

export default router; 