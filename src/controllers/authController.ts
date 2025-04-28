import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SessionService } from '../services/sessionService';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    console.log('Registration attempt:', { email, name });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log('User already exists:', email);
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed successfully');

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });
    console.log('User created successfully:', user.id);

    // Create session
    const { accessToken, refreshToken } = await SessionService.createSession(user.id);
    console.log('Session created successfully');

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ 
      error: 'Error creating user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('User not found:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Create new session
    const { accessToken, refreshToken } = await SessionService.createSession(user.id);
    console.log('Login successful for user:', email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ 
      error: 'Error logging in',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const tokens = await SessionService.refreshSession(refreshToken);

    if (!tokens) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json(tokens);
  } catch (error) {
    console.error('Error in refresh:', error);
    res.status(500).json({ error: 'Error refreshing token' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      await SessionService.deleteSession(token);
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout:', error);
    res.status(500).json({ error: 'Error logging out' });
  }
}; 