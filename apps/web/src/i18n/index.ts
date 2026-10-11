import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import te from '../locales/te.json';
import { readStore, writeStore } from '../lib/session';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
] as const;

const LANG_KEY = 'ecoproof.lang';
const saved = readStore(LANG_KEY);
const initial = LANGUAGES.some((l) => l.code === saved) ? (saved as string) : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, te: { translation: te }, hi: { translation: hi } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Switching language never changes stored data: it only remembers the choice on this device.
i18n.on('languageChanged', (lng) => writeStore(LANG_KEY, lng));

export default i18n;
