'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import elMessages from '../../messages/el.json';

type Locale = 'el' | 'en';
type Messages = typeof elMessages;

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
  const [messages, setMessages] = useState<Messages>(elMessages);

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    let initial: Locale = 'el';
    if (stored && (stored === 'el' || stored === 'en')) {
      initial = stored;
    } else {
      initial = navigator.language.startsWith('el') ? 'el' : 'en';
    }
    if (initial !== 'el') {
      setLocaleState(initial);
      import('../../messages/en.json').then((mod) => setMessages(mod.default));
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
    if (newLocale === 'el') {
      setMessages(elMessages);
    } else {
      import('../../messages/en.json').then((mod) => setMessages(mod.default));
    }
  }, []);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages as unknown as Record<string, unknown>, key);
  }, [messages]);

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
