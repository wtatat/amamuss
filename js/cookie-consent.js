// Cookie consent banner
(function() {
  var COOKIE_CONSENT_KEY = 'amamus34_cookie_consent';

  function showCookieBanner() {
    if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted') {
      return;
    }

    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML =
      '<img src="cookie.jpg" alt="Cookie" onerror="this.style.display=\'none\'">' +
      '<div class="cookie-banner-text">' +
        'Этот сайт использует cookie-файлы для улучшения пользовательского опыта. ' +
        'Продолжая использовать сайт, вы соглашаетесь с использованием cookie.' +
      '</div>' +
      '<button type="button" onclick="acceptCookies()">Принять</button>';

    document.body.appendChild(banner);
  }

  window.acceptCookies = function() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    var banner = document.querySelector('.cookie-banner');
    if (banner) {
      banner.remove();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showCookieBanner);
  } else {
    showCookieBanner();
  }
})();
// Cookie consent banner
(function() {
  var COOKIE_CONSENT_KEY = 'amamus34_cookie_consent';

  function showCookieBanner() {
    if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted') {
      return;
    }

    var banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML =
      '<img src="cookie.jpg" alt="Cookie" onerror="this.style.display=\'none\'">' +
      '<div class="cookie-banner-text">' +
        'Этот сайт использует cookie-файлы для улучшения пользовательского опыта. ' +
        'Продолжая использовать сайт, вы соглашаетесь с использованием cookie.' +
      '</div>' +
      '<button type="button" onclick="acceptCookies()">Принять</button>';

    document.body.appendChild(banner);
  }

  window.acceptCookies = function() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    var banner = document.querySelector('.cookie-banner');
    if (banner) {
      banner.remove();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showCookieBanner);
  } else {
    showCookieBanner();
  }
})();
