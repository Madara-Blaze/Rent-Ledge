/**
 * Notification channel port. Email/SMS/WhatsApp/push/in-app all sit behind one
 * interface; the mock logs and records. Every send is written to notification_log.
 */
export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';

export interface NotificationMessage {
  channel: Channel;
  recipient: string;
  template?: string;
  payload?: Record<string, unknown>;
}

export interface NotificationResult {
  providerRef: string;
  status: 'SENT' | 'FAILED';
}

export interface NotificationChannelAdapter {
  send(message: NotificationMessage): Promise<NotificationResult>;
}
