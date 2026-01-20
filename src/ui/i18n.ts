export type LocalizedText = {
  ja: string;
  en: string;
};

const getPreferredLanguage = (): string => {
  if (typeof document !== "undefined") {
    const docLang = document.documentElement?.lang?.trim();
    if (docLang) {
      return docLang.toLowerCase();
    }
  }
  if (typeof navigator !== "undefined") {
    const navLang = navigator.language?.trim();
    if (navLang) {
      return navLang.toLowerCase();
    }
  }
  return "ja";
};

export const resolveLocalizedText = (text: LocalizedText): string => {
  const lang = getPreferredLanguage();
  return lang.startsWith("en") ? text.en : text.ja;
};
