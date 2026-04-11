'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { restoreAuthSession, setAuthSnapshotFromUser } from '@/features/auth/authStore';
import styles from './login.module.css';

/**
 * SECURITY: validate `next` redirect parameter to prevent open redirect attacks.
 * Only allows relative paths starting with '/'. Rejects external URLs, protocol-relative
 * URLs, and paths that try to escape the origin.
 */
function sanitizeNext(raw: string | null | undefined): string {
  const fallback = '/';
  if (!raw) return fallback;
  try {
    // Reject anything that looks like an absolute URL or protocol-relative URL
    if (/^(https?:|\/\/|javascript:|data:)/i.test(raw)) return fallback;
    // Must start with '/' (relative path)
    if (!raw.startsWith('/')) return fallback;
    // Reject paths with backslashes (Windows-style bypass attempts)
    if (raw.includes('\\')) return fallback;
    // Reject encoded slashes that could form //external.com
    const decoded = decodeURIComponent(raw);
    if (/^\/\//i.test(decoded)) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [form,  setForm]  = useState({ username: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);
  const [ssoChecking, setSsoChecking] = useState(true);
  const [ssoMessage, setSsoMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = sanitizeNext(searchParams?.get('next'));
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await restoreAuthSession();
        if (cancelled) return;
        if (session) {
          if (session.must_change_password) {
            router.replace(`/user-info?must_change_password=1&next=${encodeURIComponent(next)}`);
            return;
          }
          router.replace(next);
          return;
        }

        const res = await fetch('/api/v1/auth/sso', { cache: 'no-store', credentials: 'include' });
        if (cancelled) return;

        if (res.status === 204) {
          setSsoMessage(null);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setAuthSnapshotFromUser(data.user);
          if (data.user?.must_change_password) {
            router.replace(`/user-info?must_change_password=1&next=${encodeURIComponent(next)}`);
            return;
          }
          router.replace(next);
          return;
        }

        const text = await res.text().catch(() => '');
        if (cancelled) return;
        if (res.status === 403) {
          setSsoMessage('Doménový účet byl rozpoznán, ale v aplikaci pro něj není aktivní účet.');
        } else {
          setSsoMessage(null);
        }
      } catch {
        if (!cancelled) setSsoMessage(null);
      } finally {
        if (!cancelled) setSsoChecking(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Přihlášení selhalo');
      setAuthSnapshotFromUser(data.user);
      const next = sanitizeNext(searchParams?.get('next'));
      if (data.user?.must_change_password) {
        router.replace(`/user-info?must_change_password=1&next=${encodeURIComponent(next)}`);
        return;
      }
      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba');
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.logo}>SC v2</div>
        <h1 className={styles.title}>Service Catalogue</h1>
        <p className={styles.subtitle}>Přihlaste se pro pokračování</p>
        {ssoChecking && <div className={styles.infoMsg}>Zkouším automatické doménové přihlášení…</div>}
        {!ssoChecking && ssoMessage && <div className={styles.infoMsg}>{ssoMessage}</div>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Uživatelské jméno</label>
          <input
            className={styles.input}
            type="text"
            autoComplete="username"
            autoFocus
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            disabled={busy || ssoChecking}
            required
          />
          <label className={styles.label}>Heslo</label>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            disabled={busy || ssoChecking}
            required
          />
          {error && <div className={styles.errorMsg}>{error}</div>}
          <button className={styles.btn} type="submit" disabled={busy || ssoChecking}>
            {ssoChecking ? 'Kontroluji doménový login…' : busy ? 'Přihlašuji…' : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  );
}
