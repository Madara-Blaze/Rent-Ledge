import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthField } from '@/components/auth-field';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { apiFetch, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Mode = 'password' | 'otp';
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function LoginPage() {
  const { login, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('password');
  const [identifier, setIdentifier] = useState('test@gmail.com');
  const [password, setPassword] = useState('test');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPassword(e: FormEvent) {
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

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ sent: boolean; devCode?: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
      setOtpSent(true);
      setDevCode(res.devCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<AuthTokens>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ identifier, code }),
      });
      setTokens(res.accessToken, res.refreshToken);
      await refreshMe();
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
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

        <div className="mt-6 inline-flex rounded-full border border-white/10 p-0.5 text-sm">
          {(['password', 'otp'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setOtpSent(false);
              }}
              className={`rounded-full px-4 py-1.5 transition-colors ${mode === m ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
            >
              {m === 'password' ? 'Password' : 'One-time code'}
            </button>
          ))}
        </div>

        {mode === 'password' ? (
          <form onSubmit={onPassword} className="mt-6 space-y-4">
            <AuthField label="Email or phone" value={identifier} onChange={setIdentifier} autoComplete="username" />
            <AuthField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
            {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            <AuthField label="Email or phone" value={identifier} onChange={setIdentifier} autoComplete="username" />
            {otpSent && (
              <>
                <AuthField label="One-time code" value={code} onChange={setCode} />
                {devCode && <p className="text-xs text-white/40">Dev code: <span className="font-mono text-white/70">{devCode}</span></p>}
              </>
            )}
            {error && <p className="text-sm text-[#ff6b6b]">{error}</p>}
            {otpSent ? (
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !code}>
                {busy ? 'Verifying…' : 'Verify & sign in'}
              </Button>
            ) : (
              <Button type="button" variant="primary" size="lg" className="w-full" disabled={busy || !identifier} onClick={() => void requestOtp()}>
                {busy ? 'Sending…' : 'Send code'}
              </Button>
            )}
          </form>
        )}

        <p className="mt-6 text-sm text-white/50">
          New here?{' '}
          <Link to="/signup" className="text-white underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-xs text-white/30">
          Test account: test@gmail.com / test ·{' '}
          <Link to="/accept-invite" className="underline-offset-4 hover:underline">
            Have an invite?
          </Link>
        </p>
        <p className="mt-4 text-xs text-white/30">
          By continuing you agree to our{' '}
          <Link to="/terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
