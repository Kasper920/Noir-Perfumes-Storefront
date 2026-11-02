import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import logo from './assets/noir-logo.png';
import lineup from './assets/noir-signature-scents.png';
import { getCart, getFavorites, getPreference, setPreference } from './i18n/preferences';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowDown, ArrowRight, Check, Clock3, Gift, Heart, Menu, Moon, Search, ShieldCheck, ShoppingBag, Sun, Truck, X } from 'lucide-react';
import { products, formatPrice } from './data/products';

const queryClient = new QueryClient();
const navigation = [
  { id: 'home', en: 'Home', ar: 'الرئيسية' },
  { id: 'products', en: 'Shop', ar: 'تسوّق' },
  { id: 'collections', en: 'Collections', ar: 'المجموعات' },
  { id: 'about', en: 'About', ar: 'عنّا' },
  { id: 'contact', en: 'Contact', ar: 'تواصل' },
];
const filters = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'For Him', en: 'For Him', ar: 'للرجال' },
  { id: 'For Her', en: 'For Her', ar: 'للنساء' },
  { id: 'Unisex', en: 'Unisex', ar: 'للجنسين' },
  { id: 'Oud', en: 'Oud', ar: 'عود' },
  { id: 'Fresh', en: 'Fresh', ar: 'منعش' },
];

function Home() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getPreference('theme', 'dark'));
  const [language, setLanguage] = useState<'en' | 'ar'>(() => getPreference('language', 'en'));
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('home');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('featured');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<(typeof products)[number] | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [revealed, setRevealed] = useState<string[]>([]);
  const productGridRef = useRef<HTMLDivElement>(null);
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
    const initialTarget = window.location.hash.slice(1);
    if (!initialTarget) return;
    window.requestAnimationFrame(() => {
      document.getElementById(initialTarget)?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    const sections = ['home', 'products', 'collections', 'about']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { threshold: [0.18, 0.38, 0.62], rootMargin: '-18% 0px -42% 0px' });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSkeleton(false), 520);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      if (filter === 'all') return true;
      if (['For Him', 'For Her', 'Unisex'].includes(filter)) return product.audience.en.includes(filter);
      if (filter === 'Oud') return product.collections.en.some((item) => item.includes('Oud'));
      if (filter === 'Fresh') return product.collections.en.some((item) => item === 'Fresh' || item === 'Fresh & Night');
      return product.collections.en.includes(filter);
    });
    if (sort === 'low') return [...filtered].sort((a, b) => a.prices['100ml'] - b.prices['100ml']);
    if (sort === 'high') return [...filtered].sort((a, b) => b.prices['100ml'] - a.prices['100ml']);
    return filtered;
  }, [filter, sort]);

  useEffect(() => {
    if (showSkeleton) return;
    const nodes = productGridRef.current?.querySelectorAll<HTMLElement>('.product-card:not(.is-revealed)');
    if (!nodes?.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = (entry.target as HTMLElement).dataset.productId;
        if (id) setRevealed((current) => current.includes(id) ? current : [...current, id]);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 60px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [showSkeleton, visibleProducts]);

  useEffect(() => {
    if (!quickView) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setQuickView(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [quickView]);

  const chooseSection = (id: string) => {
    setActive(id);
    setMenuOpen(false);
  };

  const selectCollection = (collection: string) => {
    setFilter(collection);
    setActive('products');
    window.setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 30);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
        <section id="products" className="products-section section-shell">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{rtl ? 'اكتشف توقيعك' : 'Find your signature'}</p>
              <h2>{rtl ? 'عطور تُروى كحكاية.' : <>Scents with<br /><em>a story.</em></>}</h2>
            </div>
            <p className="section-intro">{rtl ? 'تركيبات استثنائية، صُممت لتبقى في الذاكرة.' : 'Distinctive compositions, made to linger long after the moment.'}</p>
          </div>
          <div className="product-controls">
            <div className="filter-list" role="group" aria-label={rtl ? 'تصفية العطور' : 'Filter fragrances'}>
              {filters.map((item) => {
                const selected = filter === item.id || (filter === 'Oud & Amber' && item.id === 'Oud') || (filter === 'Floral' && item.id === 'For Her') || (filter === 'Fresh & Night' && item.id === 'Fresh');
                return <button key={item.id} type="button" className={`filter-pill${selected ? ' selected' : ''}`} onClick={() => setFilter(item.id)} data-testid={`filter-${item.id.toLowerCase().replaceAll(' ', '-')}`}>{rtl ? item.ar : item.en}</button>;
              })}
            </div>
            <label className="sort-control"><span>{rtl ? 'ترتيب حسب' : 'Sort by'}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={rtl ? 'ترتيب المنتجات' : 'Sort products'} data-testid="select-product-sort">
                <option value="featured">{rtl ? 'مميزة' : 'Featured'}</option>
                <option value="low">{rtl ? 'السعر: الأقل أولاً' : 'Price: low to high'}</option>
                <option value="high">{rtl ? 'السعر: الأعلى أولاً' : 'Price: high to low'}</option>
              </select>
            </label>
          </div>
          <div className="product-grid" ref={productGridRef} aria-live="polite">
            {showSkeleton ? Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><i /></div>) : visibleProducts.map((product) => (
              <article className={`product-card${revealed.includes(product.id) ? ' is-revealed' : ''}`} key={product.id} data-product-id={product.id} data-testid={`card-product-${product.id}`}>
                <div className="product-image-wrap">
                  <div className="product-image-crop" style={{ '--crop-left': `${product.crop.column * -100}%`, '--crop-top': `${product.crop.row * -100}%`, '--crop-position': product.crop.objectPosition } as CSSProperties}>
                    <img src={product.image} alt={`${product.name[rtl ? 'ar' : 'en']} perfume bottle`} loading="lazy" />
                  </div>
                  {product.badge && <span className="product-badge">{product.badge[rtl ? 'ar' : 'en']}</span>}
                  <button className={`favorite-toggle${favorites.includes(product.id) ? ' is-favorite' : ''}`} type="button" aria-label={favorites.includes(product.id) ? (rtl ? 'إزالة من المفضلة' : 'Remove from favorites') : (rtl ? 'أضف إلى المفضلة' : 'Add to favorites')} aria-pressed={favorites.includes(product.id)} onClick={() => toggleFavorite(product.id)} data-testid={`button-favorite-${product.id}`}><Heart size={18} strokeWidth={1.4} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
                  <button className="quick-view" type="button" onClick={() => setQuickView(product)} data-testid={`button-quick-view-${product.id}`}>{rtl ? 'نظرة سريعة' : 'Quick view'} <ArrowRight size={14} /></button>
                </div>
                <div className="product-info">
                  <div className="product-title-row"><div><h3>{product.name[rtl ? 'ar' : 'en']}</h3><p>{product.concentration[rtl ? 'ar' : 'en']}</p></div><span className="product-price">{formatPrice(product.prices['100ml'])}</span></div>
                  <p className="note-highlights">{product.noteHighlights[rtl ? 'ar' : 'en'].join(' · ')}</p>
                  <div className="product-buy-row"><span className="size-label">100ml</span><button type="button" className="add-button" data-testid={`button-add-${product.id}`}>{rtl ? 'أضف إلى السلة' : 'Add to Cart'} <span>＋</span></button></div>
                </div>
              </article>
            ))}
          </div>
          {!showSkeleton && visibleProducts.length === 0 && <p className="empty-products">{rtl ? 'لا توجد عطور ضمن هذا الاختيار.' : 'No fragrances in this selection.'}</p>}
        </section>
        <section id="collections" className="collections-section section-shell">
          <div className="section-heading collection-heading">
            <div><p className="section-kicker">{rtl ? 'عائلات عطرية' : 'Explore by mood'}</p><h2>{rtl ? 'اختَر الأثر.' : <>The art of<br /><em>the accord.</em></>}</h2></div>
            <p className="section-intro">{rtl ? 'ثلاثة عوالم، لكل منها حكاية مختلفة.' : 'Three olfactive worlds. Each with its own point of view.'}</p>
          </div>
          <div className="collection-grid">
            {[
              { title: 'Oud & Amber', ar: 'عود وعنبر', caption: { en: 'Warmth, made unforgettable.', ar: 'دفء لا يُنسى.' }, symbol: '01', filter: 'Oud' },
              { title: 'Floral', ar: 'زهري', caption: { en: 'A softer kind of presence.', ar: 'حضور أكثر رقة.' }, symbol: '02', filter: 'For Her' },
              { title: 'Fresh & Night', ar: 'منعش وليلي', caption: { en: 'Light that lingers into dusk.', ar: 'انتعاش يمتد حتى المساء.' }, symbol: '03', filter: 'Fresh' },
            ].map((collection, index) => <button type="button" className={`collection-card collection-card-${index + 1}`} key={collection.title} onClick={() => selectCollection(collection.title)} data-testid={`collection-${index + 1}`}>
              <span className="collection-number">{collection.symbol} / 03</span><span className="collection-card-name">{rtl ? collection.ar : collection.title}</span><span className="collection-card-caption">{collection.caption[rtl ? 'ar' : 'en']}</span><span className="collection-arrow"><ArrowRight size={17} /></span>
            </button>)}
          </div>
        </section>
        <section className="promise-strip" aria-label={rtl ? 'مزايا نوار' : 'The Noir promise'}>
          {[
            { icon: Clock3, title: { en: 'Long-lasting', ar: 'ثبات يدوم' }, copy: { en: 'A signature that stays.', ar: 'أثر يبقى معك.' } },
            { icon: ShieldCheck, title: { en: 'Authentic', ar: 'أصلي' }, copy: { en: 'Always the real thing.', ar: 'أصالة في كل تفصيل.' } },
            { icon: Truck, title: { en: 'Fast delivery', ar: 'توصيل سريع' }, copy: { en: 'At your door, promptly.', ar: 'حتى بابك بكل سرعة.' } },
            { icon: Gift, title: { en: 'Gift packaging', ar: 'تغليف الهدايا' }, copy: { en: 'Ready for their moment.', ar: 'جاهز ليُهدى.' } },
          ].map(({ icon: Icon, title, copy }) => <div className="promise-item" key={title.en}><Icon size={21} strokeWidth={1.25} /><div><h3>{title[rtl ? 'ar' : 'en']}</h3><p>{copy[rtl ? 'ar' : 'en']}</p></div></div>)}
        </section>
        <section id="about" className="about-section section-shell">
          <p className="section-kicker">{rtl ? 'عن نوار' : 'The Noir point of view'}</p>
          <h2>{rtl ? <>نؤمن أن العطر<br /><em>هو ذاكرة تُرتدى.</em></> : <>Fragrance is a memory<br /><em>you choose to wear.</em></>}</h2>
          <p className="about-copy">{rtl ? 'في نوار، نصنع عطوراً توازن بين الحرفية الرفيعة والروح المعاصرة. كل تركيبة توقيع شخصي، وكل أثر حكاية تستحق أن تُروى.' : 'At NOIR, we bring considered craft into the everyday. Each composition is a personal signature; each lingering trace, a story worth telling.'}</p>
          <span className="about-mark">N / 01</span>
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
      {quickView && <div className="quick-view-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickView(null); }}>
        <section className="quick-view-dialog" role="dialog" aria-modal="true" aria-label={quickView.name[rtl ? 'ar' : 'en']}>
          <button className="quick-close" type="button" aria-label={rtl ? 'إغلاق' : 'Close'} onClick={() => setQuickView(null)}><X size={20} /></button>
          <div className="quick-view-art"><div className="product-image-crop" style={{ '--crop-left': `${quickView.crop.column * -100}%`, '--crop-top': `${quickView.crop.row * -100}%`, '--crop-position': quickView.crop.objectPosition } as CSSProperties}><img src={quickView.image} alt="" /></div></div>
          <div className="quick-view-copy"><p className="section-kicker">{quickView.concentration[rtl ? 'ar' : 'en']}</p><h2>{quickView.name[rtl ? 'ar' : 'en']}</h2><p className="quick-notes">{quickView.noteHighlights[rtl ? 'ar' : 'en'].join(' · ')}</p><p>{quickView.description[rtl ? 'ar' : 'en']}</p><strong>{formatPrice(quickView.prices['100ml'])} <small> / 100ml</small></strong><button type="button" className="cta-primary" onClick={() => setQuickView(null)}>{rtl ? 'متابعة الاكتشاف' : 'Continue exploring'} <Check size={15} /></button></div>
        </section>
      </div>}
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
