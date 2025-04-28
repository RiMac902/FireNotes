import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cors from 'cors';
import { PrismaClient } from './generated/prisma';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import noteRoutes from './routes/noteRoutes';
import friendRoutes from './routes/friendRoutes';
import chatRoutes from './routes/chatRoutes';
import { SocketService } from './services/socketService';
import { createServer } from 'http';
import { RedisService } from './services/redisService';

dotenv.config();

const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: Function) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Something broke!' });
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat API',
      version: '1.0.0',
      description: 'A chat application API',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Test route
app.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Server is working!' });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chats', chatRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript + Prisma Server');
});

// Start server
const server = httpServer.listen(port, async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    console.log(`📚[docs]: API documentation available at http://localhost:${port}/api-docs`);

    // Initialize Redis
    await RedisService.initialize();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Process terminated');
  });
});

// Initialize Socket.IO
new SocketService(server);

export default app;
