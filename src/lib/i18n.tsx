'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import elMessages from '../../messages/el.json';

type Locale = 'el' | 'en' | 'nl';
type Messages = typeof elMessages;

const SUPPORTED_LOCALES: Locale[] = ['el', 'en', 'nl'];

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

function detectBrowserLocale(): Locale {
  const lang = navigator.language;
  if (lang.startsWith('el')) return 'el';
  if (lang.startsWith('nl')) return 'nl';
  return 'en';
}

async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'el':
      return elMessages;
    case 'nl':
      return (await import('../../messages/nl.json')).default;
    case 'en':
    default:
      return (await import('../../messages/en.json')).default;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('el');
  const [messages, setMessages] = useState<Messages>(elMessages);

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null;
    let initial: Locale = 'el';
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      initial = stored;
    } else {
      initial = detectBrowserLocale();
    }
    if (initial !== 'el') {
      setLocaleState(initial);
      loadMessages(initial).then(setMessages);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
    loadMessages(newLocale).then(setMessages);
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
