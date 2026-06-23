import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ESignProvider, SignRequest, SignResult } from './esign.adapter';

/** Sandbox e-sign: instantly "signs" and echoes the document hash. */
@Injectable()
export class MockESignProvider implements ESignProvider {
  readonly name = 'mock-esign';

  async sign(req: SignRequest): Promise<SignResult> {
    return {
      provider: this.name,
      providerRef: `esign_${randomUUID()}`,
      documentHash: req.documentHash,
      signedAt: new Date(),
      status: 'SIGNED',
    };
  }
}
