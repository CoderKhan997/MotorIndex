/* ============================================================
   MotorIndex — Theme Manager
   Handles light/dark mode with smooth transitions
   ============================================================ */

(function () {
  const STORAGE_KEY = 'mi_theme';
  const html = document.documentElement;

  // Apply saved or system preference immediately (before paint)
  const saved = localStorage.getItem(STORAGE_KEY);
  const initial = saved || 'light';
  html.setAttribute('data-theme', initial);

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    document.title = document.title; // force repaint hint
  }

  function toggle() {
    const current = html.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Wire up toggle button once DOM is ready
  function wireButton() {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButton);
  } else {
    wireButton();
  }

  // Sync across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      html.setAttribute('data-theme', e.newValue);
    }
  });
})();
