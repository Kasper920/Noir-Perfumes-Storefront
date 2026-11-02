import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type FormEvent } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import logo from './assets/noir-logo.png';
import lineup from './assets/noir-signature-scents.png';
import { getInitialLanguage, getInitialTheme, setPreference } from './i18n/preferences';
import { messages, productMessages } from './i18n/translations';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ArrowDown, ArrowRight, Check, Clock3, Gift, Heart, Menu, Moon, Search, ShieldCheck, ShoppingBag, Sun, Truck, X, Minus, Plus, Trash2 } from 'lucide-react';
import { products, formatPrice as formatCurrency } from './data/products';
import { CommerceProvider, useCommerce, type PerfumeSize } from './commerce-context';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const queryClient = new QueryClient();
const navigation = [
  { id: 'home', key: 'home' }, { id: 'products', key: 'shop' },
  { id: 'collections', key: 'collections' }, { id: 'about', key: 'about' },
  { id: 'contact', key: 'contact' },
] as const;
const filters = [
  { id: 'all', key: 'all' }, { id: 'For Him', key: 'forHim' },
  { id: 'For Her', key: 'forHer' }, { id: 'Unisex', key: 'unisex' },
  { id: 'Oud', key: 'oud' }, { id: 'Fresh', key: 'fresh' },
] as const;

function Home() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [language, setLanguage] = useState<'en' | 'ar'>(getInitialLanguage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('home');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('featured');
  const [quickView, setQuickView] = useState<(typeof products)[number] | null>(null);
  const [quickSize, setQuickSize] = useState<PerfumeSize>('100ml');
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [badgePulse, setBadgePulse] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [revealed, setRevealed] = useState<string[]>([]);
  const productGridRef = useRef<HTMLDivElement>(null);
  const { cart, favorites, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart } = useCommerce();
  const { toast } = useToast();
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const favoriteCount = favorites.length;
  const rtl = language === 'ar';
  const copy = messages[language];
  const formatPrice = (amount: number) => formatCurrency(amount, language);
  const formatNumber = (amount: number) => new Intl.NumberFormat(rtl ? 'ar-KW' : 'en-KW').format(amount);
  const formatSize = (size: PerfumeSize) => rtl
    ? (size === '50ml' ? '٥٠ مل' : '١٠٠ مل')
    : size;
  const productCopy = (product: (typeof products)[number]) => productMessages[product.id][language];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.style.colorScheme = theme;
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
    const sections = ['home', 'products', 'collections', 'about', 'contact']
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
    if (searchOpen) window.setTimeout(() => searchInputRef.current?.focus(), 40);
  }, [searchOpen]);

  const chooseSection = (id: string) => {
    setActive(id);
    setMenuOpen(false);
  };

  const selectCollection = (collection: string) => {
    setFilter(collection);
    setActive('products');
    window.setTimeout(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }), 30);
  };

  const openQuickView = (product: (typeof products)[number]) => {
    setQuickView(product);
    setQuickSize('100ml');
    setQuickQuantity(1);
  };
  const addProduct = (id: string, size: PerfumeSize, quantity = 1) => {
    addToCart(id, size, quantity);
    setFavoritesOpen(false);
    setBadgePulse(true);
    window.setTimeout(() => setBadgePulse(false), 420);
    toast({ title: copy.added, description: copy.addDescription });
    setCartOpen(true);
  };
  const matchingProducts = products.filter((product) => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query && [product.name.en, product.name.ar, ...product.noteHighlights.en, ...product.noteHighlights.ar,
      ...product.notes.top.en, ...product.notes.top.ar, ...product.notes.heart.en, ...product.notes.heart.ar,
      ...product.notes.base.en, ...product.notes.base.ar].some((value) => value.toLocaleLowerCase().includes(query));
  });
  const subtotal = cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product?.prices[line.size] ?? 0) * line.quantity;
  }, 0);
  const submitCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    clearCart();
    setCheckoutOpen(false);
    setOrderComplete(true);
    toast({ title: copy.orderConfirmed, description: copy.orderSuccess });
  };

  const preferenceControls = (
    <div className="preference-controls">
      <button
        className="icon-button preference-button language-button"
        type="button"
        aria-label={rtl ? copy.switchToEnglish : copy.switchToArabic}
        onClick={() => setLanguage((current) => current === 'en' ? 'ar' : 'en')}
      >
        <span className={!rtl ? 'language-current' : ''}>EN</span><span className="language-divider">|</span><span className={rtl ? 'language-current' : ''}>عربي</span>
      </button>
      <button
        className="icon-button preference-button"
        type="button"
        aria-label={theme === 'dark' ? copy.switchToLight : copy.switchToDark}
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
        <a className="brand-link" href="#home" aria-label={copy.nav.logo} onClick={() => chooseSection('home')}>
          <img src={logo} alt="NOIR PERFUMES" />
        </a>
        <nav className="desktop-nav" aria-label={copy.nav.main}>
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? 'nav-link active' : 'nav-link'}
              aria-current={active === item.id ? 'page' : undefined}
              onClick={() => chooseSection(item.id)}
            >{copy.nav[item.key]}</a>
          ))}
        </nav>
        <div className="header-actions">
          <button className="icon-button action-button" type="button" aria-label={copy.search} onClick={() => { setSearchQuery(''); setSearchOpen(true); }} data-testid="button-search"><Search size={18} strokeWidth={1.5} /></button>
          <button className="icon-button action-button count-action" type="button" aria-label={`${copy.favorites}: ${favoriteCount}`} onClick={() => setFavoritesOpen(true)} data-testid="button-favorites">
            <Heart size={18} strokeWidth={1.5} /><span className="count-badge">{formatNumber(favoriteCount)}</span>
          </button>
          <button className={`icon-button action-button count-action${badgePulse ? ' badge-pulse' : ''}`} type="button" aria-label={`${copy.cart}: ${cartCount}`} onClick={() => setCartOpen(true)} data-testid="button-cart">
            <ShoppingBag size={18} strokeWidth={1.5} /><span className="count-badge">{formatNumber(cartCount)}</span>
          </button>
          <div className="desktop-preferences">{preferenceControls}</div>
          <button
            className="icon-button mobile-menu-trigger"
            type="button"
            aria-label={menuOpen ? copy.mobile.close : copy.mobile.open}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          ><Menu size={22} strokeWidth={1.4} /></button>
        </div>
      </header>

      <main>
        <section id="home" className="hero" aria-label={copy.hero.aria}>
          <img className="hero-image" src={lineup} alt="" aria-hidden="true" />
          <div className="hero-shade" />
          <div className="gold-halo" />
          <div className="particle-field" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className={`hero-copy${rtl ? ' hero-copy-rtl' : ''}`}>
            <p className="collection-label"><span />{copy.hero.collection}</p>
            <h1>{rtl ? <>{copy.hero.headline}<br />{copy.hero.accent}</> : <>{copy.hero.headline}<br /><em>{copy.hero.accent}</em></>}</h1>
            <p className="hero-description">{copy.hero.description}</p>
            <div className="hero-ctas">
              <a className="cta-primary" href="#products" onClick={() => chooseSection('products')}>
                {copy.hero.shop} <ArrowRight size={16} strokeWidth={1.5} />
              </a>
              <a className="cta-secondary" href="#collections" onClick={() => chooseSection('collections')}>
                {copy.hero.explore}
              </a>
            </div>
          </div>
          <div className="hero-bottom">
            <p className="trust-line">{copy.hero.shipping} <span>·</span> {copy.hero.authentic} <span>·</span> {copy.hero.gift}</p>
            <a className="scroll-cue" href="#products" aria-label={copy.hero.discoverAria} onClick={() => chooseSection('products')}>
              <span>{copy.hero.discover}</span><ArrowDown size={15} strokeWidth={1.3} />
            </a>
            <span className="hero-index">{formatNumber(1).padStart(2, '0')} <i /> {formatNumber(6).padStart(2, '0')}</span>
          </div>
        </section>
        <section id="products" className="products-section section-shell">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{copy.products.kicker}</p>
              <h2>{rtl ? copy.products.title : <>{copy.products.title}<br /><em>{copy.products.accent}</em></>}</h2>
            </div>
            <p className="section-intro">{copy.products.intro}</p>
          </div>
          <div className="product-controls">
            <div className="filter-list" role="group" aria-label={copy.products.filter}>
              {filters.map((item) => {
                const selected = filter === item.id || (filter === 'Oud & Amber' && item.id === 'Oud') || (filter === 'Floral' && item.id === 'For Her') || (filter === 'Fresh & Night' && item.id === 'Fresh');
                return <button key={item.id} type="button" className={`filter-pill${selected ? ' selected' : ''}`} onClick={() => setFilter(item.id)} data-testid={`filter-${item.id.toLowerCase().replaceAll(' ', '-')}`}>{copy.filters[item.key]}</button>;
              })}
            </div>
            <label className="sort-control"><span>{copy.products.sort}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={copy.products.sort} data-testid="select-product-sort">
                <option value="featured">{copy.products.featured}</option>
                <option value="low">{copy.products.low}</option>
                <option value="high">{copy.products.high}</option>
              </select>
            </label>
          </div>
          <div className="product-grid" ref={productGridRef} aria-live="polite">
            {showSkeleton ? Array.from({ length: 6 }, (_, index) => <div className="product-skeleton" key={index}><div /><span /><i /></div>) : visibleProducts.map((product) => (
              <article className={`product-card${revealed.includes(product.id) ? ' is-revealed' : ''}`} key={product.id} data-product-id={product.id} data-testid={`card-product-${product.id}`} role="group" tabIndex={0} aria-label={`${rtl ? 'عرض' : 'View'} ${productCopy(product).name}`} onClick={() => openQuickView(product)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openQuickView(product); } }}>
                <div className="product-image-wrap">
                  <div className="product-image-crop" style={{ '--crop-left': `${product.crop.column * -100}%`, '--crop-top': `${product.crop.row * -100}%`, '--crop-position': product.crop.objectPosition } as CSSProperties}>
                    <img src={product.image} alt={`${productCopy(product).name} ${rtl ? 'زجاجة عطر' : 'perfume bottle'}`} loading="lazy" />
                  </div>
                  {productCopy(product).badge && <span className="product-badge">{productCopy(product).badge}</span>}
                  <button className={`favorite-toggle${favorites.includes(product.id) ? ' is-favorite heart-pop' : ''}`} type="button" aria-label={favorites.includes(product.id) ? copy.removeFavorite : copy.addFavorite} aria-pressed={favorites.includes(product.id)} onClick={(event) => { event.stopPropagation(); toggleFavorite(product.id); toast({ title: favorites.includes(product.id) ? copy.removedFavorite : copy.addedFavorite }); }} data-testid={`button-favorite-${product.id}`}><Heart size={18} strokeWidth={1.4} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
                  <button className="quick-view" type="button" onClick={(event) => { event.stopPropagation(); openQuickView(product); }} data-testid={`button-quick-view-${product.id}`}>{copy.products.quickView} <ArrowRight size={14} /></button>
                </div>
                <div className="product-info">
                  <div className="product-title-row"><div><h3>{productCopy(product).name}</h3><p>{productCopy(product).concentration}</p></div><span className="product-price">{formatPrice(product.prices['100ml'])}</span></div>
                  <p className="note-highlights">{productCopy(product).noteHighlights.join(' · ')}</p>
                  <div className="product-buy-row"><span className="size-label">{formatSize('100ml')}</span><button type="button" className="add-button" onClick={(event) => { event.stopPropagation(); addProduct(product.id, '100ml'); }} data-testid={`button-add-${product.id}`}>{copy.add} <span>＋</span></button></div>
                </div>
              </article>
            ))}
          </div>
          {!showSkeleton && visibleProducts.length === 0 && <p className="empty-products">{copy.products.none}</p>}
        </section>
        <section id="collections" className="collections-section section-shell">
          <div className="section-heading collection-heading">
            <div><p className="section-kicker">{copy.collections.kicker}</p><h2>{rtl ? copy.collections.title : <>{copy.collections.title}<br /><em>{copy.collections.accent}</em></>}</h2></div>
            <p className="section-intro">{copy.collections.intro}</p>
          </div>
          <div className="collection-grid">
              {[
                { title: 'Oud & Amber', symbol: '01' },
                { title: 'Floral', symbol: '02' },
                { title: 'Fresh & Night', symbol: '03' },
              ].map((collection, index) => <button type="button" className={`collection-card collection-card-${index + 1}`} key={collection.title} onClick={() => selectCollection(collection.title)} data-testid={`collection-${index + 1}`}>
              <span className="collection-number">{collection.symbol} / 03</span><span className="collection-card-name">{copy.collections.cards[index].title}</span><span className="collection-card-caption">{copy.collections.cards[index].caption}</span><span className="collection-arrow"><ArrowRight size={17} /></span>
            </button>)}
          </div>
        </section>
        <section className="promise-strip" aria-label={copy.promises.aria}>
          {[Clock3, ShieldCheck, Truck, Gift].map((Icon, index) => <div className="promise-item" key={index}><Icon size={21} strokeWidth={1.25} /><div><h3>{copy.promises.items[index].title}</h3><p>{copy.promises.items[index].copy}</p></div></div>)}
        </section>
        <section id="about" className="about-section section-shell">
          <p className="section-kicker">{copy.about.kicker}</p>
          <h2>{rtl ? <>{copy.about.title}<br /><em>{copy.about.accent}</em></> : <>{copy.about.title}<br /><em>{copy.about.accent}</em></>}</h2>
          <p className="about-copy">{copy.about.copy}</p>
          <span className="about-mark">N / 01</span>
        </section>
      </main>
      <footer id="contact" className="site-footer section-shell">
        <a href="#home" className="footer-brand">NOIR <span>PERFUMES</span></a>
        <p>{copy.footer.line}</p>
        <span>© {new Intl.NumberFormat(rtl ? 'ar-KW' : 'en-KW').format(new Date().getFullYear())} NOIR. {copy.footer.rights}</span>
      </footer>

      <div className={`mobile-drawer${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen} inert={!menuOpen}>
        <div className="drawer-top">
          <span className="drawer-eyebrow">NOIR — MENU</span>
          <button className="icon-button drawer-close" type="button" aria-label={copy.mobile.close} onClick={() => setMenuOpen(false)}><X size={23} strokeWidth={1.4} /></button>
        </div>
        <nav className="drawer-nav" aria-label={copy.nav.main}>
          {navigation.map((item, index) => (
            <a key={item.id} href={`#${item.id}`} className={active === item.id ? 'drawer-link active' : 'drawer-link'} onClick={() => chooseSection(item.id)}>
              <span className="drawer-number">{new Intl.NumberFormat(rtl ? 'ar-KW' : 'en-KW').format(index + 1).padStart(2, '0')}</span><span>{copy.nav[item.key]}</span><ArrowRight size={18} strokeWidth={1.3} />
            </a>
          ))}
        </nav>
        <div className="drawer-preferences">
          <span>{copy.mobile.preferences}</span>
          {preferenceControls}
        </div>
        <p className="drawer-signoff">{copy.mobile.signoff}</p>
      </div>
      {menuOpen && <button className="drawer-scrim" aria-label={copy.mobile.close} onClick={() => setMenuOpen(false)} />}
      <Dialog open={Boolean(quickView)} onOpenChange={(open) => !open && setQuickView(null)}>
        {quickView && <DialogContent className="commerce-dialog quick-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <DialogTitle className="sr-only">{productCopy(quickView).name}</DialogTitle>
          <DialogDescription className="sr-only">{productCopy(quickView).description}</DialogDescription>
          <div className="quick-view-art"><div className="product-image-crop" style={{ '--crop-left': `${quickView.crop.column * -100}%`, '--crop-top': `${quickView.crop.row * -100}%`, '--crop-position': quickView.crop.objectPosition } as CSSProperties}><img src={quickView.image} alt={productCopy(quickView).name} /></div></div>
          <div className="quick-view-copy">
            <p className="section-kicker">{productCopy(quickView).concentration}</p>
            <h2>{productCopy(quickView).name}</h2>
            <p>{productCopy(quickView).description}</p>
            <div className="note-pyramid">
              {(['top', 'heart', 'base'] as const).map((level) => <div key={level}><span>{copy.products.notes[level]}</span><p>{productCopy(quickView).notes[level].join(' · ')}</p></div>)}
            </div>
            <div className="size-picker" role="group" aria-label={copy.products.bottleSize}>
              {(['50ml', '100ml'] as const).map((size) => <button key={size} type="button" aria-pressed={quickSize === size} className={quickSize === size ? 'selected' : ''} onClick={() => setQuickSize(size)}><span>{formatSize(size)}</span><small>{formatPrice(quickView.prices[size])}</small></button>)}
            </div>
            <div className="quick-purchase-row">
              <div className="quantity-control" aria-label={copy.products.quantity}>
                <button type="button" aria-label={copy.products.decrease} onClick={() => setQuickQuantity((qty) => Math.max(1, qty - 1))}><Minus size={15} /></button>
                <output aria-live="polite">{new Intl.NumberFormat(rtl ? 'ar-KW' : 'en-KW').format(quickQuantity)}</output>
                <button type="button" aria-label={copy.products.increase} onClick={() => setQuickQuantity((qty) => Math.min(99, qty + 1))}><Plus size={15} /></button>
              </div>
              <button type="button" className="cta-primary quick-add" onClick={() => { addProduct(quickView.id, quickSize, quickQuantity); setQuickView(null); }}>{copy.add} <span>{formatPrice(quickView.prices[quickSize] * quickQuantity)}</span></button>
            </div>
          </div>
        </DialogContent>}
      </Dialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="commerce-dialog search-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <DialogTitle>{copy.quick.searchTitle}</DialogTitle>
          <DialogDescription>{copy.quick.searchDescription}</DialogDescription>
          <div className="search-field"><Search size={19} /><input ref={searchInputRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={copy.quick.placeholder} aria-label={copy.search} data-testid="input-search" /></div>
          {searchQuery.trim() && <div className="search-results" aria-live="polite">
            {matchingProducts.length ? matchingProducts.map((product) => <button key={product.id} type="button" className="search-result" onClick={() => { setSearchOpen(false); openQuickView(product); }}><span>{productCopy(product).name}</span><small>{productCopy(product).noteHighlights.join(' · ')}</small><ArrowRight size={16} /></button>) : <p className="panel-empty">{copy.noResults}</p>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="commerce-dialog side-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <div className="panel-heading"><div><p className="section-kicker">NOIR / 01</p><DialogTitle>{copy.cart} <span className="panel-count">{cartCount}</span></DialogTitle></div><DialogDescription className="sr-only">{copy.quick.cartDescription}</DialogDescription></div>
          {cart.length === 0 ? <div className="panel-empty-state"><ShoppingBag size={32} /><p>{copy.emptyCart}</p><button type="button" className="text-action" onClick={() => { setCartOpen(false); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }}>{copy.startShopping} <ArrowRight size={15} /></button></div> :
            <div className="panel-lines">{cart.map((line) => {
              const product = products.find((item) => item.id === line.productId)!;
              return <article className="commerce-line" key={`${line.productId}-${line.size}`}>
                <div className="line-thumb"><div className="product-image-crop" style={{ '--crop-left': `${product.crop.column * -100}%`, '--crop-top': `${product.crop.row * -100}%`, '--crop-position': product.crop.objectPosition } as CSSProperties}><img src={product.image} alt="" /></div></div>
              <div className="line-detail"><h3>{productCopy(product).name}</h3><p>{formatSize(line.size)} · {formatPrice(product.prices[line.size])}</p><div className="quantity-control compact"><button type="button" aria-label={copy.products.decrease} onClick={() => changeQuantity(line.productId, line.size, -1)}><Minus size={13} /></button><output>{formatNumber(line.quantity)}</output><button type="button" aria-label={copy.products.increase} onClick={() => changeQuantity(line.productId, line.size, 1)}><Plus size={13} /></button></div></div>
                <div className="line-total"><strong>{formatPrice(product.prices[line.size] * line.quantity)}</strong><button type="button" aria-label={`${copy.remove} ${productCopy(product).name}`} onClick={() => { removeFromCart(line.productId, line.size); toast({ title: copy.removedFromCart }); }}><Trash2 size={16} /></button></div>
              </article>;
            })}</div>}
          {cart.length > 0 && <div className="panel-footer"><div className="subtotal-row"><span>{copy.subtotal}</span><strong>{formatPrice(subtotal)}</strong></div><button type="button" className="cta-primary panel-cta" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>{copy.checkout}<ArrowRight size={16} /></button></div>}
        </DialogContent>
      </Dialog>

      <Dialog open={favoritesOpen} onOpenChange={setFavoritesOpen}>
        <DialogContent className="commerce-dialog side-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <div className="panel-heading"><div><p className="section-kicker">NOIR / 02</p><DialogTitle>{copy.favorites} <span className="panel-count">{favoriteCount}</span></DialogTitle></div><DialogDescription className="sr-only">{copy.quick.savedDescription}</DialogDescription></div>
          {!favorites.length ? <div className="panel-empty-state"><Heart size={32} /><p>{copy.emptyFavorites}</p><button type="button" className="text-action" onClick={() => { setFavoritesOpen(false); document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }); }}>{copy.startShopping} <ArrowRight size={15} /></button></div> :
            <div className="panel-lines">{favorites.map((id) => {
              const product = products.find((item) => item.id === id)!;
              return <article className="commerce-line favorite-line" key={id}>
                <button type="button" className="line-thumb thumb-button" onClick={() => { setFavoritesOpen(false); openQuickView(product); }} aria-label={`${rtl ? 'عرض' : 'View'} ${productCopy(product).name}`}><div className="product-image-crop" style={{ '--crop-left': `${product.crop.column * -100}%`, '--crop-top': `${product.crop.row * -100}%`, '--crop-position': product.crop.objectPosition } as CSSProperties}><img src={product.image} alt="" /></div></button>
                <div className="line-detail"><h3>{productCopy(product).name}</h3><p>{formatPrice(product.prices['100ml'])} · {formatSize('100ml')}</p><button type="button" className="favorite-add" onClick={() => addProduct(product.id, '100ml')}>{copy.add}</button></div>
                <button type="button" className="remove-favorite" aria-label={`${copy.remove} ${productCopy(product).name}`} onClick={() => { removeFavorite(id); toast({ title: copy.removedFavorite }); }}><X size={17} /></button>
              </article>;
            })}</div>}
        </DialogContent>
      </Dialog>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="commerce-dialog checkout-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <p className="section-kicker">NOIR / 03</p><DialogTitle>{copy.quick.deliveryTitle}</DialogTitle>
          <DialogDescription>{copy.quick.deliveryDescription}</DialogDescription>
          <form className="checkout-form" onSubmit={submitCheckout}>
            <label>{copy.name}<input name="name" autoComplete="name" required /></label>
            <label>{copy.phone}<input name="phone" type="tel" autoComplete="tel" required /></label>
            <label>{copy.address}<textarea name="address" autoComplete="street-address" rows={2} required /></label>
            <fieldset><legend>{copy.payment}</legend>
              {[
                { value: 'card', key: 'card' },
                { value: 'knet', key: 'knet' },
                { value: 'cash', key: 'cash' },
              ].map((method, index) => <label className="payment-option" key={method.value}><input type="radio" name="payment" value={method.value} defaultChecked={index === 0} />{copy.paymentOptions[method.key as 'card' | 'knet' | 'cash']}</label>)}
            </fieldset>
            <div className="subtotal-row checkout-total"><span>{copy.subtotal}</span><strong>{formatPrice(subtotal)}</strong></div>
            <button type="submit" className="cta-primary panel-cta">{copy.submitOrder}<Check size={16} /></button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={orderComplete} onOpenChange={setOrderComplete}>
        <DialogContent className="commerce-dialog confirmation-dialog" dir={rtl ? 'rtl' : 'ltr'}>
          <span className="confirmation-mark"><Check size={25} /></span><p className="section-kicker">NOIR / 04</p><DialogTitle>{copy.quick.confirmation}</DialogTitle><DialogDescription>{copy.orderSuccess}</DialogDescription><button type="button" className="cta-primary panel-cta" onClick={() => setOrderComplete(false)}>{copy.quick.continue}</button>
        </DialogContent>
      </Dialog>
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
        <CommerceProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
        </CommerceProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
