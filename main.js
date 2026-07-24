document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

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
    var programType = document.getElementById('programType'); // 'local' or 'diaspora-summer'
    var locationField = document.getElementById('location');
    var ageBandField = document.getElementById('ageBand');
    var subjectField = document.getElementById('subjectField');
    var feeDisplay = document.getElementById('feeDisplay');

    var LOCAL_FEE = 'Local intake fee: contact us for current pricing by region.';
    var SUMMER_FEE = 'Diaspora Summer Camp fee: UGX 990,000 or USD 250 (covers the full 9-day camp).';

    window.updateApplySubject = function () {
      if (!subjectField) return;
      var activePanel = applyForm.querySelector('.voice-panel.active');
      var type = activePanel ? activePanel.id : '';
      if (type === 'panel-local') {
        var loc = locationField ? locationField.value : '';
        var band = ageBandField ? ageBandField.value : '';
        subjectField.value = 'New Application: Boys to Men ' + (loc || 'Location TBC') + ' \u2014 ' + (band || 'Age Band TBC');
        if (feeDisplay) feeDisplay.textContent = LOCAL_FEE;
      } else if (type === 'panel-summer') {
        subjectField.value = 'New Application: Boys to Men Diaspora Summer Camp (July, 9 days)';
        if (feeDisplay) feeDisplay.textContent = SUMMER_FEE;
      }
    };

    document.querySelectorAll('.conditional-field').forEach(function (el) { el.classList.remove('show'); });

    function syncConditionalFields() {
      var activePanel = applyForm.querySelector('.voice-panel.active');
      var type = activePanel ? activePanel.id : '';
      document.querySelectorAll('.conditional-field').forEach(function (el) {
        var showFor = el.getAttribute('data-show-when');
        if (showFor === type) { el.classList.add('show'); } else { el.classList.remove('show'); }
      });
      updateApplySubject();
    }

    document.querySelectorAll('#program-panels-tabs .voice-tab').forEach(function (btn) {
      btn.addEventListener('click', syncConditionalFields);
    });
    if (locationField) locationField.addEventListener('change', updateApplySubject);
    if (ageBandField) ageBandField.addEventListener('change', updateApplySubject);

    syncConditionalFields();
  }
});
