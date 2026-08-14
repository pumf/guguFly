import { zhCN } from './translations/zh-CN.js';
import { en } from './translations/en.js';

const STORAGE_KEY = 'appLanguage';

let currentLang = 'zh-CN';
let translations = { 'zh-CN': zhCN, 'en': en };
let fallbackLang = 'zh-CN';
let onChangeCallbacks = [];

function resolveKey(lang, key) {
  const table = translations[lang] || translations[fallbackLang];
  const val = table[key];
  if (val !== undefined) return val;
  if (lang !== fallbackLang) {
    const fallback = translations[fallbackLang][key];
    if (fallback !== undefined) return fallback;
  }
  return key;
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] !== undefined ? params[k] : `{{${k}}}`);
}

export function ta(key, params) {
  const val = resolveKey(currentLang, key);
  if (Array.isArray(val)) return val;
  return interpolate(val, params);
}

export function t(key, params) {
  const val = resolveKey(currentLang, key);
  return interpolate(val, params);
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang, { persist } = {}) {
  if (!translations[lang]) return;
  currentLang = lang;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch { /* localStorage may be unavailable */ }
  }
  translateDOM();
  onChangeCallbacks.forEach(fn => fn(lang));
}

export function onLanguageChange(fn) {
  onChangeCallbacks.push(fn);
  return () => {
    onChangeCallbacks = onChangeCallbacks.filter(f => f !== fn);
  };
}

export function translateDOM(root) {
  root = root || document;
  const elements = root.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  }
  const placeholders = root.querySelectorAll('[data-i18n-placeholder]');
  for (const el of placeholders) {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  }
  const titles = root.querySelectorAll('[data-i18n-title]');
  for (const el of titles) {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  }
  const values = root.querySelectorAll('[data-i18n-value]');
  for (const el of values) {
    const key = el.getAttribute('data-i18n-value');
    const opt = el.querySelector('option');
    if (el.tagName === 'SELECT' || el.tagName === 'OPTION') {
      el.textContent = t(key);
    }
  }
}

export function initI18n({ initialLang } = {}) {
  let lang = initialLang;
  if (!lang) {
    try {
      lang = localStorage.getItem(STORAGE_KEY);
    } catch { /* localStorage may be unavailable */ }
  }
  if (!lang || !translations[lang]) {
    lang = navigator.language && navigator.language.startsWith('en') ? 'en' : 'zh-CN';
  }
  currentLang = lang;
  translateDOM();
  return lang;
}
