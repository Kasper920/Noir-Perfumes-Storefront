import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import logo from './assets/noir-logo.png';
import lineup from './assets/noir-signature-scents.png';
import { getCart, getFavorites, getPreference, setPreference } from './i18n/preferences';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowDown, ArrowRight, Heart, Menu, Moon, Search, ShoppingBag, Sun, X } from 'lucide-react';

const queryClient = new QueryClient();
const navigation = [
  { id: 'home', en: 'Home', ar: 'الرئيسية' },
  { id: 'products', en: 'Shop', ar: 'تسوّق' },
  { id: 'collections', en: 'Collections', ar: 'المجموعات' },
  { id: 'about', en: 'About', ar: 'عنّا' },
  { id: 'contact', en: 'Contact', ar: 'تواصل' },
];

function Home() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getPreference('theme', 'dark'));
  const [language, setLanguage] = useState<'en' | 'ar'>(() => getPreference('language', 'en'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('home');
  const [favoriteCount] = useState(() => getFavorites().length);
  const [cartCount] = useState(() => getCart().length);
  const rtl = language === 'ar';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    setPreference('theme', theme);
    setPreference('language', language);
  }, [theme, language, rtl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      if (navigation.some((item) => item.id === id)) setActive(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const hero = document.getElementById('home');
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setActive('home');
    }, { threshold: 0.45 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const chooseSection = (id: string) => {
    setActive(id);
    setMenuOpen(false);
  };

  const preferenceControls = (
    <div className="preference-controls">
      <button
        className="icon-button preference-button language-button"
        type="button"
        aria-label={rtl ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
        onClick={() => setLanguage((current) => current === 'en' ? 'ar' : 'en')}
      >
        <span className={!rtl ? 'language-current' : ''}>EN</span><span className="language-divider">|</span><span className={rtl ? 'language-current' : ''}>عربي</span>
      </button>
      <button
        className="icon-button preference-button"
        type="button"
        aria-label={theme === 'dark' ? (rtl ? 'تفعيل المظهر الفاتح' : 'Switch to light theme') : (rtl ? 'تفعيل المظهر الداكن' : 'Switch to dark theme')}
        aria-pressed={theme === 'light'}
        onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
      </button>
    </div>
  );

  return (
    <div className="noir-app">
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <a className="brand-link" href="#home" aria-label="NOIR PERFUMES home" onClick={() => chooseSection('home')}>
          <img src={logo} alt="NOIR PERFUMES" />
        </a>
        <nav className="desktop-nav" aria-label={rtl ? 'التنقل الرئيسي' : 'Main navigation'}>
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? 'nav-link active' : 'nav-link'}
              aria-current={active === item.id ? 'page' : undefined}
              onClick={() => chooseSection(item.id)}
            >{rtl ? item.ar : item.en}</a>
          ))}
        </nav>
        <div className="header-actions">
          <button className="icon-button action-button" type="button" aria-label={rtl ? 'بحث' : 'Search'} data-testid="button-search"><Search size={18} strokeWidth={1.5} /></button>
          <button className="icon-button action-button count-action" type="button" aria-label={`${rtl ? 'المفضلة' : 'Favorites'}: ${favoriteCount}`} data-testid="button-favorites">
            <Heart size={18} strokeWidth={1.5} /><span className="count-badge">{favoriteCount}</span>
          </button>
          <button className="icon-button action-button count-action" type="button" aria-label={`${rtl ? 'السلة' : 'Cart'}: ${cartCount}`} data-testid="button-cart">
            <ShoppingBag size={18} strokeWidth={1.5} /><span className="count-badge">{cartCount}</span>
          </button>
          <div className="desktop-preferences">{preferenceControls}</div>
          <button
            className="icon-button mobile-menu-trigger"
            type="button"
            aria-label={menuOpen ? (rtl ? 'إغلاق القائمة' : 'Close menu') : (rtl ? 'فتح القائمة' : 'Open menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          ><Menu size={22} strokeWidth={1.4} /></button>
        </div>
      </header>

      <main>
        <section id="home" className="hero" aria-label="NOIR PERFUMES new collection">
          <img className="hero-image" src={lineup} alt="" aria-hidden="true" />
          <div className="hero-shade" />
          <div className="gold-halo" />
          <div className="particle-field" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className={`hero-copy${rtl ? ' hero-copy-rtl' : ''}`}>
            <p className="collection-label"><span />{rtl ? 'مجموعة جديدة' : 'New collection'}</p>
            <h1>{rtl ? <>ارتدِ<br />الغموض.</> : <>Wear the<br /><em>Mystery.</em></>}</h1>
            <p className="hero-description">{rtl ? 'عطرٌ يترك أثره، دون أن يطلب الانتباه.' : 'A quiet signature. Impossible to forget.'}</p>
            <div className="hero-ctas">
              <a className="cta-primary" href="#products" onClick={() => chooseSection('products')}>
                {rtl ? 'تسوّق الآن' : 'Shop now'} <ArrowRight size={16} strokeWidth={1.5} />
              </a>
              <a className="cta-secondary" href="#collections" onClick={() => chooseSection('collections')}>
                {rtl ? 'اكتشف المجموعات' : 'Explore collections'}
              </a>
            </div>
          </div>
          <div className="hero-bottom">
            <p className="trust-line">{rtl ? 'شحن مجاني' : 'Free shipping'} <span>·</span> {rtl ? 'أصلي' : 'Authentic'} <span>·</span> {rtl ? 'تغليف هدايا' : 'Gift wrapping'}</p>
            <a className="scroll-cue" href="#products" aria-label={rtl ? 'اكتشف العطور' : 'Discover the fragrances'} onClick={() => chooseSection('products')}>
              <span>{rtl ? 'اكتشف' : 'Discover'}</span><ArrowDown size={15} strokeWidth={1.3} />
            </a>
            <span className="hero-index">01 <i /> 06</span>
          </div>
        </section>
      </main>

      <div className={`mobile-drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen} inert={!menuOpen}>
        <div className="drawer-top">
          <span className="drawer-eyebrow">NOIR — MENU</span>
          <button className="icon-button drawer-close" type="button" aria-label={rtl ? 'إغلاق القائمة' : 'Close menu'} onClick={() => setMenuOpen(false)}><X size={23} strokeWidth={1.4} /></button>
        </div>
        <nav className="drawer-nav" aria-label={rtl ? 'التنقل الرئيسي' : 'Main navigation'}>
          {navigation.map((item, index) => (
            <a key={item.id} href={`#${item.id}`} className={active === item.id ? 'drawer-link active' : 'drawer-link'} onClick={() => chooseSection(item.id)}>
              <span className="drawer-number">0{index + 1}</span><span>{rtl ? item.ar : item.en}</span><ArrowRight size={18} strokeWidth={1.3} />
            </a>
          ))}
        </nav>
        <div className="drawer-preferences">
          <span>{rtl ? 'تفضيلاتك' : 'Your preferences'}</span>
          {preferenceControls}
        </div>
        <p className="drawer-signoff">A trace that stays.</p>
      </div>
      {menuOpen && <button className="drawer-scrim" aria-label={rtl ? 'إغلاق القائمة' : 'Close menu'} onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
