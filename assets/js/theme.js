(function () {
  var STORAGE_KEY = 'sali.angarlo.theme';
  var LEGACY_KEY = 'saliTheme';
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

  var saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    var legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      saved = legacy;
      localStorage.setItem(STORAGE_KEY, saved);
      localStorage.removeItem(LEGACY_KEY);
    }
  }
  if (saved) applyTheme(saved);

  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var isDark = document.body.classList.contains(DARK_CLASS);
      var next = isDark ? 'light' : DARK_CLASS;
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }

  // ES/EN language toggle
  var isEs = window.location.pathname.indexOf('/es') === 0;
  var altLang = isEs ? 'en' : 'es';
  var altLink = document.querySelector('link[rel="alternate"][hreflang="' + altLang + '"]');
  if (altLink && toggle) {
    var langBtn = document.createElement('a');
    langBtn.href = altLink.getAttribute('href');
    langBtn.textContent = isEs ? 'EN' : 'ES';
    langBtn.className = 'lang-toggle';
    langBtn.setAttribute('aria-label', isEs ? 'View in English' : 'View in Spanish');
    toggle.parentNode.insertBefore(langBtn, toggle);
  }

})();
