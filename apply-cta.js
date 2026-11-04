/* Boys to Men Mentorship Camp
   Keeps the Apply page one tap away on every page of the site.
   1. A floating Apply Now button beside the WhatsApp button
   2. A short Apply card in the middle of each parent guide
   3. An Apply band at the end of any page that does not already finish with one
   Nothing is added on the Apply, payment, proof of payment and error pages. */
(function () {
  var path = location.pathname.replace(/\/+$/, '');
  var skip = ['/apply.html', '/apply', '/attach-proof.html', '/pay.html', '/404.html'];
  if (skip.indexOf(path) !== -1) return;
  if (document.getElementById('applyForm')) return;

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

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var footer = document.querySelector('footer');

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
