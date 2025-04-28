import jwt from 'jsonwebtoken';

interface DecodedToken {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

export const verifyToken = async (token: string): Promise<DecodedToken> => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as DecodedToken;
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}; 