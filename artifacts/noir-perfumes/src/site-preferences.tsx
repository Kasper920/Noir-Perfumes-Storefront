import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getInitialLanguage, getInitialTheme, setPreference } from './i18n/preferences';

type Preferences = {
  language: 'en' | 'ar'; theme: 'dark' | 'light';
  setLanguage: React.Dispatch<React.SetStateAction<'en' | 'ar'>>;
  setTheme: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
};
const Context = createContext<Preferences | null>(null);
export function SitePreferences({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    setPreference('language', language);
    setPreference('theme', theme);
  }, [language, theme]);
  return <Context.Provider value={{ language, theme, setLanguage, setTheme }}>{children}</Context.Provider>;
}
export function useSitePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error('SitePreferences is missing');
  return value;
}
