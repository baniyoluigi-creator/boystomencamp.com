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
      'Kampala': 'Kampala fee: UGX 500,000 or USD 150.',
      'Arua': 'Arua fee: UGX 400,000 or USD 120.'
    };
    var SUMMER_FEE = 'Diaspora Summer Camp fee: USD 300 (covers the full 8-day camp). A UGX equivalent can be arranged on request at time of payment.';

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
    populateSelect('district', UGANDA_DISTRICTS);
    populateSelect('country2', COUNTRIES);

    window.updateApplySubject = function () {
      if (!subjectField) return;
      var activePanel = document.querySelector('#program-panels .voice-panel.active');
      var type = activePanel ? activePanel.id : '';
      if (type === 'panel-local') {
        var locRaw = locationField ? locationField.value : '';
        var locName = locRaw.split(' \u2014')[0].trim();
        var age = ageField ? ageField.value : '';
        subjectField.value = 'New Registration: Boys to Men ' + (locName || 'Location TBC') + ' \u2014 Age ' + (age || 'TBC');
        if (feeDisplay) feeDisplay.textContent = LOCAL_FEES[locName] || 'Select a location above to see the exact fee.';
      } else if (type === 'panel-summer') {
        subjectField.value = 'New Registration: Boys to Men Diaspora Summer Camp (July 2027, 8 days)';
        if (feeDisplay) feeDisplay.textContent = SUMMER_FEE;
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
    if (locationField) locationField.addEventListener('change', updateApplySubject);
    if (ageField) ageField.addEventListener('change', updateApplySubject);
    if (whereFromField) whereFromField.addEventListener('change', evaluateConditionals);

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
