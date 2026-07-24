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

  // Voice tabs (used on Why Enrol Now, Partner With Us, Learning Resources)
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
      });
    });
  });
});
