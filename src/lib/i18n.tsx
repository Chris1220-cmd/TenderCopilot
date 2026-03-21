'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import el from '../../messages/el.json';
import en from '../../messages/en.json';

type Locale = 'el' | 'en';
type Messages = typeof el;

const messages: Record<Locale, Messages> = { el, en };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const result = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('el');

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && (stored === 'el' || stored === 'en')) {
      setLocaleState(stored);
    } else {
      const browserLang = navigator.language.startsWith('el') ? 'el' : 'en';
      setLocaleState(browserLang);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages[locale] as unknown as Record<string, unknown>, key);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within I18nProvider');
  return context;
}
