import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useGetCatalog, type Product } from '@workspace/api-client-react';
import productGrid from './assets/noir-product-grid.webp';
import type { LocalProduct } from './data/products';

export type StoreProduct = LocalProduct & Product & { stock: Record<'50ml' | '100ml', number> };
const imageKeys = ['oud', 'rose', 'amber', 'musk', 'night', 'bloom'];
export function adaptProduct(product: Product): StoreProduct {
  const index = Math.max(0, imageKeys.indexOf(product.imageKey));
  return {
    ...product, image: productGrid,
    badge: product.badge ?? null,
    prices: Object.fromEntries(product.variants.map((v) => [v.size, v.price])) as StoreProduct['prices'],
    stock: Object.fromEntries(product.variants.map((v) => [v.size, v.stock])) as StoreProduct['stock'],
    crop: { column: index % 2, row: Math.floor(index / 2), columns: 2, rows: 3, objectFit: 'cover', objectPosition: `${index % 2 * 100}% ${Math.floor(index / 2) * 50}%` },
  } as StoreProduct;
}
type CatalogValue = { products: StoreProduct[]; loading: boolean; error: boolean; reload: () => void };
const Context = createContext<CatalogValue | null>(null);
export function CatalogProvider({ children }: { children: ReactNode }) {
  const query = useGetCatalog({ query: { staleTime: 15_000, refetchInterval: 30_000, retry: 1 } });
  const products = useMemo(() => (query.data ?? []).map(adaptProduct), [query.data]);
  return <Context.Provider value={{ products, loading: query.isPending, error: query.isError, reload: () => { void query.refetch(); } }}>{children}</Context.Provider>;
}
export function useCatalog() {
  const value = useContext(Context);
  if (!value) throw new Error('CatalogProvider is missing');
  return value;
}
