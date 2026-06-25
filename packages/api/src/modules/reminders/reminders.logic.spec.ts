import { describe, expect, it } from 'vitest';
import { chooseChannel, classifyReminder, reminderKey } from './reminders.logic';

describe('reminders logic', () => {
  it('classifies overdue vs due-soon by date', () => {
    expect(classifyReminder('2026-06-01', '2026-06-24')).toBe('OVERDUE');
    expect(classifyReminder('2026-06-26', '2026-06-24')).toBe('DUE_SOON');
    expect(classifyReminder('2026-06-24', '2026-06-24')).toBe('DUE_SOON'); // due today = not yet overdue
  });

  it('builds a stable per-invoice per-day dedup key', () => {
    expect(reminderKey('inv-1', '2026-06-24')).toBe('rent-reminder:inv-1:2026-06-24');
    expect(reminderKey('inv-1', '2026-06-24')).toBe(reminderKey('inv-1', '2026-06-24'));
    expect(reminderKey('inv-1', '2026-06-25')).not.toBe(reminderKey('inv-1', '2026-06-24'));
  });

  it('prefers phone (WhatsApp) over email and handles no-contact', () => {
    expect(chooseChannel('+919812345678', 'a@b.com')).toEqual({ channel: 'WHATSAPP', recipient: '+919812345678' });
    expect(chooseChannel(null, 'a@b.com')).toEqual({ channel: 'EMAIL', recipient: 'a@b.com' });
    expect(chooseChannel('  ', '')).toBeNull();
    expect(chooseChannel(null, null)).toBeNull();
  });
});
