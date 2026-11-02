export const STORAGE_KEYS = {
  theme: 'noir:theme',
  language: 'noir:language',
  cart: 'noir:cart',
  favorites: 'noir:favorites',
} as const;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences remain usable for the current session when storage is unavailable.
  }
};

export const getPreference = <T,>(name: 'theme' | 'language', fallback: T): T =>
  read(STORAGE_KEYS[name], fallback);
export const setPreference = (name: 'theme' | 'language', value: string) =>
  write(STORAGE_KEYS[name], value);
export const getCart = (): unknown[] => read(STORAGE_KEYS.cart, []);
export const setCart = (items: unknown[]) => write(STORAGE_KEYS.cart, items);
export const getFavorites = (): string[] => read(STORAGE_KEYS.favorites, []);
export const setFavorites = (items: string[]) => write(STORAGE_KEYS.favorites, items);
