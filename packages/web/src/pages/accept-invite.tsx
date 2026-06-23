import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthField } from '@/components/auth-field';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { apiFetch, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<AuthTokens>('/auth/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, name: name || undefined, password: password || undefined }),
      });
      setTokens(res.accessToken, res.refreshToken);
      await refreshMe();
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2.5 text-white">
          <BrandMark size={22} className="text-[#FF0000]" />
          <span className="text-base font-semibold">RentLedger</span>
        </Link>
        <h1 className="text-2xl font-semibold text-white">Claim your tenancy</h1>
        <p className="mt-2 text-sm text-white/50">Enter the invitation token your landlord shared with you.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <AuthField label="Invitation token" value={token} onChange={setToken} />
          <AuthField label="Your name (new account)" value={name} onChange={setName} />
          <AuthField label="Set a password (new account)" value={password} onChange={setPassword} type="password" />
          {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !token}>
            {busy ? 'Claiming…' : 'Accept invitation'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-white/50">
          Already have an account?{' '}
          <Link to="/login" className="text-white underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
