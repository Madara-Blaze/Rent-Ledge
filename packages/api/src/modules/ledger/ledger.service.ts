import { Injectable } from '@nestjs/common';
import { JournalEntryDraftData } from '../../domain/ledger/journal';
import { type Db } from '../../infra/db/db.module';
import { AccountBalanceDto, ArrearsAgeingDto } from './ledger.dto';
import { LedgerRepository } from './ledger.repository';

@Injectable()
export class LedgerService {
  constructor(private readonly repo: LedgerRepository) {}

  /** Post a validated, balanced journal entry. Returns the entry id. */
  postEntry(draft: JournalEntryDraftData, tx?: Db): Promise<string> {
    return this.repo.postEntry(draft, tx);
  }

  async getTenancyBalances(landlordId: string, tenancyId: string): Promise<AccountBalanceDto[]> {
    const balances = await this.repo.getTenancyBalances(landlordId, tenancyId);
    return balances.map((b) => ({
      code: b.code,
      type: b.type,
      debitMinor: b.debitMinor.toString(),
      creditMinor: b.creditMinor.toString(),
      balanceMinor: b.balanceMinor.toString(),
    }));
  }

  async getArrears(landlordId: string, tenancyId: string, asOf: Date): Promise<ArrearsAgeingDto> {
    const a = await this.repo.getArrearsAgeing(landlordId, tenancyId, asOf);
    return {
      bucket0to30: a.bucket0to30.toString(),
      bucket31to60: a.bucket31to60.toString(),
      bucket61to90: a.bucket61to90.toString(),
      bucket90plus: a.bucket90plus.toString(),
      totalOutstanding: a.totalOutstanding.toString(),
    };
  }
}
