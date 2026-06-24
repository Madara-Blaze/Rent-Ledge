import type { Channel } from '../notifications/notification.adapter';

export type ReminderBucket = 'OVERDUE' | 'DUE_SOON';

/** Classify an open invoice relative to today (dates are ISO yyyy-mm-dd). */
export function classifyReminder(dueDate: string, today: string): ReminderBucket {
  return dueDate < today ? 'OVERDUE' : 'DUE_SOON';
}

/**
 * Deterministic dedup key: one reminder per invoice per calendar day. Stored in
 * notification_log.payload so re-running "send due" the same day is idempotent.
 */
export function reminderKey(invoiceId: string, today: string): string {
  return `rent-reminder:${invoiceId}:${today}`;
}

/**
 * Pick the best contact channel for a tenant. India-first: prefer WhatsApp/SMS to
 * a phone, fall back to email. Returns null if we have no way to reach them.
 */
export function chooseChannel(
  phone: string | null | undefined,
  email: string | null | undefined,
): { channel: Channel; recipient: string } | null {
  if (phone && phone.trim()) return { channel: 'WHATSAPP', recipient: phone.trim() };
  if (email && email.trim()) return { channel: 'EMAIL', recipient: email.trim() };
  return null;
}
