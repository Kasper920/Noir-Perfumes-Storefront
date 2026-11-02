import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { products } from './data/products';
import { getCart, getFavorites, setCart, setFavorites } from './i18n/preferences';

export type PerfumeSize = '50ml' | '100ml';
export type CartLine = { productId: string; size: PerfumeSize; quantity: number };
type CommerceState = {
  cart: CartLine[];
  favorites: string[];
  addToCart: (productId: string, size: PerfumeSize, quantity?: number) => void;
  changeQuantity: (productId: string, size: PerfumeSize, delta: number) => void;
  removeFromCart: (productId: string, size: PerfumeSize) => void;
  toggleFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  clearCart: () => void;
};

const validIds = new Set(products.map((product) => product.id));
const canonicalCart = (saved: unknown): CartLine[] => {
  const lines = new Map<string, CartLine>();
  (Array.isArray(saved) ? saved : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const line = entry as Record<string, unknown>;
    const productId = line.productId;
    const size = line.size;
    const quantity = line.quantity;
    if (typeof productId !== 'string' || !validIds.has(productId) ||
      (size !== '50ml' && size !== '100ml') ||
      typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) return;
    const key = `${productId}:${size}`;
    const current = lines.get(key);
    lines.set(key, { productId, size, quantity: Math.min(99, (current?.quantity ?? 0) + Math.floor(quantity)) });
  });
  return [...lines.values()];
};
const canonicalFavorites = (saved: unknown): string[] =>
  [...new Set((Array.isArray(saved) ? saved : []).filter((id): id is string => typeof id === 'string' && validIds.has(id)))];

const CommerceContext = createContext<CommerceState | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<CartLine[]>(() => canonicalCart(getCart()));
  const [favorites, setFavoritesState] = useState<string[]>(() => canonicalFavorites(getFavorites()));

  useEffect(() => setCart(cart), [cart]);
  useEffect(() => setFavorites(favorites), [favorites]);

  const addToCart = useCallback((productId: string, size: PerfumeSize, quantity = 1) => {
    setCartState((current) => {
      const existing = current.find((line) => line.productId === productId && line.size === size);
      return existing
        ? current.map((line) => line === existing ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line)
        : [...current, { productId, size, quantity: Math.max(1, Math.min(99, quantity)) }];
    });
  }, []);
  const changeQuantity = useCallback((productId: string, size: PerfumeSize, delta: number) => {
    setCartState((current) => current.map((line) =>
      line.productId === productId && line.size === size
        ? { ...line, quantity: Math.max(1, Math.min(99, line.quantity + delta)) }
        : line));
  }, []);
  const removeFromCart = useCallback((productId: string, size: PerfumeSize) => {
    setCartState((current) => current.filter((line) => !(line.productId === productId && line.size === size)));
  }, []);
  const toggleFavorite = useCallback((productId: string) => {
    setFavoritesState((current) => current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId]);
  }, []);
  const removeFavorite = useCallback((productId: string) => {
    setFavoritesState((current) => current.filter((id) => id !== productId));
  }, []);
  const clearCart = useCallback(() => setCartState([]), []);
  const value = useMemo(() => ({ cart, favorites, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart }),
    [cart, favorites, addToCart, changeQuantity, removeFromCart, toggleFavorite, removeFavorite, clearCart]);
  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error('useCommerce must be used within CommerceProvider');
  return value;
}
