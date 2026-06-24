/**
 * Document storage port. Lease PDFs/scans sit behind this interface so the bytes
 * can live on local disk in dev and in object storage (Supabase Storage / S3) in
 * prod without touching callers. Mirrors the notification-channel adapter pattern.
 */
export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface DocumentStorageAdapter {
  /** Persist bytes under an opaque key. Overwrites are not expected (keys are unique). */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /** Fetch previously-stored bytes. Throws if the key is missing. */
  get(key: string): Promise<Buffer>;
}
