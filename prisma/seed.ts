import { PrismaClient } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create system user
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@firenotes.com' },
    update: {},
    create: {
      email: 'system@firenotes.com',
      password: await bcrypt.hash('system123', 10),
      name: 'System',
      role: 'ADMIN'
    }
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN'
    }
  });

  // Create regular users
  const user1Password = await bcrypt.hash('user123', 10);
  const user1 = await prisma.user.upsert({
    where: { email: 'user1@example.com' },
    update: {},
    create: {
      email: 'user1@example.com',
      password: user1Password,
      name: 'User One'
    }
  });

  const user2Password = await bcrypt.hash('user123', 10);
  const user2 = await prisma.user.upsert({
    where: { email: 'user2@example.com' },
    update: {},
    create: {
      email: 'user2@example.com',
      password: user2Password,
      name: 'User Two'
    }
  });

  // Create friend requests
  await prisma.friendRequest.upsert({
    where: {
      senderId_receiverId: {
        senderId: user1.id,
        receiverId: user2.id
      }
    },
    update: {},
    create: {
      senderId: user1.id,
      receiverId: user2.id,
      status: 'PENDING'
    }
  });

  // Create some notes
  await prisma.note.create({
    data: {
      title: 'Welcome Note',
      content: 'Welcome to FireNotes!',
      userId: admin.id
    }
  });

  await prisma.note.create({
    data: {
      title: 'My First Note',
      content: 'This is my first note in FireNotes.',
      userId: user1.id
    }
  });

  // Create a group chat
  const groupChat = await prisma.chat.create({
    data: {
      name: 'General Chat',
      description: 'A general chat for all users',
      type: 'GROUP',
      members: {
        create: [
          {
            userId: admin.id,
            role: 'ADMIN'
          },
          {
            userId: user1.id,
            role: 'MEMBER'
          },
          {
            userId: user2.id,
            role: 'MEMBER'
          }
        ]
      }
    }
  });

  // Add a welcome message to the group chat
  await prisma.message.create({
    data: {
      chatId: groupChat.id,
      userId: systemUser.id,
      content: 'Welcome to the General Chat!',
      type: 'SYSTEM'
    }
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 