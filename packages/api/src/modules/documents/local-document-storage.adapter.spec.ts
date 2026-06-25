import type { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalDocumentStorage } from './local-document-storage.adapter';

describe('LocalDocumentStorage', () => {
  let dir: string;
  let storage: LocalDocumentStorage;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rl-storage-'));
    const config = { get: () => dir } as unknown as ConfigService;
    storage = new LocalDocumentStorage(config);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips bytes through a namespaced key', async () => {
    const bytes = Buffer.from('lease agreement contents');
    await storage.put('leases/tenancy-1/abc-lease.pdf', bytes, 'application/pdf');
    const got = await storage.get('leases/tenancy-1/abc-lease.pdf');
    expect(got.equals(bytes)).toBe(true);
  });

  it('rejects path-traversal keys (cannot escape the storage root)', async () => {
    await expect(storage.put('../escape.txt', Buffer.from('x'), 'text/plain')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(storage.get('../../etc/passwd')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws when a stored object is missing', async () => {
    await expect(storage.get('leases/tenancy-1/does-not-exist.pdf')).rejects.toBeInstanceOf(NotFoundException);
  });
});
