import { PrismaClient } from '../generated/prisma';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class SessionService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  static async createSession(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');

    // Calculate expiration date based on REFRESH_TOKEN_EXPIRY
    const expiresAt = new Date();
    const days = parseInt(this.REFRESH_TOKEN_EXPIRY);
    expiresAt.setDate(expiresAt.getDate() + days);

    await prisma.session.create({
      data: {
        token: accessToken,
        refreshToken,
        userId,
        expiresAt
      }
    });

    return { accessToken, refreshToken };
  }

  static async validateSession(token: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { token }
      });

      if (!session) {
        return false;
      }

      if (session.expiresAt < new Date()) {
        await this.deleteSession(token);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  static async refreshSession(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { refreshToken }
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      // Delete old session
      await this.deleteSession(session.token);

      // Create new session
      return await this.createSession(session.userId);
    } catch (error) {
      console.error('Error refreshing session:', error);
      return null;
    }
  }

  static async deleteSession(token: string): Promise<void> {
    try {
      await prisma.session.delete({
        where: { token }
      });
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  static async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      await prisma.session.deleteMany({
        where: { userId }
      });
    } catch (error) {
      console.error('Error deleting user sessions:', error);
    }
  }
} 