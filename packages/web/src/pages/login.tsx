import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthField } from '@/components/auth-field';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('owner@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
        <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-white/50">Sign in to your workspace.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <AuthField label="Email or phone" value={identifier} onChange={setIdentifier} autoComplete="username" />
          <AuthField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
          {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-white/50">
          New here?{' '}
          <Link to="/signup" className="text-white underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-xs text-white/30">Demo (after seeding): owner@example.com / password123</p>
      </div>
    </div>
  );
}
