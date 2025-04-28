import { PrismaClient } from '../generated/prisma';
import crypto from 'crypto';
import axios from 'axios';

const prisma = new PrismaClient();

export class WebhookService {
  static async registerWebhook(userId: string, url: string, events: string[]): Promise<void> {
    const secret = crypto.randomBytes(32).toString('hex');
    
    await prisma.webhook.create({
      data: {
        userId,
        url,
        events,
        secret
      }
    });
  }

  static async triggerWebhook(userId: string, event: string, payload: any): Promise<void> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        events: {
          has: event
        }
      }
    });

    for (const webhook of webhooks) {
      try {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');

        await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event
          }
        });
      } catch (error) {
        console.error(`Failed to send webhook to ${webhook.url}:`, error);
      }
    }
  }

  static async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    await prisma.webhook.delete({
      where: {
        id: webhookId,
        userId
      }
    });
  }
} 