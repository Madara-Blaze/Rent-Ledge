import { describe, expect, it } from 'vitest';
import { ChainEntry, GENESIS_HASH, contentHashOf, entryHashOf, verifyChain } from './evidence-chain';

function buildChain(items: { summary: string }[]): ChainEntry[] {
  const entries: ChainEntry[] = [];
  let prev = GENESIS_HASH;
  items.forEach((it, i) => {
    const createdAt = `2026-01-0${i + 1}T00:00:00.000Z`;
    const contentHash = contentHashOf({ entryType: 'NOTE', summary: it.summary });
    const entryHash = entryHashOf(prev, contentHash, i + 1, createdAt);
    entries.push({ seq: i + 1, contentHash, prevHash: prev, entryHash, createdAt });
    prev = entryHash;
  });
  return entries;
}

describe('evidence hash chain', () => {
  it('verifies an intact chain', () => {
    const chain = buildChain([{ summary: 'payment proof' }, { summary: 'notice sent' }, { summary: 'photo' }]);
    expect(verifyChain(chain)).toEqual({ valid: true });
  });

  it('detects a tampered entry (content changed after the fact)', () => {
    const chain = buildChain([{ summary: 'a' }, { summary: 'b' }, { summary: 'c' }]);
    chain[1] = { ...chain[1], contentHash: contentHashOf({ entryType: 'NOTE', summary: 'FORGED' }) };
    const r = verifyChain(chain);
    expect(r.valid).toBe(false);
    expect(r.brokenAtSeq).toBe(2);
  });

  it('detects a broken link (deleted/reordered entry)', () => {
    const chain = buildChain([{ summary: 'a' }, { summary: 'b' }, { summary: 'c' }]);
    const withoutMiddle = [chain[0], chain[2]];
    expect(verifyChain(withoutMiddle).valid).toBe(false);
  });
});
