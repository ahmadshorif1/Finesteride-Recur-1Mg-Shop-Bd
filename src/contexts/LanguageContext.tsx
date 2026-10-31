import React, { createContext, useContext, useState } from 'react';

type Language = 'bn' | 'en';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (bn: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('finesteride_lang');
      if (saved === 'en' || saved === 'bn') return saved;
    } catch {}
    return 'bn';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem('finesteride_lang', next);
    } catch {}
  };

  const t = (bn: string, en: string): string => {
    return lang === 'en' ? en : bn;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
