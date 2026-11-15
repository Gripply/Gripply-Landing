// Gripply landing — waitlist forms + mobile menu.
// Referenced as /site.js?v=N — bump N in every page when editing
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
  // The full-screen panel slides in from the right when the menu opens and back out when it
  // closes. This script runs both slides (Web Animations API): a <details> hides its content
  // the moment it closes, so CSS alone can't slide it out, and Chrome doesn't restart a CSS
  // animation on content a closed <details> has hidden, so a CSS-only slide-in plays on the
  // first open only. Without this script the stylesheet's slide-in runs (in Chrome, on the
  // first open only) and closing is instant. No slides under reduced motion.
  var SLIDE_MS = 320;
  var SLIDE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  var IN = '0px';
  var OUT = '100%';   // the panel's own width, whatever it is when the slide ends (the phone may rotate)
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('.nav-menu').forEach(function (menu) {
    var button = menu.querySelector('.nav-menu__button');
    var panel = menu.querySelector('.nav-menu__panel');
    if (!button || !panel) return;
    var links = menu.querySelectorAll('.nav-menu__link');
    var slide = null;
    menu.classList.add('nav-menu--scripted');   // the stylesheet leaves the slides to this script

    function isClosing() { return menu.classList.contains('nav-menu--closing'); }

    // the panel's current offset in px: 0 is fully in, its width is fully out
    function offset() {
      var m = /matrix\(([^)]+)\)/.exec(getComputedStyle(panel).transform);
      return m ? parseFloat(m[1].split(',')[4]) || 0 : 0;
    }

    function stop() {
      if (slide) { slide.onfinish = null; slide.cancel(); slide = null; }
    }

    // The menu links can't be tapped or focused while the panel slides out. Only the links:
    // an inert panel would let taps on it fall through to the page it still covers.
    function linksInert(on) {
      for (var i = 0; i < links.length; i++) links[i].inert = on;
    }

    // Slide from `from` to `to` (IN or OUT), or from wherever an unfinished slide has got to
    // (tapping again mid-slide turns it around, over the distance left), then call done.
    function slideTo(from, to, done) {
      var share = 1;   // the share of the panel's width still to travel
      if (slide) {
        var width = panel.offsetWidth || window.innerWidth;
        var x = Math.min(Math.max(offset(), 0), width);
        from = x + 'px';
        share = (to === OUT ? width - x : x) / width;
      }
      stop();
      if (typeof panel.animate !== 'function' || reducedMotion.matches || share <= 0) {
        if (done) done();
        return;
      }
      slide = panel.animate(
        [{ transform: 'translateX(' + from + ')' }, { transform: 'translateX(' + to + ')' }],
        { duration: SLIDE_MS * share, easing: SLIDE_EASE, fill: 'forwards' }
      );
      slide.onfinish = function () {
        if (done) done();
        stop();
      };
    }

    function open() {
      menu.classList.remove('nav-menu--closing');
      linksInert(false);
      menu.open = true;
      slideTo(OUT, IN);
    }

    function close() {
      if (!menu.open || isClosing()) return;
      menu.classList.add('nav-menu--closing');   // the X turns back into bars and the page shows again as the panel leaves
      linksInert(true);
      slideTo(IN, OUT, closed);
    }

    function closed() {
      menu.open = false;
      menu.classList.remove('nav-menu--closing');
      linksInert(false);
    }

    button.addEventListener('click', function (e) {
      e.preventDefault();   // this script opens and closes the <details> itself
      if (menu.open && !isClosing()) close();
      else open();
    });
    for (var i = 0; i < links.length; i++) links[i].addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open && !isClosing()) {
        close();
        button.focus();
      }
    });
    // closed some other way (not by this script): drop any slide state
    menu.addEventListener('toggle', function () {
      if (!menu.open) {
        stop();
        menu.classList.remove('nav-menu--closing');
        linksInert(false);
      }
    });
    // a page restored from the back/forward cache (after a menu link was tapped) shows the menu closed
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && menu.open) {
        stop();
        closed();
      }
    });
  });
})();
