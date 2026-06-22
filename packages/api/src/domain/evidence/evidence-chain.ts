import { sha256 } from '../../common/crypto/tokens';

/**
 * Hash-chained evidence log. Each entry stores the hash of its content, the hash
 * of the previous entry, and its own entry hash = H(prevHash | contentHash | seq |
 * createdAt). Any edit/insert/delete breaks the chain, making tampering detectable.
 */
export const GENESIS_HASH = '0'.repeat(64);

export interface EvidenceContent {
  entryType: string;
  summary: string;
  content?: unknown;
  authorUserId?: string | null;
}

export function contentHashOf(c: EvidenceContent): string {
  return sha256(
    JSON.stringify({
      entryType: c.entryType,
      summary: c.summary,
      content: c.content ?? null,
      authorUserId: c.authorUserId ?? null,
    }),
  );
}

export function entryHashOf(prevHash: string, contentHash: string, seq: number | bigint, createdAt: string): string {
  return sha256(`${prevHash}|${contentHash}|${seq.toString()}|${createdAt}`);
}

export interface ChainEntry {
  seq: number | bigint;
  contentHash: string;
  prevHash: string;
  entryHash: string;
  createdAt: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAtSeq?: number;
  reason?: string;
}

export function verifyChain(entries: ChainEntry[]): ChainVerification {
  let prev = GENESIS_HASH;
  const sorted = [...entries].sort((a, b) => Number(a.seq) - Number(b.seq));
  for (const e of sorted) {
    if (e.prevHash !== prev) {
      return { valid: false, brokenAtSeq: Number(e.seq), reason: 'prev_hash does not match the prior entry' };
    }
    const expected = entryHashOf(e.prevHash, e.contentHash, e.seq, e.createdAt);
    if (e.entryHash !== expected) {
      return { valid: false, brokenAtSeq: Number(e.seq), reason: 'entry_hash mismatch — entry was tampered with' };
    }
    prev = e.entryHash;
  }
  return { valid: true };
}
