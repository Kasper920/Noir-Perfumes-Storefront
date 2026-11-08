import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUser } from '@clerk/react';
import { getCart, getFavorites } from './i18n/preferences';

export type PerfumeSize = '50ml' | '100ml';
export type CartLine = { productId: string; size: PerfumeSize; quantity: number };
type CommerceState = {
  cart: CartLine[]; favorites: string[];
  addToCart: (id: string, size: PerfumeSize, quantity?: number) => void;
  changeQuantity: (id: string, size: PerfumeSize, delta: number) => void;
  removeFromCart: (id: string, size: PerfumeSize) => void;
  toggleFavorite: (id: string) => void; removeFavorite: (id: string) => void;
  clearCart: () => void; deductPurchased: (items: CartLine[], owner: string) => void;
};
const canonicalCart = (saved: unknown): CartLine[] => {
  const lines = new Map<string, CartLine>();
  (Array.isArray(saved) ? saved : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const { productId, size, quantity } = entry;
    if (typeof productId !== 'string' || !/^[a-z0-9-]{2,60}$/.test(productId) ||
      !['50ml', '100ml'].includes(size) || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) return;
    const key = `${productId}:${size}`;
    lines.set(key, { productId, size, quantity: Math.min(99, Math.floor(quantity) + (lines.get(key)?.quantity ?? 0)) });
  });
  return [...lines.values()];
};
const canonicalFavorites = (saved: unknown): string[] =>
  [...new Set((Array.isArray(saved) ? saved : []).filter((id): id is string => typeof id === 'string' && /^[a-z0-9-]{2,60}$/.test(id)))];
const read = (key: string): unknown[] => { try { const value = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const write = (key: string, data: unknown) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* Session remains usable. */ } };
const Context = createContext<CommerceState | null>(null);
type Bucket = { scope: string; cart: CartLine[]; favorites: string[] };
export function CommerceProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const scope = user?.id ?? 'guest';
  const [bucket, setBucket] = useState<Bucket>(() => ({
    scope: 'guest', cart: canonicalCart([...getCart(), ...(read('noir:cart:guest') as unknown[])]),
    favorites: canonicalFavorites([...getFavorites(), ...(read('noir:favorites:guest') as unknown[])]),
  }));
  useEffect(() => {
    if (!isLoaded || bucket.scope === scope) return;
    const mergeGuest = bucket.scope === 'guest' && scope !== 'guest';
    const cart = canonicalCart([...(read(`noir:cart:${scope}`) as unknown[]), ...(mergeGuest ? bucket.cart : [])]);
    const favorites = canonicalFavorites([...(read(`noir:favorites:${scope}`) as unknown[]), ...(mergeGuest ? bucket.favorites : [])]);
    if (mergeGuest) { write('noir:cart:guest', []); write('noir:favorites:guest', []); }
    setBucket({ scope, cart, favorites });
  }, [scope, bucket, isLoaded]);
  useEffect(() => {
    if (!isLoaded || bucket.scope !== scope) return;
    write(`noir:cart:${scope}`, bucket.cart); write(`noir:favorites:${scope}`, bucket.favorites);
    write('noir:cart', []); write('noir:favorites', []);
  }, [bucket, scope, isLoaded]);
  const addToCart = useCallback((productId: string, size: PerfumeSize, quantity = 1) => {
    setBucket((b) => ({ ...b, cart: canonicalCart([...b.cart, { productId, size, quantity }]) }));
  }, []);
  const changeQuantity = useCallback((productId: string, size: PerfumeSize, delta: number) => {
    setBucket((b) => ({ ...b, cart: b.cart.map((l) => l.productId === productId && l.size === size ? { ...l, quantity: Math.max(1, Math.min(99, l.quantity + delta)) } : l) }));
  }, []);
  const removeFromCart = useCallback((productId: string, size: PerfumeSize) => {
    setBucket((b) => ({ ...b, cart: b.cart.filter((l) => !(l.productId === productId && l.size === size)) }));
  }, []);
  const toggleFavorite = useCallback((id: string) => {
    setBucket((b) => ({ ...b, favorites: b.favorites.includes(id) ? b.favorites.filter((i) => i !== id) : [...b.favorites, id] }));
  }, []);
  const removeFavorite = useCallback((id: string) => setBucket((b) => ({ ...b, favorites: b.favorites.filter((i) => i !== id) })), []);
  const clearCart = useCallback(() => setBucket((b) => ({ ...b, cart: [] })), []);
  const deductPurchased = useCallback((items: CartLine[], owner: string) => setBucket((b) => b.scope !== owner ? b : ({
    ...b, cart: b.cart.map((l) => ({ ...l, quantity: l.quantity - (items.find((i) => i.productId === l.productId && i.size === l.size)?.quantity ?? 0) })).filter((l) => l.quantity > 0),
  })), []);
  // Do not expose the previous account's contents during an identity switch.
  const cart = bucket.scope === scope ? bucket.cart : [];
  const favorites = bucket.scope === scope ? bucket.favorites : [];
  const value = useMemo(() => ({ cart, favorites, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart, deductPurchased }),
    [cart, favorites, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart, deductPurchased]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCommerce() {
  const value = useContext(Context);
  if (!value) throw new Error('CommerceProvider is missing');
  return value;
}
