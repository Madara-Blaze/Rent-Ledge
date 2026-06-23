import { Module } from '@nestjs/common';
import { MockNotificationChannel } from './mock-notification.adapter';
import { NOTIFICATION_CHANNEL } from './notification.adapter';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    NotificationsService,
    // Swap for real email/SMS/WhatsApp providers behind the same interface.
    { provide: NOTIFICATION_CHANNEL, useClass: MockNotificationChannel },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
