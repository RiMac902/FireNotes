import { Prisma } from '@prisma/client';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: Prisma.UserGetPayload<{}>;
    }
  }
}

export interface AuthRequest extends Request {
  user?: Prisma.UserGetPayload<{}>;
  body: any;
  params: any;
} 