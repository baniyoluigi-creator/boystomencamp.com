document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
    });
    nav.querySelectorAll(':scope > a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
    nav.querySelectorAll('.dropdown-menu a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  // Dropdown: click-to-toggle on mobile/touch, hover handles desktop via CSS
  document.querySelectorAll('.dropdown-trigger').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      if (window.innerWidth <= 1220) {
        e.preventDefault();
        trigger.closest('.has-dropdown').classList.toggle('mobile-open');
      }
    });
  });

  // Voice tabs (used on Why Enrol Now, Partner With Us, Apply, Learning Resources)
  document.querySelectorAll('.voice-tabs').forEach(function (tabGroup) {
    var target = tabGroup.getAttribute('data-target');
    var panels = document.querySelectorAll('#' + target + ' .voice-panel');
    var buttons = tabGroup.querySelectorAll('.voice-tab');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        panels.forEach(function (pnl) { pnl.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.getElementById(btn.getAttribute('data-panel'));
        if (panel) panel.classList.add('active');
        if (typeof updateApplySubject === 'function') updateApplySubject();
      });
    });
  });

  /* ---------------------------------------------------------------
     Apply form: program type, conditional fields, dynamic subject
     --------------------------------------------------------------- */
  var applyForm = document.getElementById('applyForm');
  if (applyForm) {
    var ageField = document.getElementById('age');
    var locationField = document.getElementById('location');
    var whereFromField = document.getElementById('whereFrom');
      var subjectField = document.getElementById('subjectField');
    var feeDisplay = document.getElementById('feeDisplay');

    var LOCAL_FEES = {
      'Kampala': 'Kampala fee: UGX 500,000 or USD 150. Booking fee to secure his place: UGX 50,000 (part of the fee, non-refundable).',
      'Arua': 'Arua fee: UGX 400,000 or USD 120. Booking fee to secure his place: UGX 50,000 (part of the fee, non-refundable).'
    };
    var SUMMER_FEE = 'Summer Camp fee: USD 300 (covers the full 8-day camp). A UGX equivalent can be arranged on request at time of payment. Booking fee to secure his place: USD 50 (part of the fee, non-refundable).';

    var UGANDA_DISTRICTS = ["Kampala","Wakiso","Mukono","Jinja","Mbale","Mbarara","Gulu","Arua","Lira","Soroti","Kabale","Kabarole (Fort Portal)","Masaka","Hoima","Masindi","Kasese","Iganga","Tororo","Kitgum","Pader","Moyo","Adjumani","Nebbi","Zombo","Yumbe","Koboko","Maracha","Pakwach","Buliisa","Kiryandongo","Kayunga","Luwero","Nakasongola","Kiboga","Mityana","Mubende","Sembabule","Rakai","Kalangala","Bushenyi","Ntungamo","Kanungu","Kisoro","Rukungiri","Ibanda","Kiruhura","Isingiro","Buhweju","Rubirizi","Sheema","Mitooma","Bundibugyo","Ntoroko","Kyenjojo","Kyegegwa","Kamwenge","Bulambuli","Sironko","Kapchorwa","Kween","Bukwo","Manafwa","Namisindwa","Budaka","Butaleja","Busia","Bugiri","Namayingo","Mayuge","Kamuli","Kaliro","Buyende","Luuka","Namutumba","Pallisa","Kibuku","Butebo","Ngora","Serere","Kumi","Bukedea","Amuria","Katakwi","Napak","Moroto","Nakapiripirit","Amudat","Kotido","Kaabong","Abim","Agago","Amuru","Nwoya","Omoro","Lamwo","Otuke","Alebtong","Dokolo","Amolatar","Apac","Oyam","Kole","Kwania","Buikwe","Buvuma","Kalungu","Lyantonde","Lwengo","Bukomansimbi","Gomba","Other"];

    var COUNTRIES = ["Afghanistan","Albania","Algeria","Angola","Argentina","Australia","Austria","Bahrain","Bangladesh","Belgium","Botswana","Brazil","Burundi","Cameroon","Canada","Chad","China","Congo (DRC)","Denmark","Egypt","Ethiopia","Finland","France","Germany","Ghana","Greece","India","Indonesia","Ireland","Israel","Italy","Japan","Jordan","Kenya","Kuwait","Lesotho","Malawi","Malaysia","Mexico","Morocco","Mozambique","Namibia","Netherlands","New Zealand","Niger","Nigeria","Norway","Oman","Pakistan","Philippines","Portugal","Qatar","Rwanda","Saudi Arabia","Singapore","Somalia","South Africa","South Sudan","Spain","Sudan","Sweden","Switzerland","Tanzania","Thailand","Turkey","Uganda (elsewhere)","Ukraine","United Arab Emirates","United Kingdom","United States","Zambia","Zimbabwe","Other"];

    function populateSelect(id, list) {
      var el = document.getElementById(id);
      if (!el) return;
      list.forEach(function (name) {
        var opt = document.createElement('option');
        opt.textContent = name;
        el.appendChild(opt);
      });
    }
    window.B2M_LISTS = { districts: UGANDA_DISTRICTS, countries: COUNTRIES };
    populateSelect('district', UGANDA_DISTRICTS);
    populateSelect('country2', COUNTRIES);

    window.updateApplySubject = function () {
      if (!subjectField) return;
      var locRaw = locationField ? locationField.value : '';
      var locName = locRaw.split(' \u2014')[0].trim();
      var age = ageField ? ageField.value : '';
      if (locName.indexOf('Summer Camp') === 0) {
        subjectField.value = 'New Registration: Boys to Men Summer Camp (July 2027, 8 days)';
        if (feeDisplay) feeDisplay.textContent = SUMMER_FEE;
      } else {
        subjectField.value = 'New Registration: Boys to Men ' + (locName || 'Location TBC') + ' \u2014 Age ' + (age || 'TBC');
        if (feeDisplay) feeDisplay.textContent = LOCAL_FEES[locName] || 'Select an intake above to see the exact fee.';
      }
    };

    function fieldValue(name) {
      var el = document.getElementById(name);
      if (!el) return '';
      return el.value;
    }

    function evaluateConditionals() {
      var activePanel = document.querySelector('#program-panels .voice-panel.active');
      var activeTab = activePanel ? activePanel.id : '';

      document.querySelectorAll('.conditional-field').forEach(function (el) {
        var wantTab = el.getAttribute('data-cond-tab');
        var wantField = el.getAttribute('data-cond-field');
        var wantValue = el.getAttribute('data-cond-value');

        var tabOK = !wantTab || wantTab === activeTab;
        var fieldOK = true;
        if (wantField && wantValue) {
          var values = wantValue.split(',');
          var current = fieldValue(wantField);
          fieldOK = values.indexOf(current) !== -1;
        }
        if (tabOK && fieldOK) { el.classList.add('show'); } else { el.classList.remove('show'); }
      });
      updateApplySubject();
    }

    document.querySelectorAll('#program-panels-tabs .voice-tab').forEach(function (btn) {
      btn.addEventListener('click', evaluateConditionals);
    });
    if (locationField) locationField.addEventListener('change', evaluateConditionals);
    if (ageField) ageField.addEventListener('change', updateApplySubject);
    if (whereFromField) whereFromField.addEventListener('change', evaluateConditionals);
    var paidStatusField = document.getElementById('paidStatus');
    if (paidStatusField) paidStatusField.addEventListener('change', evaluateConditionals);

    evaluateConditionals();
  }

  // Deep-linking: if the URL hash points at a tab panel (e.g. support.html#panel-mentor),
  // activate the right tab and scroll to it, instead of landing on a hidden panel.
  if (window.location.hash) {
    var targetId = window.location.hash.slice(1);
    var targetPanel = document.getElementById(targetId);
    if (targetPanel && targetPanel.classList.contains('voice-panel')) {
      var ownerTabs = document.querySelector('.voice-tabs[data-target="' + targetPanel.parentElement.id + '"]');
      if (ownerTabs) {
        var matchingBtn = ownerTabs.querySelector('[data-panel="' + targetId + '"]');
        if (matchingBtn) {
          matchingBtn.click();
          setTimeout(function () { ownerTabs.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        }
      }
    }
  }

  // Homepage hero: rotate background photos with a gentle crossfade
  var heroLayers = document.querySelectorAll('#homeHero .hero-bg-layer');
  if (heroLayers.length > 1) {
    var heroIndex = 0;
    setInterval(function () {
      heroLayers[heroIndex].classList.remove('is-active');
      heroIndex = (heroIndex + 1) % heroLayers.length;
      heroLayers[heroIndex].classList.add('is-active');
    }, 3000);
  }

  // Paid-first route: ?paid=1 or the "Paid already" links tick Yes under the booking fee.
  function markPaid() {
    var ps = document.getElementById('paidStatus');
    if (!ps) return;
    ps.value = 'Yes (I have paid)';
    if (ps.tagName === 'SELECT') {
      ps.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      window.b2mPaidPreset = true;
      window.dispatchEvent(new Event('b2m:paid'));
    }
  }
  if (/[?&]paid=1/.test(window.location.search)) {
    markPaid();
    var f0 = document.getElementById('applyForm');
    if (f0) setTimeout(function () { f0.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);
  }
  document.querySelectorAll('[data-paid-yes]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      markPaid();
      var f1 = document.getElementById('applyForm');
      if (f1) { e.preventDefault(); f1.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // Per-camp "Apply for This Intake" buttons: pre-select the location
  // in the shared form and scroll the person straight to it.
  document.querySelectorAll('[data-select-location]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var loc = document.getElementById('location');
      var form = document.getElementById('applyForm');
      if (loc) {
        loc.value = btn.getAttribute('data-select-location');
        loc.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof window.updateApplySubject === 'function') window.updateApplySubject();
      if (form) {
        e.preventDefault();
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});

/* ---------------------------------------------------------------
   Floating WhatsApp contact button (appears on every page while
   scrolling, so emerging interest can be captured instantly)
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  if (document.querySelector('.wa-float')) return; // avoid duplicates

  var waNumber = '256775495431'; // +256 775 495 431, international format, no leading +
  var waMessage = "Hello Boys to Men Mentorship Camp, I'd like to find out more.";
  var waLink = document.createElement('a');
  waLink.href = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(waMessage);
  waLink.className = 'wa-float';
  waLink.target = '_blank';
  waLink.rel = 'noopener';
  waLink.setAttribute('aria-label', 'Chat with us on WhatsApp');
  waLink.innerHTML = '<svg viewBox="0 0 32 32" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.362.687 4.564 1.872 6.417L4 29l7.77-1.84A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.75c-1.98 0-3.86-.53-5.48-1.46l-.393-.23-4.61 1.09 1.12-4.49-.256-.406A9.71 9.71 0 0 1 5.75 15c0-5.652 4.6-10.25 10.254-10.25 5.652 0 10.246 4.598 10.246 10.25 0 5.653-4.594 10.25-10.246 10.25zm5.63-7.66c-.308-.155-1.82-.898-2.102-1-.282-.103-.487-.155-.692.155-.205.31-.795 1-.975 1.205-.18.206-.36.232-.667.078-.308-.155-1.3-.48-2.475-1.53-.915-.816-1.533-1.824-1.713-2.132-.18-.31-.02-.477.135-.63.138-.138.308-.36.462-.54.154-.18.205-.31.308-.516.103-.206.052-.386-.026-.541-.077-.155-.692-1.67-.949-2.287-.25-.6-.505-.518-.692-.528-.18-.008-.386-.01-.59-.01-.206 0-.542.078-.826.386-.283.31-1.082 1.058-1.082 2.58 0 1.522 1.108 2.993 1.262 3.2.154.206 2.18 3.33 5.284 4.67.738.319 1.314.51 1.763.652.741.236 1.415.203 1.948.123.594-.089 1.82-.744 2.076-1.463.257-.72.257-1.335.18-1.463-.077-.128-.283-.206-.59-.36z"/></svg>';

  var tooltip = document.createElement('span');
  tooltip.className = 'wa-float-tooltip';
  tooltip.textContent = 'Chat with us on WhatsApp';

  document.body.appendChild(waLink);
  document.body.appendChild(tooltip);
});

/* ---------------------------------------------------------------
   Registration form spam guard: a hidden trap field (_gotcha) and a
   minimum fill time. Real people take more than a few seconds to
   complete the form; scripts do not. Blocked submissions never
   reach Formspree, so they do not use up the monthly limit.
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('applyForm');
  if (!form) return;
  var openedAt = Date.now();
  var stamp = document.getElementById('formOpenedAt');
  if (stamp) stamp.value = new Date(openedAt).toISOString();
  form.addEventListener('submit', function (e) {
    var trap = form.querySelector('input[name="_gotcha"]');
    var tooFast = (Date.now() - openedAt) < 8000;
    if ((trap && trap.value) || tooFast) {
      e.preventDefault();
      if (tooFast && !(trap && trap.value)) {
        alert('Please take a moment to check your details, then press Submit again.');
        openedAt = Date.now() - 8000;
      }
    }
  });
});

/* ---------------------------------------------------------------
   Form delivery: Google Sheet (no monthly limit)
   Paste the Google Apps Script web app link between the quotes below.
   While it is empty, the forms keep using Formspree as before.
   --------------------------------------------------------------- */
var SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz4TA60MMwRowFJujLeX_JA_v81z8s4cZI5kKACdZQ01kZDLO1ocpqF6EOyFMQp8XGY/exec';

// Optional proof of payment upload on the Apply form.
// Keep this false until the updated Google script has been published
// (see form-backend/UPDATE-SCRIPT-FOR-PROOF-OF-PAYMENT.txt). The
// transaction ID box works whether this is true or false.
var PROOF_UPLOAD_ENABLED = false;

/* ---------------------------------------------------------------
   How to pay guide: tabs and copy buttons.
   Used on the Apply page after submitting, and on pay.html
   --------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.htp').forEach(function (root) {
    var tabs = root.querySelectorAll('.htp-tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
        t.setAttribute('aria-selected', 'true');
        root.querySelectorAll('.htp-panel').forEach(function (p) { p.hidden = true; });
        var panel = root.querySelector('#htp-' + t.getAttribute('data-tab'));
        if (panel) panel.hidden = false;
      });
    });
    root.querySelectorAll('.htp-copy').forEach(function (b) {
      b.addEventListener('click', function () {
        var source = root.querySelector('#' + b.getAttribute('data-copy'));
        if (!source) return;
        var text = source.textContent.trim();
        var ok = function () {
          b.textContent = 'Copied'; b.classList.add('done');
          setTimeout(function () { b.textContent = 'Copy'; b.classList.remove('done'); }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok, function () {});
        } else {
          var a = document.createElement('textarea');
          a.value = text; document.body.appendChild(a); a.select();
          try { document.execCommand('copy'); ok(); } catch (err) {}
          document.body.removeChild(a);
        }
      });
    });
  });

  if (PROOF_UPLOAD_ENABLED) {
    var proofWrap = document.getElementById('proofWrap');
    if (proofWrap) proofWrap.hidden = false;
  }
});

// Reads the optional proof of payment file. Screenshots are shrunk first so
// they send quickly on mobile data. Resolves null when nothing is attached.
function readProof() {
  return new Promise(function (resolve, reject) {
    if (!PROOF_UPLOAD_ENABLED) return resolve(null);
    var input = document.getElementById('proofFile');
    var file = input && input.files && input.files[0];
    if (!file) return resolve(null);
    var reader = new FileReader();
    reader.onerror = function () { reject('We could not read that file. Please try another one, or send your proof on WhatsApp.'); };
    if (file.type === 'application/pdf') {
      if (file.size > 2 * 1024 * 1024) return reject('That PDF is too large. Please attach a screenshot instead, or send the PDF on WhatsApp.');
      reader.onload = function () {
        resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] });
      };
      reader.readAsDataURL(file);
    } else if (file.type.indexOf('image/') === 0) {
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject('We could not read that picture. Please try another one, or send your proof on WhatsApp.'); };
        img.onload = function () {
          var ratio = Math.min(1, 1400 / Math.max(img.width, img.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          var url = canvas.toDataURL('image/jpeg', 0.72);
          resolve({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: url.split(',')[1] });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      reject('Please attach a screenshot or a PDF.');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (!SHEET_ENDPOINT) return;

  ['applyForm', 'contactForm'].forEach(function (id) {
    var form = document.getElementById(id);
    if (!form) return;

    form.addEventListener('submit', function (e) {
      // The spam guard above may already have stopped this submission.
      if (e.defaultPrevented) return;
      e.preventDefault();

      var button = form.querySelector('button[type="submit"]');
      var buttonText = button ? button.innerHTML : '';
      if (button) { button.disabled = true; button.textContent = 'Sending...'; }

      var data = new FormData(form);
      var body = new URLSearchParams();
      data.forEach(function (value, key) { body.append(key, value); });
      body.append('_page', location.pathname);

      var proofStep = id === 'applyForm' ? readProof() : Promise.resolve(null);
      proofStep
        .then(function (proof) {
          if (proof) {
            body.append('Proof File Name', proof.name);
            body.append('Proof File Type', proof.type);
            body.append('Proof File Data', proof.data);
          }
          return fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body: body });
        })
        .then(function () {
          if (window.b2mClearDraft) window.b2mClearDraft();
          var box = document.createElement('div');
          box.className = 'card card-gold';
          box.setAttribute('role', 'status');
          var paid = (data.get('Booking Fee Paid') || '').indexOf('Yes') === 0;
          var boys = parseInt(data.get('Number Of Boys'), 10) || 1;
          var his = boys > 1 ? 'their places' : 'his place';
          if (id === 'applyForm') {
            var head = boys > 1
              ? '<h3>Thank you. Your registration for ' + boys + ' boys has been received.</h3>'
              : '<h3>Thank you. Your registration has been received.</h3>';
            box.innerHTML = paid
              ? head + '<p>We have noted your payment and will confirm ' + his + ' within 24 hours. If you still have a balance to pay, the details are below.</p>'
              : head + '<p>One more step to secure ' + his + '. Pay the booking fee using the details below, then send us your proof of payment. We will confirm ' + his + ' within 24 hours of receiving it.</p>';
          } else {
            box.innerHTML = '<h3>Thank you. Your message has been received.</h3><p>We will get back to you as soon as we can. For anything urgent, chat with us on WhatsApp using the green button on this page.</p>';
          }
          form.parentNode.replaceChild(box, form);

          if (id === 'applyForm') {
            // After registering, show only the thank-you and the payment steps.
            ['preSubmit', 'wizIntro'].forEach(function (x) { var n = document.getElementById(x); if (n) n.hidden = true; });
            var h1 = document.querySelector('.page-head h1'); if (h1) h1.textContent = 'Registration received';
            var lede = document.querySelector('.page-head .lede'); if (lede) lede.textContent = 'Thank you. Here is what happens next.';
            var names = [];
            for (var k = 1; k <= boys; k++) { var nm = (data.get('Boy ' + k + ' Name') || '').trim(); if (nm) names.push(nm.replace(/[<>&"]/g, '')); }
            if (names.length) {
              var list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
              var firstH = box.querySelector('h3'); if (firstH) firstH.textContent = 'Thank you. We have received the registration of ' + list + '.';
            }
          }

          if (id === 'applyForm') {
            // Always offer the WhatsApp group link. Those already in it can share it with the other parent.
            var answers = [];
            data.forEach(function (v, k) { if (/WhatsApp Group$/.test(k) && v) answers.push(v); });
            var allIn = answers.length > 0 && answers.every(function (a) { return a.indexOf('Yes') === 0; });
            var wa = document.createElement('p');
            wa.style.marginTop = '14px';
            wa.innerHTML = '<a class="htp-btn htp-btn-wa" style="display:inline-block;" target="_blank" rel="noopener" href="https://chat.whatsapp.com/FS8ZutpkQDC4DTMvh5pBPc">Join the Boys to Men WhatsApp group</a><br><small class="muted">' +
              (allIn ? 'Already in the group? Share this link with the other parent or guardian so they can ask to join.' : 'Tap to ask to join. We approve each request, so it may take a little time.') + '</small>';
            box.appendChild(wa);
          }

          var panel = document.getElementById('payPanel');
          if (id === 'applyForm' && panel) {
            var total = data.get('Booking Fee Total') || '';
            var loc = data.get('Location') || '';
            var text = document.getElementById('htp-booking-text');
            if (text && total) {
              text.textContent = total + ' secures ' + his + '. It counts toward the total fee and is non-refundable.';
            } else if (text && loc) {
              text.textContent = loc.indexOf('Summer Camp') === 0
                ? 'USD 50 secures his place at the Summer Camp. It counts toward the total fee and is non-refundable.'
                : 'UGX 50,000 secures his place. It counts toward the total fee and is non-refundable.';
            }
            var bk = document.querySelector('.htp-booking b');
            if (bk && boys > 1) bk.textContent = 'Booking fee to secure their places';
            var heading = document.getElementById('payHeading');
            if (heading && paid) heading.textContent = 'Paying the balance';
            else if (heading && boys > 1) heading.textContent = 'Pay the booking fee to secure their places';
            var fullPaid = data.get('How Much Paid So Far') === 'Paid in full';
            if (fullPaid) {
              box.querySelector('p').textContent = 'We have noted your payment of the full camp fee and will confirm ' + his + ' within 24 hours. There is nothing more to pay.';
            }
            panel.hidden = fullPaid;
            var more = document.createElement('div');
            more.className = 'card';
            more.style.marginTop = '24px';
            more.innerHTML = '<h3>Registering more boys?</h3><p class="muted">Another son, a nephew, or a boy from another family. It takes only a few minutes.</p><p><a class="btn btn-gold" href="apply.html">Register another boy or family</a></p>';
            panel.parentNode.insertBefore(more, panel.nextSibling);
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch(function (err) {
          if (button) { button.disabled = false; button.innerHTML = buttonText; }
          alert(typeof err === 'string' ? err : 'Sorry, your details could not be sent. Please check your internet connection and try again, or message us on WhatsApp.');
        });
    });
  });
});
