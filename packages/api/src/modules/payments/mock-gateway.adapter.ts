import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  GatewayChargeRequest,
  GatewayChargeResult,
  GatewayWebhookEvent,
  PaymentGateway,
} from './payment-gateway.adapter';

/** Sandbox gateway: always succeeds, parses webhooks without signature checks. */
@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';

  async createCharge(_req: GatewayChargeRequest): Promise<GatewayChargeResult> {
    return { gatewayPaymentId: `mock_${randomUUID()}`, status: 'SUCCEEDED' };
  }

  verifyWebhook(rawBody: string, _signature?: string): GatewayWebhookEvent {
    let parsed: GatewayWebhookEvent;
    try {
      parsed = JSON.parse(rawBody) as GatewayWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid webhook payload (not JSON)');
    }
    if (!parsed.id || !parsed.gatewayPaymentId || !parsed.amountMinor) {
      throw new BadRequestException('Webhook missing required fields');
    }
    return parsed;
  }
}
