// Gripply landing — cookie consent + gated Google Analytics loader.
// GA never loads until the visitor accepts; declining persists and keeps
// the site fully functional. Choice is stored in localStorage.
// Referenced as /consent.js?v=N — bump N in all three pages when editing
// this file (netlify.toml serves it with immutable caching).
(function () {
  'use strict';

  var KEY = 'gripply_consent';
  var GA_ID = 'G-HP2X1SG19H';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode — banner will reappear, GA stays off */ }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  function loadGA() {
    if (document.getElementById('ga-loader')) return;
    var s = document.createElement('script');
    s.id = 'ga-loader';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  function removeBanner() {
    var el = document.getElementById('consentBanner');
    if (el) el.remove();
  }

  function showBanner() {
    if (document.getElementById('consentBanner')) return;

    var banner = document.createElement('section');
    banner.id = 'consentBanner';
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    var text = document.createElement('p');
    text.className = 'consent-banner__text';
    text.innerHTML = 'We use one optional analytics cookie (Google Analytics) to understand how this site is used. ' +
      'Nothing runs unless you accept. See our <a href="/privacy">Privacy Policy</a>.';

    var actions = document.createElement('div');
    actions.className = 'consent-banner__actions';

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'btn btn--primary consent-banner__accept';
    accept.textContent = 'Accept analytics';
    accept.addEventListener('click', function () {
      store('granted');
      removeBanner();
      loadGA();
    });

    var decline = document.createElement('button');
    decline.type = 'button';
    decline.className = 'consent-banner__decline';
    decline.textContent = 'Decline';
    decline.addEventListener('click', function () {
      store('denied');
      removeBanner();
    });

    actions.appendChild(accept);
    actions.appendChild(decline);
    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  window.gripplyConsent = {
    granted: function () { return read() === 'granted'; },
    reset: function () { clear(); showBanner(); }
  };

  var choice = read();
  if (choice === 'granted') {
    loadGA();
  } else if (choice !== 'denied') {
    showBanner();
  }

  // "Cookie choices" footer link re-opens the banner
  document.querySelectorAll('[data-cookie-choices]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      window.gripplyConsent.reset();
    });
  });
})();
