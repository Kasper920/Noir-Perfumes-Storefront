export type LocalProduct = {
  id: string;
  concentration: { en: string; ar: string };
  name: { en: string; ar: string };
  notes: Record<'top' | 'heart' | 'base', { en: string[]; ar: string[] }>;
  noteHighlights: { en: string[]; ar: string[] };
  description: { en: string; ar: string };
  image: string;
  crop: {
    column: number;
    row: number;
    columns: number;
    rows: number;
    objectFit: string;
    objectPosition: string;
  };
  audience: { en: string[]; ar: string[] };
  collections: { en: string[]; ar: string[] };
  badge: { en: string; ar: string } | null;
  prices: { '100ml': number; '50ml': number };
};

export const products: LocalProduct[];
export function formatPrice(amount: number, language?: 'en' | 'ar'): string;
