import { Download, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TenancyGate } from '@/components/app/tenancy-gate';
import {
  Badge,
  Banner,
  Card,
  DataTable,
  ErrorText,
  Field,
  PageHeader,
  Select,
  useRun,
} from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { apiDownload, apiFetch, apiUpload } from '@/lib/api';
import { titleCase } from '@/lib/format';
import { useWorkspace } from '@/lib/workspace';

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

export function DocumentsPage() {
  const { canManage } = useWorkspace();
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Signed leases and addenda. Stored with a SHA-256 integrity hash; records are append-only — to replace, upload a superseding document."
      />
      <TenancyGate>{({ tenancyId }) => <DocumentsBody tenancyId={tenancyId} canManage={canManage} />}</TenancyGate>
    </div>
  );
}

function DocumentsBody({ tenancyId, canManage }: { tenancyId: string; canManage: boolean }) {
  const [docs, setDocs] = useState<LeaseDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('LEASE');
  const [signedAt, setSignedAt] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, error, setError, run } = useRun();

  const load = useCallback(async (id: string) => {
    setDocs(await apiFetch<LeaseDocument[]>(`/tenancies/${id}/documents`).catch(() => []));
  }, []);

  useEffect(() => {
    void load(tenancyId);
  }, [tenancyId, load]);

  async function upload() {
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    const ok = await run(async () => {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      if (signedAt) form.append('signedAt', new Date(signedAt).toISOString());
      if (signedBy.trim()) form.append('signedBy', signedBy.trim());
      await apiUpload(`/tenancies/${tenancyId}/documents`, form);
      await load(tenancyId);
    });
    if (ok) {
      setFile(null);
      setSignedAt('');
      setSignedBy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        {canManage ? (
          <Card title="Upload a document">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/40">File</span>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-white hover:file:bg-white/20"
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Select label="Kind" value={kind} onChange={setKind} options={KINDS} />
              <Field label="Signed on (optional)" value={signedAt} onChange={setSignedAt} type="date" />
            </div>
            <div className="mt-3">
              <Field label="Signed by (optional)" value={signedBy} onChange={setSignedBy} placeholder="e.g. Both parties" />
            </div>
            <Button variant="primary" className="mt-4 w-full" disabled={busy || !file} onClick={() => void upload()}>
              <Upload className="size-4" /> {busy ? 'Uploading…' : 'Upload document'}
            </Button>
            <ErrorText>{error}</ErrorText>
          </Card>
        ) : (
          <Card title="Upload a document">
            <Banner tone="blue">Your role has read-only access. You can download documents on file.</Banner>
          </Card>
        )}
      </div>

      <div className="lg:col-span-3">
        <Card title={`On file (${docs.length})`}>
          <DataTable
            columns={[
              {
                header: 'Document',
                render: (d: LeaseDocument) => (
                  <span className="flex items-center gap-2">
                    <span className="text-white/90">{d.fileName}</span>
                    {d.signedAt && <Badge tone="green">Signed</Badge>}
                  </span>
                ),
              },
              { header: 'Kind', render: (d: LeaseDocument) => titleCase(d.kind) },
              { header: 'Size', align: 'right', render: (d: LeaseDocument) => formatBytes(d.sizeBytes) },
              {
                header: '',
                align: 'right',
                render: (d: LeaseDocument) => (
                  <Button variant="ghost" size="sm" onClick={() => void apiDownload(`/documents/${d.id}/download`, d.fileName)}>
                    <Download className="size-3.5" /> Download
                  </Button>
                ),
              },
            ]}
            rows={docs}
            keyOf={(d) => d.id}
            empty="No documents uploaded yet."
          />
        </Card>
      </div>
    </div>
  );
}
