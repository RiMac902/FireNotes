import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  createGroupChat,
  updateGroupInfo,
  addGroupMembers,
  removeGroupMembers,
  getUserGroups
} from '../controllers/chatController';

const router = Router();

/**
 * @swagger
 * /api/chats/groups:
 *   post:
 *     summary: Create a new group chat
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - memberIds
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Group chat created successfully
 */
router.post('/groups', auth, createGroupChat);

/**
 * @swagger
 * /api/chats/groups/{chatId}:
 *   put:
 *     summary: Update group chat info
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Group info updated successfully
 */
router.put('/groups/:chatId', auth, updateGroupInfo);

/**
 * @swagger
 * /api/chats/groups/{chatId}/members:
 *   post:
 *     summary: Add members to group
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
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
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Members added successfully
 */
router.post('/groups/:chatId/members', auth, addGroupMembers);

/**
 * @swagger
 * /api/chats/groups/{chatId}/members:
 *   delete:
 *     summary: Remove members from group
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
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
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Members removed successfully
 */
router.delete('/groups/:chatId/members', auth, removeGroupMembers);

/**
 * @swagger
 * /api/chats/groups:
 *   get:
 *     summary: Get user's group chats
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's group chats
 */
router.get('/groups', auth, getUserGroups);

export default router; 