import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { DocumentStorageAdapter } from './document-storage.adapter';

/**
 * Dev/default storage: writes bytes to a local directory. Keys are namespaced
 * paths (e.g. `leases/<tenancyId>/<uuid>-name.pdf`); we resolve them against the
 * base dir and refuse anything that escapes it (path-traversal guard).
 */
@Injectable()
export class LocalDocumentStorage implements DocumentStorageAdapter {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(config.get<string>('DOCUMENT_STORAGE_DIR') ?? '.storage');
  }

  private pathFor(key: string): string {
    const full = resolve(this.baseDir, key);
    // SECURITY: ensure the resolved path stays inside the storage root.
    if (full !== this.baseDir && !full.startsWith(this.baseDir + sep)) {
      throw new NotFoundException('Invalid storage key');
    }
    return full;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Buffer> {
    const path = this.pathFor(key);
    if (!existsSync(path)) throw new NotFoundException('Stored document not found');
    return readFile(path);
  }
}
