import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files would normally be separated, doing it inline for initial setup
const resources = {
  en: {
    translation: {
      "welcome": "Welcome to DigiMedal",
      "loading": "Loading...",
    }
  },
  fr: {
    translation: {
      "welcome": "Bienvenue sur DigiMedal",
      "loading": "Chargement...",
    }
  },
  ar: {
    translation: {
      "welcome": "مرحبا بك في ديجي ميدال",
      "loading": "جاري التحميل...",
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
