import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthField } from '@/components/auth-field';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup({ name, email, password, workspaceName: workspaceName || undefined });
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2.5 text-white">
          <BrandMark size={22} className="text-[#FF0000]" />
          <span className="text-base font-semibold">RentLedger</span>
        </Link>
        <h1 className="text-2xl font-semibold text-white">Create your workspace</h1>
        <p className="mt-2 text-sm text-white/50">Start managing rentals in minutes.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <AuthField label="Full name" value={name} onChange={setName} autoComplete="name" />
          <AuthField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <AuthField label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" placeholder="At least 8 characters" />
          <AuthField label="Workspace name (optional)" value={workspaceName} onChange={setWorkspaceName} placeholder="e.g. Sharma Properties" />
          {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
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
