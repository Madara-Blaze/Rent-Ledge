import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NotificationChannelAdapter, NotificationMessage, NotificationResult } from './notification.adapter';

/** Sandbox channel: logs the message and returns a provider reference. */
@Injectable()
export class MockNotificationChannel implements NotificationChannelAdapter {
  private readonly logger = new Logger('Notifications');

  async send(message: NotificationMessage): Promise<NotificationResult> {
    this.logger.log(`[${message.channel}] → ${message.recipient}${message.template ? ` (${message.template})` : ''}`);
    return { providerRef: `ntf_${randomUUID()}`, status: 'SENT' };
  }
}
