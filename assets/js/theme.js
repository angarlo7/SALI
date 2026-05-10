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

  var navToggle = document.getElementById('navToggle');
  var nav = document.querySelector('.nav');
  if (navToggle && nav) {
    function closeNav() {
      nav.classList.remove('nav--open');
      navToggle.textContent = '☰';
      navToggle.setAttribute('aria-expanded', 'false');
    }

    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle('nav--open');
      navToggle.textContent = isOpen ? '✕' : '☰';
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        closeNav();
      }
    });
    window.addEventListener('scroll', function () {
      if (nav.classList.contains('nav--open')) {
        closeNav();
      }
    }, { passive: true });
  }
})();
