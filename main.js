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
      if (window.innerWidth <= 1040) {
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

    var LOCAL_FEE = 'Local intake fee: contact us for current pricing by region.';
    var SUMMER_FEE = 'Diaspora Summer Camp fee: UGX 990,000 or USD 250 (covers the full 9-day camp).';

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
      var activePanel = applyForm.querySelector('.voice-panel.active');
      var type = activePanel ? activePanel.id : '';
      if (type === 'panel-local') {
        var loc = locationField ? locationField.value : '';
        var age = ageField ? ageField.value : '';
        subjectField.value = 'New Application: Boys to Men ' + (loc || 'Location TBC') + ' \u2014 Age ' + (age || 'TBC');
        if (feeDisplay) feeDisplay.textContent = LOCAL_FEE;
      } else if (type === 'panel-summer') {
        subjectField.value = 'New Application: Boys to Men Diaspora Summer Camp (July, 9 days)';
        if (feeDisplay) feeDisplay.textContent = SUMMER_FEE;
      }
    };

    function evaluateConditionals() {
      var activePanel = applyForm.querySelector('.voice-panel.active');
      var activeTab = activePanel ? activePanel.id : '';
      var whereFromVal = whereFromField ? whereFromField.value : '';

      document.querySelectorAll('.conditional-field').forEach(function (el) {
        var wantTab = el.getAttribute('data-cond-tab');
        var wantField = el.getAttribute('data-cond-field');
        var wantValue = el.getAttribute('data-cond-value');

        var tabOK = !wantTab || wantTab === activeTab;
        var fieldOK = true;
        if (wantField && wantValue) {
          var values = wantValue.split(',');
          var current = wantField === 'whereFrom' ? whereFromVal : '';
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
});
