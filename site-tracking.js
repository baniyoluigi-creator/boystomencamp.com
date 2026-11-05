/* Boys to Men Mentorship Camp
   Visitor analytics and the WhatsApp call-back question.

   1. Google Analytics 4. Paste the Measurement ID below (it starts with G-).
      While GA_ID is empty, nothing is sent anywhere.
   2. Event tracking for WhatsApp taps, the call-back question, Apply clicks
      and finished forms, so the numbers can guide future ad campaigns.
   3. The call-back question. When someone taps the green WhatsApp button, a small
      box asks if they would like to leave a name and WhatsApp number so the team can
      reach out later, or open WhatsApp straight away. Details go to the same
      Google Sheet as the forms, in a tab called "WhatsApp Callbacks".

   Keep CALLBACK_ENABLED false until the Google script has been updated
   (see form-backend/UPDATE-SCRIPT-FOR-WHATSAPP-CALLBACKS.txt). */
(function () {
  'use strict';

  /* ---------- Settings ---------- */
  var GA_ID = '';                    // example: 'G-ABC123XYZ9'
  var CALLBACK_ENABLED = false;      // switch to true after the Google script is updated
  var SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz4TA60MMwRowFJujLeX_JA_v81z8s4cZI5kKACdZQ01kZDLO1ocpqF6EOyFMQp8XGY/exec';

  /* ---------- Small helpers ---------- */
  function store(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function pageLabel() {
    var t = (document.title || '').split('|')[0].replace(/\s+/g, ' ').trim();
    return t || location.pathname;
  }

  /* ---------- 1. Google Analytics 4 ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (GA_ID) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { allow_google_signals: true, allow_ad_personalization_signals: true });
  }
  function track(name, params) {
    if (!GA_ID) return;
    try { gtag('event', name, params || {}); } catch (e) {}
  }
  window.b2mTrack = track;

  /* Remember where the visitor came from, so a call-back can be traced to its source. */
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
        if (q.get(k) && !store('b2m_' + k)) store('b2m_' + k, q.get(k));
      });
      if (!store('b2m_ref') && document.referrer && document.referrer.indexOf(location.hostname) === -1) {
        store('b2m_ref', document.referrer);
      }
    } catch (e) {}
  })();

  /* ---------- 2. Event tracking ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (a.classList.contains('wa-float')) {
      track('whatsapp_tap', { page: pageLabel() });
      return;
    }
    if (/(^|\/)apply\.html/.test(href)) {
      var where = 'other';
      if (a.classList.contains('b2m-fab')) where = 'floating_button';
      else if (a.closest('.main-nav, header')) where = 'menu';
      else if (a.closest('.b2m-inline')) where = 'guide_card';
      else if (a.closest('.b2m-band')) where = 'page_end_band';
      else if (a.closest('footer')) where = 'footer';
      track('apply_click', { location: where, page: pageLabel() });
    }
  }, true);

  /* Count a form as finished when the page swaps it for the thank-you box. */
  document.addEventListener('DOMContentLoaded', function () {
    ['applyForm', 'contactForm'].forEach(function (id) {
      var form = document.getElementById(id);
      if (!form || !form.parentNode || !window.MutationObserver) return;
      if (form.getAttribute('data-b2m-watched')) return;
      form.setAttribute('data-b2m-watched', '1');
      var mo = new MutationObserver(function () {
        if (!document.getElementById(id)) {
          mo.disconnect();
          track('generate_lead', { form_id: id, page: pageLabel() });
        }
      });
      mo.observe(form.parentNode, { childList: true });
    });
  });

  /* ---------- 3. WhatsApp call-back question ---------- */
  if (!CALLBACK_ENABLED) return;

  var css = '' +
    '.b2m-cb-back{position:fixed;inset:0;z-index:1000;background:rgba(15,46,29,.62);display:flex;align-items:center;justify-content:center;padding:16px;' +
    'font-family:"Source Sans 3","Segoe UI",sans-serif}' +
    '.b2m-cb-box{position:relative;background:#fff;max-width:440px;width:100%;border-radius:16px;padding:26px 24px 22px;box-shadow:0 18px 50px rgba(0,0,0,.35);max-height:92vh;overflow:auto}' +
    '.b2m-cb-x{position:absolute;top:8px;right:12px;background:none;border:0;font-size:1.7rem;line-height:1;color:#5b655d;cursor:pointer;padding:6px}' +
    '.b2m-cb-box h2{margin:0 26px 10px 0;font-size:1.25rem;line-height:1.3;color:#153A24}' +
    '.b2m-cb-box p{margin:0 0 16px;color:#3C453D;font-size:1rem;line-height:1.55}' +
    '.b2m-cb-wa{display:block;text-align:center;background:#25D366;color:#0b2e17;font-weight:800;font-size:1.08rem;text-decoration:none;padding:15px 18px;border-radius:999px;margin-bottom:12px}' +
    '.b2m-cb-wa:hover{background:#1fbd5b}' +
    '.b2m-cb-yes{display:block;width:100%;text-align:center;background:#fff;color:#153A24;font-weight:700;font-size:1rem;padding:12px 16px;border-radius:999px;border:2px solid #153A24;cursor:pointer}' +
    '.b2m-cb-yes:hover{background:#EEF4EE}' +
    '.b2m-cb-form label{display:block;font-weight:700;color:#153A24;font-size:.95rem;margin:0 0 4px}' +
    '.b2m-cb-form input[type=text],.b2m-cb-form input[type=tel]{width:100%;box-sizing:border-box;font-size:1rem;padding:11px 12px;border:1px solid #b9c4ba;border-radius:8px;margin-bottom:12px;font-family:inherit}' +
    '.b2m-cb-form .b2m-cb-consent{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:.9rem;color:#3C453D;line-height:1.45;margin-bottom:14px}' +
    '.b2m-cb-form .b2m-cb-consent input{margin-top:3px}' +
    '.b2m-cb-send{display:block;width:100%;background:#CC9A2E;color:#0F2E1D;font-weight:800;font-size:1.05rem;padding:13px 16px;border-radius:999px;border:0;cursor:pointer}' +
    '.b2m-cb-send:disabled{opacity:.6;cursor:default}' +
    '.b2m-cb-err{color:#a12a1f;font-size:.92rem;margin:-4px 0 10px;min-height:1px}' +
    '.b2m-cb-hp{position:absolute!important;left:-9999px!important;height:0;width:0;opacity:0}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var lastFocus = null;

  function closeBox() {
    var back = document.getElementById('b2mCbBack');
    if (back) back.parentNode.removeChild(back);
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function onKey(e) { if (e.key === 'Escape') closeBox(); }

  function openBox(waHref) {
    if (document.getElementById('b2mCbBack')) return;
    lastFocus = document.activeElement;
    track('callback_popup_open', { page: pageLabel() });

    var back = document.createElement('div');
    back.className = 'b2m-cb-back';
    back.id = 'b2mCbBack';
    back.innerHTML =
      '<div class="b2m-cb-box" role="dialog" aria-modal="true" aria-labelledby="b2mCbTitle">' +
        '<button type="button" class="b2m-cb-x" aria-label="Close">&times;</button>' +
        '<div id="b2mCbStep1">' +
          '<h2 id="b2mCbTitle">Would you like us to reach out to you later?</h2>' +
          '<p>You can leave your name and WhatsApp number, and someone from our team will contact you. Or you can chat with us right now.</p>' +
          '<a class="b2m-cb-wa" id="b2mCbWa" target="_blank" rel="noopener" href="' + waHref.replace(/"/g, '&quot;') + '">No thanks, open WhatsApp now</a>' +
          '<button type="button" class="b2m-cb-yes" id="b2mCbYes">Yes, ask the team to contact me</button>' +
        '</div>' +
        '<form class="b2m-cb-form" id="b2mCbForm" hidden novalidate>' +
          '<h2>Leave your details</h2>' +
          '<p>Our team will contact you on WhatsApp as soon as they can.</p>' +
          '<label for="b2mCbName">Your name</label>' +
          '<input type="text" id="b2mCbName" autocomplete="name" maxlength="80">' +
          '<label for="b2mCbPhone">Your WhatsApp number</label>' +
          '<input type="tel" id="b2mCbPhone" autocomplete="tel" inputmode="tel" placeholder="e.g. 0775 123 456" maxlength="25">' +
          '<input type="text" class="b2m-cb-hp" id="b2mCbHp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<label class="b2m-cb-consent"><input type="checkbox" id="b2mCbOk"> <span>I agree that the Boys to Men team may keep my name and number and contact me about the camp. They will not share them with anyone else.</span></label>' +
          '<div class="b2m-cb-err" id="b2mCbErr" role="alert"></div>' +
          '<button type="submit" class="b2m-cb-send" id="b2mCbSend">Send my details</button>' +
        '</form>' +
        '<div id="b2mCbDone" hidden>' +
          '<h2>Thank you</h2>' +
          '<p>We have your details. Someone from the Boys to Men team will contact you on WhatsApp soon.</p>' +
          '<a class="b2m-cb-wa" target="_blank" rel="noopener" href="' + waHref.replace(/"/g, '&quot;') + '">Chat with us on WhatsApp now</a>' +
        '</div>' +
      '</div>';
    document.body.appendChild(back);
    document.addEventListener('keydown', onKey);

    var $ = function (id) { return document.getElementById(id); };

    back.addEventListener('click', function (e) { if (e.target === back) closeBox(); });
    back.querySelector('.b2m-cb-x').addEventListener('click', closeBox);

    $('b2mCbWa').addEventListener('click', function () {
      store('b2m_cb_seen', '1');
      track('callback_choice', { choice: 'open_whatsapp', page: pageLabel() });
      setTimeout(closeBox, 150);
    });

    $('b2mCbYes').addEventListener('click', function () {
      track('callback_choice', { choice: 'leave_details', page: pageLabel() });
      $('b2mCbStep1').hidden = true;
      $('b2mCbForm').hidden = false;
      $('b2mCbName').focus();
    });

    $('b2mCbForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('b2mCbName').value.replace(/\s+/g, ' ').trim();
      var phone = $('b2mCbPhone').value.trim();
      var digits = phone.replace(/\D/g, '');
      var err = $('b2mCbErr');
      err.textContent = '';
      if (!name) { err.textContent = 'Please type your name.'; $('b2mCbName').focus(); return; }
      if (digits.length < 9 || digits.length > 15) { err.textContent = 'Please type a WhatsApp number we can reach.'; $('b2mCbPhone').focus(); return; }
      if (!$('b2mCbOk').checked) { err.textContent = 'Please tick the box so we may contact you.'; return; }

      var btn = $('b2mCbSend');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      var body = new URLSearchParams();
      body.append('_form', 'callback');
      body.append('_page', location.pathname);
      body.append('_gotcha', $('b2mCbHp').value);
      body.append('Name', name);
      body.append('WhatsApp Number', phone);
      body.append('Consent To Contact', 'Yes');
      body.append('Page Title', pageLabel());
      body.append('Came From', store('b2m_ref') || 'Direct or unknown');
      body.append('Campaign Source', store('b2m_utm_source') || '');
      body.append('Campaign Medium', store('b2m_utm_medium') || '');
      body.append('Campaign Name', store('b2m_utm_campaign') || '');

      fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body: body, keepalive: true })
        .then(function () {
          store('b2m_cb_seen', '1');
          track('callback_submitted', { page: pageLabel() });
          $('b2mCbForm').hidden = true;
          $('b2mCbDone').hidden = false;
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Send my details';
          err.textContent = 'Sorry, we could not send your details. Please check your internet and try again, or open WhatsApp.';
        });
    });
  }

  /* Catch the tap on the floating WhatsApp button before it opens WhatsApp. */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a.wa-float') : null;
    if (!a) return;
    if (store('b2m_cb_seen')) return;          // already asked once in this visit, go straight to WhatsApp
    e.preventDefault();
    e.stopImmediatePropagation();
    openBox(a.href);
  }, true);
})();
