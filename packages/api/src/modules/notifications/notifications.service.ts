import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../infra/db/db.module';
import { Channel, NOTIFICATION_CHANNEL, NotificationChannelAdapter } from './notification.adapter';

export interface DispatchInput {
  landlordId?: string | null;
  channel: Channel;
  recipient: string;
  template?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannelAdapter,
  ) {}

  async dispatch(input: DispatchInput): Promise<{ providerRef: string; status: string }> {
    const result = await this.channel.send({
      channel: input.channel,
      recipient: input.recipient,
      template: input.template,
      payload: input.payload,
    });
    await this.pool.query(
      `INSERT INTO notification_log (landlord_id, channel, recipient, template, payload, status, provider_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.landlordId ?? null,
        input.channel,
        input.recipient,
        input.template ?? null,
        input.payload ? JSON.stringify(input.payload) : null,
        result.status,
        result.providerRef,
      ],
    );
    return result;
  }

  async list(landlordId: string, limit = 100) {
    const { rows } = await this.pool.query(
      `SELECT id, channel, recipient, template, status, provider_ref, created_at
         FROM notification_log WHERE landlord_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [landlordId, limit],
    );
    return rows;
  }
}
