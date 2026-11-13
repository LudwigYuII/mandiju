"use client";
import { createContext, useContext, useEffect, useState } from "react";
export type Locale = "zh-Hans" | "zh-Hant";
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "zh-Hans", setLocale: () => {} });
export const useLanguage = () => useContext(LanguageContext);
export default function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, update] = useState<Locale>(initialLocale);
  const setLocale = (next: Locale) => {
    update(next);
    document.cookie = `mdj-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}
