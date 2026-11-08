import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, useLocation } from 'wouter';
import { ArrowLeft, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useSitePreferences } from './site-preferences';
import { messages } from './i18n/translations';
import { getSupabaseClient } from './supabase-client';
import lineup from './assets/noir-signature-scents.webp';
import logo from './assets/noir-logo.webp';
import './portal.css';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
type AuthState = {
  client: SupabaseClient | null;
  user: User | null;
  isLoaded: boolean;
  serviceError: boolean;
};
type AuthContextValue = AuthState & {
  signOut: () => Promise<void>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<AuthState>({
    client: null, user: null, isLoaded: false, serviceError: false,
  });
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const publish = (client: SupabaseClient, user: User | null) => {
      const nextId = user?.id ?? null;
      if (lastUserId.current !== undefined && lastUserId.current !== nextId) queryClient.clear();
      lastUserId.current = nextId;
      setState({ client, user, isLoaded: true, serviceError: false });
    };

    void (async () => {
      const client = await getSupabaseClient();
      if (!active) return;
      const subscription = client.auth.onAuthStateChange((_event, session) => {
        if (active) publish(client, session?.user ?? null);
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();

      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      let user: User | null = null;
      if (data.session) {
        const checked = await client.auth.getUser(data.session.access_token);
        if (!checked.error) user = checked.data.user;
        else await client.auth.signOut({ scope: 'local' });
      }
      if (active) publish(client, user);
    })().catch(() => {
      if (active) setState({ client: null, user: null, isLoaded: true, serviceError: true });
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [attempt, queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signOut: async () => {
      if (state.client) {
        const { error } = await state.client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      }
    },
    retry: () => {
      setState({ client: null, user: null, isLoaded: false, serviceError: false });
      setAttempt((n) => n + 1);
    },
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}

type AuthPageMode = 'sign-in' | 'sign-up' | 'reset-password';
type FormMode = AuthPageMode | 'forgot-password';
export function AuthPage({ mode }: { mode: AuthPageMode }) {
  const { language, theme, setLanguage, setTheme } = useSitePreferences();
  const { client, user, isLoaded, serviceError, retry } = useAuth();
  const [, setLocation] = useLocation();
  const rtl = language === 'ar';
  const t = messages[language].auth;
  const [formMode, setFormMode] = useState<FormMode>(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const signInView = formMode === 'sign-in';
  const signUpView = formMode === 'sign-up';
  const resetView = formMode === 'reset-password';
  const forgotView = formMode === 'forgot-password';
  const authFailureText = (failure: { code?: string; message?: string; status?: number }, fallback: string) => {
    if (failure.code === 'invalid_api_key' || failure.message === 'Invalid API key' || (failure.status ?? 0) >= 500) {
      return t.serviceError;
    }
    if (failure.code === 'email_address_invalid') return t.invalidEmail;
    if (['email_exists', 'user_already_exists', 'user_already_registered'].includes(failure.code ?? '')) {
      return t.accountExists;
    }
    if (failure.code === 'email_not_confirmed') return t.confirmEmailFirst;
    return fallback;
  };

  useEffect(() => setFormMode(mode), [mode]);
  useEffect(() => {
    if (isLoaded && user && formMode !== 'reset-password') setLocation('/account', { replace: true });
  }, [formMode, isLoaded, setLocation, user]);

  const redirectTo = (path: string) =>
    new URL(`${basePath}${path}`, window.location.origin).toString();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    const emailValue = email.trim().toLowerCase();
    try {
      if (signInView) {
        const { error: authError } = await client.auth.signInWithPassword({ email: emailValue, password });
        if (authError) setError(authFailureText(authError, t.signInError));
        else setLocation('/account');
      } else if (signUpView) {
        if (name.trim().length < 2) { setError(t.nameError); return; }
        if (password.length < 8) { setError(t.minPasswordError); return; }
        const { data, error: authError } = await client.auth.signUp({
          email: emailValue,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: redirectTo('/account'),
          },
        });
        if (authError) setError(authFailureText(authError, t.signUpError));
        else if (data.session) setLocation('/account');
        else setMessage(t.verifyEmail);
      } else if (forgotView) {
        const { error: authError } = await client.auth.resetPasswordForEmail(emailValue, {
          redirectTo: redirectTo('/reset-password'),
        });
        if (authError) setError(authFailureText(authError, t.resetError));
        else setMessage(t.resetSent);
      } else {
        if (password.length < 8) { setError(t.minPasswordError); return; }
        const { error: authError } = await client.auth.updateUser({ password });
        if (authError) setError(authFailureText(authError, t.resetError));
        else {
          await client.auth.signOut({ scope: 'local' });
          setFormMode('sign-in');
          setPassword('');
          setMessage(t.passwordChanged);
          setLocation('/sign-in');
        }
      }
    } catch {
      setError(t.serviceError);
    } finally {
      setBusy(false);
    }
  };

  const startForgotPassword = () => {
    setFormMode('forgot-password');
    setError('');
    setMessage('');
  };

  const title = signInView ? t.signInTitle : signUpView ? t.signUpTitle : resetView ? t.resetTitle : t.forgotPassword;
  const subtitle = signInView ? t.signInSubtitle : signUpView ? t.signUpSubtitle : '';
  const submitLabel = signInView ? t.submitSignIn : signUpView ? t.submitSignUp : resetView ? t.submitReset : t.sendReset;

  if (mode === 'reset-password' && isLoaded && !user && !serviceError) {
    return <Redirect to="/sign-in" />;
  }

  return (
    <div className="auth-page" dir={rtl ? 'rtl' : 'ltr'} lang={language}>
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-img" style={{ backgroundImage: `url("${lineup}")` }} />
        <div className="auth-art-shade" />
        <div className="auth-art-copy">
          <p>{t.salon}</p>
          <h2>{t.artLine}<br /><em>{t.artEmphasis}</em></h2>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-top">
          <Link href="/shop" className="portal-back" data-testid="link-auth-back">
            <ArrowLeft size={16} strokeWidth={1.5} className="flip-rtl" /><span>{t.backToBoutique}</span>
          </Link>
          <div className="portal-bar-actions">
            <button type="button" className="portal-icon portal-lang" onClick={() => setLanguage((l) => (l === 'en' ? 'ar' : 'en'))} aria-label={language === 'en' ? t.switchToArabic : t.switchToEnglish} data-testid="button-auth-language">{rtl ? 'EN' : 'عربي'}</button>
            <button type="button" className="portal-icon" onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark} data-testid="button-auth-theme">
              {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
        <div className="auth-card-wrap">
          <section className="auth-card" aria-labelledby="auth-title">
            <img className="auth-brand" src={logo} alt="NOIR PERFUMES" />
            <p className="auth-kicker">NOIR / 01</p>
            <h1 id="auth-title">{title}</h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            {serviceError ? (
              <div className="auth-feedback is-error" role="alert">
                <p>{t.serviceError}</p>
                <button type="button" className="text-action" onClick={retry}>{t.retry}</button>
              </div>
            ) : !isLoaded ? (
              <p className="auth-subtitle" role="status">{t.connecting}</p>
            ) : (
              <>
                <form className="auth-form" onSubmit={submit} aria-busy={busy}>
                  {signUpView && (
                    <label htmlFor="auth-name">{t.name}
                      <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={100} disabled={busy} />
                    </label>
                  )}
                  <label htmlFor="auth-email">{t.email}
                    <input id="auth-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required maxLength={254} disabled={busy} />
                  </label>
                  {!forgotView && (
                    <label htmlFor="auth-password">{resetView ? t.newPassword : t.password}
                      <input id="auth-password" value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                        autoComplete={signUpView ? 'new-password' : resetView ? 'new-password' : 'current-password'}
                        required minLength={8} maxLength={128} disabled={busy} />
                      {signUpView && <span className="auth-field-hint">{t.passwordHint}</span>}
                    </label>
                  )}
                  {error && <p className="auth-feedback is-error" role="alert">{error}</p>}
                  {message && <p className="auth-feedback is-success" role="status">{message}</p>}
                  <button type="submit" className="gold-btn auth-submit" disabled={busy}>
                    {busy ? t.working : submitLabel}
                  </button>
                </form>
                {signInView && <button type="button" className="auth-text-link" onClick={startForgotPassword}>{t.forgotPassword}</button>}
                {signInView && <p className="auth-switch">{t.newHere} <Link href="/sign-up">{t.signUp}</Link></p>}
                {signUpView && <p className="auth-switch">{t.hasAccount} <Link href="/sign-in">{t.signIn}</Link></p>}
                {forgotView && <button type="button" className="auth-text-link" onClick={() => { setFormMode('sign-in'); setError(''); setMessage(''); }}>{t.backToSignIn}</button>}
                {resetView && <p className="auth-switch">{t.backToSignIn} <Link href="/sign-in">{t.signIn}</Link></p>}
              </>
            )}
          </section>
        </div>
        <p className="auth-foot">{t.paymentNote}</p>
      </section>
    </div>
  );
}

export function AccountEntry({ placement = 'header' }: { placement?: 'header' | 'drawer' }) {
  const { language } = useSitePreferences();
  const { user, isLoaded, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const rtl = language === 'ar';
  const t = messages[language].auth;
  const name = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  const identity = name || user?.email || t.account;
  const label = isLoaded && user ? `${t.account}: ${identity}` : t.signIn;
  const leave = async () => {
    try {
      await signOut();
      setLocation('/shop');
    } catch {
      setLocation('/shop');
    }
  };

  if (!isLoaded || !user) {
    return <div className={`account-entry-group ${placement === 'header' ? 'header-account' : 'is-drawer'}`}>
      <Link href="/sign-in" className="account-entry-link" aria-label={label} title={label} data-testid="link-account-entry">
        <UserRound size={18} strokeWidth={1.5} /><span>{t.signIn}</span>
      </Link>
    </div>;
  }

  return (
    <div className={`account-entry-group ${placement === 'header' ? 'header-account' : 'is-drawer'}`}>
      <Link href="/account" className="account-entry-link" aria-label={label} title={identity} data-testid="link-account-entry">
        <UserRound size={18} strokeWidth={1.5} /><span className="account-entry-name">{identity}</span>
      </Link>
      <button type="button" className="account-signout" onClick={() => void leave()} aria-label={t.signOut} title={t.signOut} data-testid="button-nav-sign-out">
        <LogOut size={16} strokeWidth={1.5} /><span>{t.signOut}</span>
      </button>
      {placement === 'drawer' && <span className="account-entry-email" dir="ltr">{user.email}</span>}
    </div>
  );
}
