// Gripply landing — waitlist forms + mobile menu.
// Referenced as /site.js?v=N — bump N in all three pages when editing
// this file (netlify.toml serves it with immutable caching).
(function () {
  'use strict';

  // ----- waitlist forms -----
  document.querySelectorAll('.waitlist-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var success = document.getElementById(form.getAttribute('data-success'));
      var errorEl = document.getElementById(form.getAttribute('data-error'));
      var emailEl = form.querySelector('input[type="email"]');
      var email = (emailEl.value || '').trim();
      if (!email) return;
      // honeypot — bots fill hidden fields
      if (form.querySelector('input[name="website"]').value) return;

      if (errorEl) errorEl.hidden = true;
      var btn = form.querySelector('button[type="submit"]');
      var original = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Joining…';

      fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        form.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        if (window.gripplyConsent && window.gripplyConsent.granted() && typeof window.gtag === 'function') {
          window.gtag('event', 'waitlist_signup', {
            form_location: form.getAttribute('data-location') || 'unknown'
          });
        }
      }).catch(function () {
        btn.disabled = false;
        btn.innerHTML = original;
        if (errorEl) {
          errorEl.textContent = 'Something went wrong — please try again.';
          errorEl.hidden = false;
        }
      });
    });
  });

  // ----- mobile menu -----
  document.querySelectorAll('.nav-menu').forEach(function (menu) {
    menu.querySelectorAll('.nav-menu__link').forEach(function (link) {
      link.addEventListener('click', function () { menu.removeAttribute('open'); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.hasAttribute('open')) {
        menu.removeAttribute('open');
        var button = menu.querySelector('.nav-menu__button');
        if (button) button.focus();
      }
    });
  });
})();
