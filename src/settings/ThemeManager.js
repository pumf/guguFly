let currentTheme = 'system';
let systemThemeMedia = null;
let themeCheckInterval = null;

export function getCurrentTheme() {
  return currentTheme;
}

export function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  const updateActive = () => {
    let activeTheme;
    if (theme === 'system' && systemThemeMedia) {
      activeTheme = systemThemeMedia.matches ? 'dark' : 'light';
    } else if (theme === 'auto-time') {
      const h = new Date().getHours();
      activeTheme = (h >= 6 && h < 18) ? 'light' : 'dark';
    } else {
      activeTheme = theme;
    }
    document.documentElement.setAttribute('data-active-theme', activeTheme);
  };
  updateActive();

  if (themeCheckInterval) clearInterval(themeCheckInterval);
  if (theme === 'auto-time') {
    themeCheckInterval = setInterval(() => {
      const h = new Date().getHours();
      const isDark = h < 6 || h >= 18;
      const currentActive = document.documentElement.getAttribute('data-active-theme');
      if (isDark && currentActive === 'light') {
        document.documentElement.setAttribute('data-active-theme', 'dark');
      } else if (!isDark && currentActive === 'dark') {
        document.documentElement.setAttribute('data-active-theme', 'light');
      }
    }, 60000);
  }
}

export function syncThemeButtons() {
  const theme = currentTheme;
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.theme === theme);
  });
}

export function initSystemThemeWatcher() {
  if (!window.matchMedia) return;
  systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (currentTheme === 'system') applyTheme('system');
  };
  if (systemThemeMedia.addEventListener) {
    systemThemeMedia.addEventListener('change', handler);
  } else if (systemThemeMedia.addListener) {
    systemThemeMedia.addListener(handler);
  }
}
