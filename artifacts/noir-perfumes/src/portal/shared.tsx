import type { CSSProperties, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth, useClerk } from '@clerk/react';
import { ArrowLeft, LogOut, Moon, RotateCcw, Sun } from 'lucide-react';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { useSitePreferences } from '../site-preferences';
import { products } from '../data/products';
import { productCrop } from '../catalog-context';
import { portalCopy } from './copy';
import '../portal.css';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const LIVE = { staleTime: 30_000, refetchInterval: 30_000, refetchOnWindowFocus: true } as const;

export function usePortal() {
  const prefs = useSitePreferences();
  const t = portalCopy[prefs.language];
  const rtl = prefs.language === 'ar';
  const locale = rtl ? 'ar-KW' : 'en-KW';
  const money = (amount: number, currency = 'KWD') => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 3 }).format(amount); }
    catch { return `${amount.toFixed(3)} ${currency}`; }
  };
  const num = (n: number) => new Intl.NumberFormat(locale).format(n);
  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  };
  return { ...prefs, t, rtl, money, num, date };
}

export function useAuthReady() {
  const { isLoaded, isSignedIn } = useAuth();
  return { isLoaded, ready: isLoaded && Boolean(isSignedIn) };
}

export function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}

export function PortalShell({ children, section }: { children: ReactNode; section: 'account' | 'admin' }) {
  const { t, theme, setTheme, setLanguage, rtl, language } = usePortal();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  return (
    <div className="portal" dir={rtl ? 'rtl' : 'ltr'} lang={language}>
      <a href="#portal-main" className="portal-skip">{rtl ? 'تخطَّ إلى المحتوى' : 'Skip to content'}</a>
      <header className="portal-bar">
        <Link href="/shop" className="portal-back" data-testid="link-back-shop">
          <ArrowLeft size={16} strokeWidth={1.5} className="flip-rtl" /><span>{t.backToShop}</span>
        </Link>
        <Link href="/shop" className="portal-mark" aria-label="NOIR">N<span>OIR</span></Link>
        <div className="portal-bar-actions">
          <button type="button" className="portal-icon portal-lang" onClick={() => setLanguage((l) => (l === 'en' ? 'ar' : 'en'))} aria-label={t.switchLang} data-testid="button-language">
            {language === 'en' ? 'عربي' : 'EN'}
          </button>
          <button type="button" className="portal-icon" onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))} aria-label={theme === 'dark' ? t.toLight : t.toDark} aria-pressed={theme === 'light'} data-testid="button-theme">
            {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          </button>
          <button type="button" className="portal-icon portal-signout" onClick={() => { void signOut({ redirectUrl: basePath || '/' }); }} data-testid="button-sign-out">
            <LogOut size={16} strokeWidth={1.5} className="flip-rtl" /><span>{t.signOut}</span>
          </button>
        </div>
      </header>
      <nav className="portal-tabs-top" aria-label={t.account}>
        <button type="button" className={section === 'account' ? 'is-on' : ''} aria-current={section === 'account' ? 'page' : undefined} onClick={() => setLocation('/account')} data-testid="nav-account">{t.account}</button>
        <AdminNavSlot section={section} onGo={() => setLocation('/admin')} />
      </nav>
      <main id="portal-main" className="portal-main">{children}</main>
      <footer className="portal-foot"><span>NOIR · {rtl ? 'دار العطور' : 'Maison de parfum'}</span><Link href="/shop">{t.backToShop}</Link></footer>
    </div>
  );
}

/** Only renders the admin tab when the profile says admin. Navigation only; server enforces access. */
function AdminNavSlot({ section, onGo }: { section: string; onGo: () => void }) {
  const { t } = usePortal();
  const { ready } = useAuthReady();
  const { data } = useGetProfile({ query: { enabled: ready, queryKey: getGetProfileQueryKey(), staleTime: 30_000 } });
  if (data?.role !== 'admin' && section !== 'admin') return null;
  return <button type="button" className={section === 'admin' ? 'is-on' : ''} aria-current={section === 'admin' ? 'page' : undefined} onClick={onGo} data-testid="nav-admin">{t.admin}</button>;
}

export function StatusPill({ status }: { status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' }) {
  const { t } = usePortal();
  return <span className={`status-pill s-${status}`} data-testid={`status-${status}`}><i aria-hidden="true" />{t.status[status]}</span>;
}

export function ErrorPanel({ message, onRetry, compact }: { message: string; onRetry?: () => void; compact?: boolean }) {
  const { t } = usePortal();
  return (
    <div className={`portal-error${compact ? ' compact' : ''}`} role="alert">
      <p>{message}</p>
      {onRetry && <button type="button" className="ghost-btn" onClick={onRetry} data-testid="button-retry"><RotateCcw size={14} />{t.retry}</button>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="portal-empty">
      <svg viewBox="0 0 80 110" aria-hidden="true" className="empty-flacon">
        <rect x="31" y="6" width="18" height="14" rx="2" />
        <rect x="35" y="20" width="10" height="8" />
        <rect x="12" y="28" width="56" height="74" rx="10" />
        <path d="M20 70 Q40 62 60 70" />
      </svg>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="portal-skeleton" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i} style={{ animationDelay: `${i * 90}ms` }} />)}</div>;
}

export function ProductArt({ imageKey, imageUrl, imagePath, label, className }: {
  imageKey: string; imageUrl?: string | null; imagePath?: string | null; label: string; className?: string;
}) {
  const art = products.find((p) => p.id === imageKey) ?? products[0];
  if (!art) return <div className={`product-art ${className ?? ''}`} />;
  const crop = productCrop(imageKey, imagePath);
  const single = Boolean(imageUrl && imagePath !== 'sprites/noir-product-grid.webp');
  return (
    <div className={`product-art ${className ?? ''}`}>
      <div className={`product-image-crop${single ? ' is-single' : ''}`} style={{ '--crop-left': `${crop.column * -100}%`, '--crop-top': `${crop.row * -100}%`, '--crop-position': crop.objectPosition } as CSSProperties}>
        <img src={imageUrl ?? art.image} alt={label} loading="lazy" />
      </div>
    </div>
  );
}
