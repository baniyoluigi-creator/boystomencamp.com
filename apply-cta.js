/* Boys to Men Mentorship Camp
   Keeps the Apply page one tap away on every page of the site.
   1. A floating Apply Now button beside the WhatsApp button
   2. A short Apply card in the middle of each parent guide
   3. An Apply band at the end of any page that does not already finish with one
   4. The floating WhatsApp button, with a message that tells us the person came from the website
   The Apply button, card and band are not added on the Apply, payment, proof of payment and error pages. */
(function () {
  var path = location.pathname.replace(/\/+$/, '');
  var skip = ['/apply.html', '/apply', '/attach-proof.html', '/pay.html', '/404.html'];
  var onSkip = skip.indexOf(path) !== -1 || !!document.getElementById('applyForm');

  var APPLY = '/apply.html';

  var css = '' +
    '.b2m-fab{position:fixed;right:20px;bottom:26px;z-index:998;background:#CC9A2E;color:#0F2E1D;' +
    'font-family:"Source Sans 3","Segoe UI",sans-serif;font-weight:800;font-size:1.02rem;line-height:1;' +
    'text-decoration:none;padding:14px 22px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.28);' +
    'transition:transform .18s ease,box-shadow .18s ease,background .18s ease}' +
    '.b2m-fab:hover{background:#E0B44C;transform:scale(1.06);box-shadow:0 8px 22px rgba(0,0,0,.34)}' +
    'body.b2m-has-fab .wa-float-tooltip{display:none!important}' +
    '@media(max-width:640px){.b2m-fab{right:14px;bottom:17px;padding:13px 18px;font-size:.98rem}}' +
    '.b2m-inline{max-width:680px;margin:34px auto;padding:22px 24px;border-radius:12px;background:#FBF2D9;' +
    'border-left:6px solid #CC9A2E;font-family:"Source Sans 3","Segoe UI",sans-serif;clear:both}' +
    '.b2m-inline strong{display:block;font-size:1.2rem;color:#153A24;margin-bottom:6px;line-height:1.3}' +
    '.b2m-inline p{margin:0 0 14px;color:#3C453D;font-size:1rem;line-height:1.55}' +
    '.b2m-inline a{display:inline-block;background:#153A24;color:#fff;font-weight:800;text-decoration:none;' +
    'padding:11px 22px;border-radius:999px}' +
    '.b2m-inline a:hover{background:#B3801F;color:#0F2E1D}' +
    '.b2m-band{background:linear-gradient(135deg,#0F2E1D 0%,#2E7248 100%);color:#fff;text-align:center;' +
    'padding:48px 20px;font-family:"Source Sans 3","Segoe UI",sans-serif}' +
    '.b2m-band h2{color:#fff;margin:0 0 10px;font-size:clamp(1.4rem,4vw,2rem);line-height:1.25}' +
    '.b2m-band p{max-width:560px;margin:0 auto 22px;color:#DCE9DD;font-size:1.05rem;line-height:1.55}' +
    '.b2m-band a{display:inline-block;background:#CC9A2E;color:#0F2E1D;font-weight:800;text-decoration:none;' +
    'padding:14px 30px;border-radius:999px;font-size:1.05rem}' +
    '.b2m-band a:hover{background:#E0B44C}';

  var waCss = '' +
    '.wa-float{position:fixed;right:20px;bottom:20px;z-index:999;width:58px;height:58px;border-radius:50%;' +
    'background:#25D366;box-shadow:0 6px 18px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;' +
    'transition:transform .18s ease,box-shadow .18s ease;text-decoration:none}' +
    '.wa-float:hover{transform:scale(1.08);box-shadow:0 8px 22px rgba(0,0,0,.34)}' +
    '.wa-float svg{width:30px;height:30px;display:block}' +
    '@media(max-width:640px){.wa-float{right:14px;bottom:14px;width:52px;height:52px}' +
    '.wa-float svg{width:27px;height:27px}}';
  css += waCss;

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var footer = document.querySelector('footer');

    /* 0. WhatsApp button. The message names the website and the page, so we know where the chat came from. */
    var pageName = function () {
      if (path === '' || path === '/index.html') return 'the Home page';
      var t = (document.title || '').split('|')[0].replace(/\s+/g, ' ').trim();
      if (!t) return 'one of your pages';
      if (t.length > 60) t = t.slice(0, 57).trim() + '...';
      return path.indexOf('/blog/') === 0 || document.querySelector('.article-body')
        ? 'your guide "' + t + '"' : 'the ' + t + ' page';
    };
    var wa = document.querySelector('.wa-float');
    if (!wa) {
      wa = document.createElement('a');
      wa.className = 'wa-float';
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.setAttribute('aria-label', 'Chat with us on WhatsApp');
      wa.innerHTML = '<svg viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.362.687 4.564 1.872 6.417L4 29l7.77-1.84A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.75c-1.98 0-3.86-.53-5.48-1.46l-.393-.23-4.61 1.09 1.12-4.49-.256-.406A9.71 9.71 0 0 1 5.75 15c0-5.652 4.6-10.25 10.254-10.25 5.652 0 10.246 4.598 10.246 10.25 0 5.653-4.594 10.25-10.246 10.25zm5.63-7.66c-.308-.155-1.82-.898-2.102-1-.282-.103-.487-.155-.692.155-.205.31-.795 1-.975 1.205-.18.206-.36.232-.667.078-.308-.155-1.3-.48-2.475-1.53-.915-.816-1.533-1.824-1.713-2.132-.18-.31-.02-.477.135-.63.138-.138.308-.36.462-.54.154-.18.205-.31.308-.516.103-.206.052-.386-.026-.541-.077-.155-.692-1.67-.949-2.287-.25-.6-.505-.518-.692-.528-.18-.008-.386-.01-.59-.01-.206 0-.542.078-.826.386-.283.31-1.082 1.058-1.082 2.58 0 1.522 1.108 2.993 1.262 3.2.154.206 2.18 3.33 5.284 4.67.738.319 1.314.51 1.763.652.741.236 1.415.203 1.948.123.594-.089 1.82-.744 2.076-1.463.257-.72.257-1.335.18-1.463-.077-.128-.283-.206-.59-.36z"/></svg>';
      document.body.appendChild(wa);
    }
    var waMessage = 'Hello Boys-to-Men Mentorship Camp team, I have been going through your website (boystomencamp.com, ' +
      pageName() + ') and ';
    wa.href = 'https://wa.me/256775495431?text=' + encodeURIComponent(waMessage);

    if (onSkip) return;

    /* 1. Floating Apply button, beside the WhatsApp button */
    var fab = document.createElement('a');
    fab.className = 'b2m-fab';
    fab.href = APPLY;
    fab.textContent = 'Apply Now';
    fab.setAttribute('aria-label', 'Apply to the Boys to Men Mentorship Camp');
    document.body.appendChild(fab);
    document.body.classList.add('b2m-has-fab');
    /* WhatsApp moves to the left of Apply, so Apply sits in the natural thumb spot */
    var place = function () {
      var wa = document.querySelector('.wa-float');
      if (!wa) return;
      var small = window.innerWidth <= 640;
      var gap = small ? 10 : 12;
      var edge = small ? 14 : 20;
      wa.style.setProperty('right', (edge + fab.offsetWidth + gap) + 'px', 'important');
    };
    place();
    window.addEventListener('load', function () { setTimeout(place, 500); });
    window.addEventListener('resize', place);

    /* 2. Middle of a parent guide */
    var body = document.querySelector('.article-body');
    if (body && !body.querySelector('.b2m-inline')) {
      var paras = [];
      for (var i = 0; i < body.children.length; i++) {
        if (body.children[i].tagName === 'P') paras.push(body.children[i]);
      }
      if (paras.length >= 5) {
        var at = paras[Math.ceil(paras.length / 2) - 1];
        var card = document.createElement('div');
        card.className = 'b2m-inline';
        card.innerHTML = '<strong>Is your son ready for the camp?</strong>' +
          '<p>Apply now and our team will call you within 48 hours to answer your questions and guide you through the next steps.</p>' +
          '<a href="' + APPLY + '">Apply Now</a>';
        at.parentNode.insertBefore(card, at.nextSibling);
      }
    }

    /* 3. End of page */
    if (!footer || body || document.querySelector('.cta-band')) return;
    var before = footer.previousElementSibling;
    var tail = [];
    var holder = (before && before.tagName === 'MAIN') ? before : footer.parentNode;
    var kids = holder.children;
    for (var k = kids.length - 1; k >= 0 && tail.length < 3; k--) {
      if (kids[k].tagName !== 'SCRIPT' && kids[k].tagName !== 'STYLE' && kids[k] !== footer) tail.push(kids[k]);
    }
    for (var j = 0; j < tail.length; j++) {
      if (tail[j].querySelector && tail[j].querySelector('a[href*="apply"]') &&
          (tail[j].className + '').match(/cta|green-gradient|band|banner/)) return;
    }
    var band = document.createElement('section');
    band.className = 'b2m-band';
    band.innerHTML = '<h2>Ready to enrol your son?</h2>' +
      '<p>Apply now and our team will call you within 48 hours to answer your questions and guide you through the next steps.</p>' +
      '<a href="' + APPLY + '">Apply Now</a>';
    footer.parentNode.insertBefore(band, footer);
  });
})();
