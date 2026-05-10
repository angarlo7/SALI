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

  var saved = localStorage.getItem(STORAGE_KEY);
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

  function injectHamburger() {
    var nav = document.querySelector('.nav');
    var navInner = document.querySelector('.nav__inner');
    if (!nav || !navInner || navInner.querySelector('.nav__hamburger')) return;

    var hamburger = document.createElement('button');
    hamburger.className = 'nav__hamburger';
    hamburger.setAttribute('aria-label', 'Toggle navigation');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.textContent = '☰';

    var logo = navInner.querySelector('.nav__logo');
    if (logo && logo.nextSibling) {
      navInner.insertBefore(hamburger, logo.nextSibling);
    } else {
      navInner.appendChild(hamburger);
    }

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle('nav--open');
      hamburger.textContent = isOpen ? '✕' : '☰';
      hamburger.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        nav.classList.remove('nav--open');
        hamburger.textContent = '☰';
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Script runs at end of body — DOM is already parsed.
  // readyState check handles both inline and deferred loading.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectHamburger);
  } else {
    injectHamburger();
  }
})();
