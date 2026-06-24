import { Download, FileText, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch, ApiError, apiUpload } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { Card, Empty, Field, Pill, Select } from './primitives';

interface LeaseDocument {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: string;
  signedAt: string | null;
  signedBy: string | null;
  notes: string | null;
  createdAt: string;
}

const KINDS = [
  { value: 'LEASE', label: 'Lease' },
  { value: 'ADDENDUM', label: 'Addendum' },
  { value: 'OTHER', label: 'Other' },
];

function formatBytes(bytes: string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsTab({ tenancyId }: { tenancyId: string | null }) {
  const [docs, setDocs] = useState<LeaseDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('LEASE');
  const [signedAt, setSignedAt] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (id: string) => {
    setDocs(await apiFetch<LeaseDocument[]>(`/tenancies/${id}/documents`).catch(() => []));
  }, []);

  useEffect(() => {
    if (tenancyId) void load(tenancyId);
  }, [tenancyId, load]);

  async function upload() {
    if (!tenancyId || !file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      if (signedAt) form.append('signedAt', new Date(signedAt).toISOString());
      if (signedBy.trim()) form.append('signedBy', signedBy.trim());
      await apiUpload(`/tenancies/${tenancyId}/documents`, form);
      setFile(null);
      setSignedAt('');
      setSignedBy('');
      if (fileRef.current) fileRef.current.value = '';
      await load(tenancyId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (!tenancyId) return <Empty>Select a tenancy to manage its documents.</Empty>;

  return (
    <div className="space-y-6">
      <Card title="Upload a lease document">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">File</span>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white hover:file:bg-white/20"
            />
          </label>
          <Select label="Kind" value={kind} onChange={setKind} options={KINDS} />
          <Field label="Signed on (optional)" value={signedAt} onChange={setSignedAt} type="date" />
          <Field label="Signed by (optional)" value={signedBy} onChange={setSignedBy} placeholder="e.g. Both parties" />
        </div>
        {error && <p className="mt-3 text-sm text-[#FF0000]">{error}</p>}
        <Button variant="primary" className="mt-4" disabled={busy || !file} onClick={() => void upload()}>
          <Upload className="size-4" /> {busy ? 'Uploading…' : 'Upload document'}
        </Button>
        <p className="mt-3 text-xs text-white/30">
          Stored with a SHA-256 integrity hash. Records are append-only — to replace, upload a superseding document.
        </p>
      </Card>

      <Card title={`Documents (${docs.length})`}>
        {docs.length === 0 ? (
          <Empty>No documents uploaded yet.</Empty>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-5 shrink-0 text-white/40" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white/90">{d.fileName}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/40">
                      <Pill>{titleCase(d.kind)}</Pill>
                      <span>{formatBytes(d.sizeBytes)}</span>
                      {d.signedAt && <span className="text-emerald-400/80">Signed {d.signedAt.slice(0, 10)}</span>}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void apiDownload(`/documents/${d.id}/download`, d.fileName)}
                >
                  <Download className="size-4" /> Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
