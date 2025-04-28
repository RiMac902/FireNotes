import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../types/auth';

const prisma = new PrismaClient();

export const createNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content } = req.body;
    const userId = req.user.id;

    const note = await prisma.note.create({
      data: {
        title,
        content,
        userId
      }
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Error creating note' });
  }
};

export const getNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.id;

    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { userId },
          { sharedWith: { some: { userId } } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        sharedWith: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Error fetching notes' });
  }
};

export const getNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const userId = req.user.id;

    const note = await prisma.note.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { sharedWith: { some: { userId } } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        sharedWith: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ error: 'Error fetching note' });
  }
};

export const updateNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;

    const note = await prisma.note.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const updatedNote = await prisma.note.update({
      where: { id },
      data: {
        title,
        content
      }
    });

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Error updating note' });
  }
};

export const deleteNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const userId = req.user.id;

    const note = await prisma.note.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await prisma.note.delete({
      where: { id }
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Error deleting note' });
  }
};

export const shareNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { userId: shareWithUserId } = req.body;
    const userId = req.user.id;

    const note = await prisma.note.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const sharedNote = await prisma.sharedNote.create({
      data: {
        noteId: id,
        userId: shareWithUserId
      }
    });

    res.status(201).json(sharedNote);
  } catch (error) {
    console.error('Error sharing note:', error);
    res.status(500).json({ error: 'Error sharing note' });
  }
};

export const unshareNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { userId: unshareWithUserId } = req.body;
    const userId = req.user.id;

    const note = await prisma.note.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await prisma.sharedNote.delete({
      where: {
        noteId_userId: {
          noteId: id,
          userId: unshareWithUserId
        }
      }
    });

    res.json({ message: 'Note unshared successfully' });
  } catch (error) {
    console.error('Error unsharing note:', error);
    res.status(500).json({ error: 'Error unsharing note' });
  }
}; 