import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGetProfile } from '@workspace/api-client-react';
import { useAuth } from './auth-shell';
import { getCart, getFavorites } from './i18n/preferences';

export type PerfumeSize = '50ml' | '100ml';
export type CartLine = { productId: string; size: PerfumeSize; quantity: number };
type CommerceState = {
  cart: CartLine[];
  favorites: string[];
  favoritesReady: boolean;
  favoriteSyncError: boolean;
  clearFavoriteSyncError: () => void;
  addToCart: (id: string, size: PerfumeSize, quantity?: number) => void;
  changeQuantity: (id: string, size: PerfumeSize, delta: number) => void;
  removeFromCart: (id: string, size: PerfumeSize) => void;
  toggleFavorite: (id: string) => Promise<boolean>;
  removeFavorite: (id: string) => Promise<boolean>;
  clearCart: () => void;
  deductPurchased: (items: CartLine[], owner: string) => void;
};

const canonicalCart = (saved: unknown): CartLine[] => {
  const lines = new Map<string, CartLine>();
  (Array.isArray(saved) ? saved : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const { productId, size, quantity } = entry as Partial<CartLine>;
    if (typeof productId !== 'string' || !/^[a-z0-9-]{2,60}$/.test(productId) ||
      !['50ml', '100ml'].includes(size ?? '') || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) return;
    const key = `${productId}:${size}`;
    lines.set(key, { productId, size: size as PerfumeSize, quantity: Math.min(99, Math.floor(quantity) + (lines.get(key)?.quantity ?? 0)) });
  });
  return [...lines.values()];
};
const canonicalFavorites = (saved: unknown): string[] =>
  [...new Set((Array.isArray(saved) ? saved : []).filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{2,60}$/.test(id)))];
const read = (key: string): unknown[] => {
  try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const write = (key: string, data: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* The current session remains usable. */ }
};
const Context = createContext<CommerceState | null>(null);
type Bucket = { scope: string; cart: CartLine[]; favorites: string[] };

export function CommerceProvider({ children }: { children: ReactNode }) {
  const { user, client, isLoaded } = useAuth();
  const scope = user?.id ?? 'guest';
  const profile = useGetProfile({ query: { enabled: isLoaded && Boolean(user), staleTime: 30_000, retry: false } });
  const [bucket, setBucket] = useState<Bucket>(() => ({
    scope: 'guest',
    cart: canonicalCart([...getCart(), ...read('noir:cart:guest')]),
    favorites: canonicalFavorites([...getFavorites(), ...read('noir:favorites:guest')]),
  }));
  const [favoritesReady, setFavoritesReady] = useState(true);
  const [favoriteSyncError, setFavoriteSyncError] = useState(false);
  const [legacySourceId, setLegacySourceId] = useState<string | null>(null);
  const pendingGuestFavorites = useRef<string[]>([]);
  const legacyFavorites = useRef<string[]>([]);
  const legacyFavoritesKey = useRef<string | null>(null);
  const migratedLegacyProfileId = useRef<string | null>(null);
  const favoriteQueue = useRef<Promise<unknown>>(Promise.resolve());
  const visibleFavorites = bucket.scope === scope ? bucket.favorites : [];
  const favoritesRef = useRef(visibleFavorites);
  favoritesRef.current = visibleFavorites;

  useEffect(() => {
    if (!isLoaded || bucket.scope === scope) return;
    const mergeGuest = bucket.scope === 'guest' && scope !== 'guest';
    pendingGuestFavorites.current = mergeGuest ? bucket.favorites : [];
    const cart = canonicalCart([...read(`noir:cart:${scope}`), ...(mergeGuest ? bucket.cart : [])]);
    const favorites = mergeGuest ? bucket.favorites : [];
    if (mergeGuest) {
      write('noir:cart:guest', []);
      write('noir:favorites:guest', []);
    }
    setFavoritesReady(scope === 'guest');
    setFavoriteSyncError(false);
    setBucket({ scope, cart, favorites });
  }, [scope, bucket, isLoaded]);

  // A verified-email profile lookup returns its legacy Clerk id. Use that id
  // only after server verification to carry forward this user's local cart and
  // favorites; the stable profile key still backs their existing orders.
  useEffect(() => {
    const legacyId = profile.data?.id;
    if (!isLoaded || !user || !legacyId || legacyId === user.id || bucket.scope !== scope ||
      migratedLegacyProfileId.current === legacyId) return;
    const cartKey = `noir:cart:${legacyId}`;
    const favoritesKey = `noir:favorites:${legacyId}`;
    const oldCart = canonicalCart(read(cartKey));
    const oldFavorites = canonicalFavorites(read(favoritesKey));
    legacyFavorites.current = oldFavorites;
    legacyFavoritesKey.current = favoritesKey;
    migratedLegacyProfileId.current = legacyId;
    setLegacySourceId(legacyId);
    setBucket((current) => {
      if (current.scope !== scope) return current;
      const nextCart = canonicalCart([...current.cart, ...oldCart]);
      write(`noir:cart:${scope}`, nextCart);
      write(cartKey, []);
      return { ...current, cart: nextCart };
    });
  }, [isLoaded, user, profile.data?.id, bucket.scope, scope]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setFavoritesReady(true);
      return;
    }
    if (!client || bucket.scope !== scope) return;
    let active = true;
    setFavoritesReady(false);
    void (async () => {
      try {
        const { data, error } = await client.from('noir_favorites').select('product_id').order('created_at', { ascending: false });
        if (!active) return;
        if (error) {
          setFavoriteSyncError(true);
          setFavoritesReady(true);
          return;
        }
        const saved = canonicalFavorites(data.map((row) => row.product_id));
        const legacy = canonicalFavorites([...pendingGuestFavorites.current, ...legacyFavorites.current]);
        const missing = legacy.filter((id) => !saved.includes(id));
        if (missing.length) {
          const { error: insertError } = await client.from('noir_favorites')
            .insert(missing.map((product_id) => ({ user_id: user.id, product_id })));
          if (!active) return;
          if (insertError) {
            setFavoriteSyncError(true);
            setBucket((current) => current.scope === scope
              ? { ...current, favorites: canonicalFavorites([...saved, ...legacy]) } : current);
            setFavoritesReady(true);
            return;
          }
        }
        if (!active) return;
        pendingGuestFavorites.current = [];
        legacyFavorites.current = [];
        if (legacyFavoritesKey.current) write(legacyFavoritesKey.current, []);
        setFavoriteSyncError(false);
        setBucket((current) => current.scope === scope
          ? { ...current, favorites: canonicalFavorites([...saved, ...legacy]) } : current);
        setFavoritesReady(true);
      } catch {
        if (!active) return;
        setFavoriteSyncError(true);
        setFavoritesReady(true);
      }
    })();
    return () => { active = false; };
  }, [client, isLoaded, user?.id, bucket.scope, scope, legacySourceId]);

  useEffect(() => {
    if (!isLoaded || bucket.scope !== scope) return;
    write(`noir:cart:${scope}`, bucket.cart);
    if (scope === 'guest') write('noir:favorites:guest', bucket.favorites);
    else write(`noir:favorites:${scope}`, []);
    write('noir:cart', []);
    write('noir:favorites', []);
  }, [bucket, scope, isLoaded]);

  const addToCart = useCallback((productId: string, size: PerfumeSize, quantity = 1) => {
    setBucket((current) => current.scope !== scope ? current : ({
      ...current, cart: canonicalCart([...current.cart, { productId, size, quantity }]),
    }));
  }, [scope]);
  const changeQuantity = useCallback((productId: string, size: PerfumeSize, delta: number) => {
    setBucket((current) => ({
      ...current,
      cart: current.cart.map((line) => line.productId === productId && line.size === size
        ? { ...line, quantity: Math.max(1, Math.min(99, line.quantity + delta)) } : line),
    }));
  }, []);
  const removeFromCart = useCallback((productId: string, size: PerfumeSize) => {
    setBucket((current) => ({
      ...current, cart: current.cart.filter((line) => !(line.productId === productId && line.size === size)),
    }));
  }, []);
  const changeFavorite = useCallback((id: string, requested: boolean | 'toggle'): Promise<boolean> => {
    const work = async () => {
      if (!favoritesReady) return false;
      const before = favoritesRef.current;
      const shouldSave = requested === 'toggle' ? !before.includes(id) : requested;
      const alreadySaved = before.includes(id);
      if (alreadySaved === shouldSave) return true;
      const next = shouldSave ? [...before, id] : before.filter((favorite) => favorite !== id);
      favoritesRef.current = next;
      setBucket((current) => current.scope === scope ? { ...current, favorites: next } : current);
      if (user) {
        if (!client) { favoritesRef.current = before; return false; }
        const result = shouldSave
          ? await client.from('noir_favorites').insert({ user_id: user.id, product_id: id })
          : await client.from('noir_favorites').delete().eq('user_id', user.id).eq('product_id', id);
        if (result.error) {
          favoritesRef.current = before;
          setBucket((current) => current.scope === scope ? { ...current, favorites: before } : current);
          return false;
        }
      }
      setFavoriteSyncError(false);
      return true;
    };
    const next = favoriteQueue.current.then(work, work);
    favoriteQueue.current = next.catch(() => false);
    return next;
  }, [favoritesReady, client, user?.id, scope]);
  const toggleFavorite = useCallback((id: string) => changeFavorite(id, 'toggle'), [changeFavorite]);
  const removeFavorite = useCallback((id: string) => changeFavorite(id, false), [changeFavorite]);
  const clearFavoriteSyncError = useCallback(() => setFavoriteSyncError(false), []);
  const clearCart = useCallback(() => setBucket((current) => ({ ...current, cart: [] })), []);
  const deductPurchased = useCallback((items: CartLine[], owner: string) => setBucket((current) => current.scope !== owner ? current : ({
    ...current,
    cart: current.cart.map((line) => ({
      ...line,
      quantity: line.quantity - (items.find((item) => item.productId === line.productId && item.size === line.size)?.quantity ?? 0),
    })).filter((line) => line.quantity > 0),
  })), []);

  const value = useMemo(() => ({
    cart: bucket.scope === scope ? bucket.cart : [],
    favorites: visibleFavorites,
    favoritesReady,
    favoriteSyncError,
    clearFavoriteSyncError,
    addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart, deductPurchased,
  }), [bucket, scope, visibleFavorites, favoritesReady, favoriteSyncError, clearFavoriteSyncError, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart, deductPurchased]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCommerce() {
  const value = useContext(Context);
  if (!value) throw new Error('CommerceProvider is missing');
  return value;
}
