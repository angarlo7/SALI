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

  var navToggle = document.getElementById('navToggle');
  var nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = nav.classList.toggle('nav--open');
      navToggle.textContent = isOpen ? '✕' : '☰';
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        nav.classList.remove('nav--open');
        navToggle.textContent = '☰';
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
