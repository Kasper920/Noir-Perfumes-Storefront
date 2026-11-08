import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { arSA, enUS } from '@clerk/localizations';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, useLocation } from 'wouter';
import { ArrowLeft, Moon, Sun, UserRound } from 'lucide-react';
import { useSitePreferences } from './site-preferences';
import lineup from './assets/noir-signature-scents.webp';
import './portal.css';

// REQUIRED — copy verbatim.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const palette = {
  dark: { primary: '#c9a24d', fg: '#f5f1ea', muted: '#aaa397', bg: '#191714', input: '#100f0d', danger: '#e08a7a', border: 'rgba(201,162,77,.34)', onPrimary: '#17130d' },
  light: { primary: '#8c681c', fg: '#26221b', muted: '#655e52', bg: '#fffdf8', input: '#f6f1e8', danger: '#a5402f', border: 'rgba(140,104,28,.36)', onPrimary: '#fffdf8' },
};

function buildAppearance(theme: 'dark' | 'light', rtl: boolean) {
  const c = palette[theme];
  const font = rtl ? "'Cairo', sans-serif" : "'DM Sans', sans-serif";
  const display = rtl ? "'Cairo', sans-serif" : "'Cormorant Garamond', Georgia, serif";
  return {
    cssLayerName: 'clerk',
    options: {
      logoPlacement: 'inside' as const,
      logoLinkUrl: basePath || '/',
      logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    },
    variables: {
      colorPrimary: c.primary,
      colorForeground: c.fg,
      colorMutedForeground: c.muted,
      colorDanger: c.danger,
      colorBackground: c.bg,
      colorInput: c.input,
      colorInputForeground: c.fg,
      colorNeutral: c.fg,
      fontFamily: font,
      borderRadius: '4px',
    },
    elements: {
      rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
      cardBox: { background: c.bg, width: '100%', maxWidth: '440px', minWidth: 0, borderRadius: '4px', border: `1px solid ${c.border}`, boxShadow: '0 30px 80px rgba(0,0,0,.28)', overflow: 'hidden' },
      card: { background: 'transparent', boxShadow: 'none', border: 0, borderRadius: 0 },
      footer: { background: 'transparent', boxShadow: 'none', border: 0, borderRadius: 0 },
      headerTitle: { color: c.fg, fontFamily: display, fontSize: rtl ? '24px' : '32px', fontWeight: rtl ? 700 : 500, letterSpacing: rtl ? 0 : '-.01em' },
      headerSubtitle: { color: c.muted },
      socialButtonsBlockButtonText: { color: c.fg },
      formFieldLabel: { color: c.fg, fontSize: '12px', letterSpacing: rtl ? 0 : '.04em' },
      footerActionLink: { color: c.primary, fontWeight: 600 },
      footerActionText: { color: c.muted },
      dividerText: { color: c.muted },
      identityPreviewEditButton: { color: c.primary },
      formFieldSuccessText: { color: c.fg },
      alertText: { color: c.fg },
      logoBox: { justifyContent: 'center', height: '56px' },
      logoImage: { height: '56px', width: '56px' },
      socialButtonsBlockButton: { border: `1px solid ${c.border}`, background: 'transparent' },
      formButtonPrimary: { background: c.primary, color: c.onPrimary, textTransform: rtl ? 'none' : 'uppercase', letterSpacing: rtl ? 0 : '.14em', fontSize: '12px', fontWeight: 600, minHeight: '46px', boxShadow: 'none' },
      formFieldInput: { border: `1px solid ${c.border}`, minHeight: '44px', boxShadow: 'none' },
      footerAction: { justifyContent: 'center' },
      dividerLine: { background: c.border },
      alert: { border: `1px solid ${c.border}`, background: c.input },
      otpCodeFieldInput: { border: `1px solid ${c.border}`, color: c.fg },
      formFieldRow: { marginBottom: '2px' },
      main: { gap: '18px' },
    },
  };
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { language, theme } = useSitePreferences();
  const rtl = language === 'ar';
  const base = rtl ? arSA : enUS;
  const localization = {
    ...base,
    signIn: { ...base.signIn, start: { ...base.signIn?.start, title: rtl ? 'أهلًا بعودتك إلى نوار' : 'Return to NOIR', subtitle: rtl ? 'سجّل الدخول لمتابعة طلباتك' : 'Sign in to your private salon' } },
    signUp: { ...base.signUp, start: { ...base.signUp?.start, title: rtl ? 'انضم إلى دار نوار' : 'Join the house', subtitle: rtl ? 'أنشئ حسابك لحفظ تفاصيل التوصيل' : 'Keep your delivery details and orders in one place' } },
  };
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={buildAppearance(theme, rtl)}
      localization={localization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}

export function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { language, theme, setLanguage, setTheme } = useSitePreferences();
  const { isLoaded, isSignedIn } = useAuth();
  const rtl = language === 'ar';
  if (isLoaded && isSignedIn) return <Redirect to="/account" />;
  return (
    <div className="auth-page" dir={rtl ? 'rtl' : 'ltr'} lang={language}>
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-art-img" style={{ backgroundImage: `url("${lineup}")` }} />
        <div className="auth-art-shade" />
        <div className="auth-art-copy">
          <p>{rtl ? 'الصالون الخاص' : 'The private salon'}</p>
          <h2>{rtl ? 'كل زجاجة تُرسل باسمك.' : <>Every bottle leaves<br /><em>with your name on it.</em></>}</h2>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-top">
          <Link href="/shop" className="portal-back" data-testid="link-auth-back"><ArrowLeft size={16} strokeWidth={1.5} className="flip-rtl" /><span>{rtl ? 'العودة إلى المتجر' : 'Back to the boutique'}</span></Link>
          <div className="portal-bar-actions">
            <button type="button" className="portal-icon portal-lang" onClick={() => setLanguage((l) => (l === 'en' ? 'ar' : 'en'))} aria-label={rtl ? 'Switch to English' : 'التبديل إلى العربية'} data-testid="button-auth-language">{rtl ? 'EN' : 'عربي'}</button>
            <button type="button" className="portal-icon" onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? (rtl ? 'الوضع الفاتح' : 'Switch to light theme') : (rtl ? 'الوضع الداكن' : 'Switch to dark theme')} data-testid="button-auth-theme">
              {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
        <div className="auth-card-wrap">
          {mode === 'sign-in'
            ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
            : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}
        </div>
        <p className="auth-foot">{rtl ? 'لا تتم أي عملية دفع عبر الإنترنت. تُسدَّد الطلبات يدويًا.' : 'No payment is taken online. Orders are settled manually with the house.'}</p>
      </section>
    </div>
  );
}

export function AccountEntry() {
  const { isLoaded, isSignedIn } = useAuth();
  const { language } = useSitePreferences();
  const rtl = language === 'ar';
  const signedIn = isLoaded && isSignedIn;
  const label = signedIn ? (rtl ? 'حسابي' : 'My account') : (rtl ? 'تسجيل الدخول' : 'Sign in');
  return (
    <Link href={signedIn ? '/account' : '/sign-in'} className="icon-button action-button account-entry" aria-label={label} title={label} data-testid="link-account-entry">
      <UserRound size={18} strokeWidth={1.5} />
      {signedIn && <span className="account-dot" aria-hidden="true" />}
    </Link>
  );
}
