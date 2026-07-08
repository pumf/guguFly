import { t } from './i18n/index.js';

const QUOTE_KEYS = [
  'quote.1', 'quote.2', 'quote.3', 'quote.4', 'quote.5', 'quote.6',
  'quote.7', 'quote.8', 'quote.9', 'quote.10', 'quote.11', 'quote.12',
];

export function getRandomQuote() {
  const key = QUOTE_KEYS[Math.floor(Math.random() * QUOTE_KEYS.length)];
  return t(key);
}
