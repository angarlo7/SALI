(function () {
  var STORAGE_KEY = 'saliTheme';
  var DARK_CLASS = 'dark';

  function applyTheme(theme) {
    var btn = document.getElementById('themeToggle');
    if (theme === DARK_CLASS) {
      document.body.classList.add(DARK_CLASS);
      if (btn) btn.textContent = '☀️';
    } else {
      document.body.classList.remove(DARK_CLASS);
      if (btn) btn.textContent = '🌙';
    }
  }

  // Apply saved preference on page load
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved) applyTheme(saved);

  // Wire up toggle button
  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var isDark = document.body.classList.contains(DARK_CLASS);
      var next = isDark ? 'light' : DARK_CLASS;
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }
})();
