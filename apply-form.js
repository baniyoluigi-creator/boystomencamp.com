/* Boys to Men registration wizard
   Parent or guardian first, then one boy at a time, then payment and review.
   Sends flat fields to the Google Apps Script, which saves one row per boy. */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('applyForm');
  if (!form || !form.classList.contains('wiz')) return;

  var PREVIEW = !!window.B2M_PREVIEW;
  var LISTS = window.B2M_LISTS || { districts: [], countries: [] };

  var CAMPS = [
    { value: 'Kampala — 13–19 Dec 2026 — UGX 500,000 / USD 150', name: 'Kampala', dates: '13 to 19 December 2026', fee: 'UGX 500,000 or USD 150', cur: 'UGX', book: 50000 },
    { value: 'Arua — 10–16 Jan 2027 — UGX 400,000 / USD 120', name: 'Arua', dates: '10 to 16 January 2027', fee: 'UGX 400,000 or USD 120', cur: 'UGX', book: 50000 },
    { value: 'Summer Camp — Kampala — 7–16 Jul 2027 — USD 300', name: 'Summer Camp, Kampala', dates: '7 to 16 July 2027', fee: 'USD 300', cur: 'USD', book: 50 }
  ];
  var RELATIONS = ['Father', 'Mother', 'Guardian', 'Other'];
  var HELPER_ROLES = ['Relative', 'Friend', 'Mentor', 'Someone else'];
  var GROUP = ['Yes, I am already in the group', 'No, please add me', 'Not sure, please check'];
  var OTHER_GROUP = ['Yes, already in the group', 'No, please add them', 'Not sure, please check'];
  var OUTCOMES = [
    ['Knows who he is', 'He discovers who he truly is, including his values, purpose, gifts and talents, beyond what others have said about him or labelled him'],
    ['Loves learning and does better at school', 'He grows more focused at school, performs better, and builds a lasting love and commitment to education and to learning in its widest sense'],
    ['Breaks free from destructive habits', 'He breaks free from destructive habits, addictions and patterns that have been controlling him, including bad peer groups and harmful screen use'],
    ['Finds healing and overcomes limiting beliefs', 'He finds healing for emotional wounds he has never had space or language to name, and overcomes the limiting beliefs that hold him back'],
    ['Builds a vision', 'He builds a clear vision for his life and writes a plan he owns and works towards after the camp'],
    ['Financial literacy and entrepreneurship', 'He grows in financial literacy, learns to manage money well, and develops the mindset and skills of an entrepreneur who can create opportunities, either immediately or in the future'],
    ['Confident and manages anger', 'He becomes confident in who he is as a young man, without being told who to be, and learns to manage his anger well'],
    ['Communicates, leads and respects', 'He learns to communicate, lead and carry himself with respect and maturity, including in the way he relates to girls and women'],
    ['Finds brotherhood and mentors', 'He leaves with a brotherhood of peers and mentors who hold him to the best version of himself'],
    ['Healthy manhood and force for good', 'He understands what healthy manhood looks like and grows in appreciation for his family, community, nation and Africa, choosing to rise as a force for good']
  ];

  var OUTCOMES_SELF = ["You discover who you truly are, including your values, purpose, gifts and talents, beyond what others have said about you or labelled you", "You grow more focused at school, perform better, and build a lasting love and commitment to education and to learning in its widest sense", "You break free from destructive habits, addictions and patterns that have been controlling you, including bad peer groups and harmful screen use", "You find healing for emotional wounds you have never had space or language to name, and overcome the limiting beliefs that hold you back", "You build a clear vision for your life and write a plan you own and work towards after the camp", "You grow in financial literacy, learn to manage money well, and develop the mindset and skills of an entrepreneur who can create opportunities, either immediately or in the future", "You become confident in who you are as a young man, without being told who to be, and learn to manage your anger well", "You learn to communicate, lead and carry yourself with respect and maturity, including in the way you relate to girls and women", "You leave with a brotherhood of peers and mentors who hold you to the best version of yourself", "You understand what healthy manhood looks like and grow in appreciation for your family, community, nation and Africa, choosing to rise as a force for good"];

  /* ---------- small helpers ---------- */
  var uidN = 0;
  function uid() { uidN += 1; return 'w' + uidN; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || form).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || form).querySelectorAll(sel)); }
  function val(name) { var el = form.elements[name]; if (!el) return ''; if (el.length !== undefined && !el.tagName) { var v = ''; for (var i = 0; i < el.length; i++) { if (el[i].checked) v = el[i].value; } return v; } return el.value || ''; }
  function checkedVal(name) { var c = $('input[name="' + name + '"]:checked'); return c ? c.value : ''; }

  function textField(name, label, o) {
    o = o || {}; var id = uid();
    return '<div class="field"><label for="' + id + '">' + label + (o.req ? ' *' : (o.optTag === false ? '' : ' <span class="lbl-opt">(optional)</span>')) + '</label>' +
      '<input id="' + id + '" name="' + name + '" type="' + (o.type || 'text') + '"' + (o.req ? ' required' : '') +
      (o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') +
      (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.dataFrom ? ' data-from="' + o.dataFrom + '"' : '') + '>' +
      (o.hint ? '<p class="hint">' + o.hint + '</p>' : '') + '</div>';
  }
  function radioCards(name, label, options, o) {
    o = o || {};
    var html = '<fieldset class="fs"' + (o.req ? ' data-required' : '') + '><legend class="lg">' + label + (o.req ? ' *' : '') + '</legend>';
    if (o.chips) {
      html += '<div class="chips' + (o.cls ? ' ' + o.cls : '') + '">' + options.map(function (op) {
        return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(op) + '"><span>' + esc(op) + '</span></label>';
      }).join('') + '</div>';
    } else {
      html += '<div class="opt-grid' + (o.one ? ' one' : '') + '">' + options.map(function (op) {
        var v = typeof op === 'string' ? op : op.value, t = typeof op === 'string' ? op : op.title, s = typeof op === 'string' ? '' : (op.sub || ''), f = typeof op === 'string' ? '' : (op.fee || '');
        return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(v) + '"><span class="opt-box">' + esc(t) + (s ? '<small>' + esc(s) + '</small>' : '') + (f ? '<span class="opt-fee">' + esc(f) + '</span>' : '') + '</span></label>';
      }).join('') + '</div>';
    }
    return html + '</fieldset>';
  }
  function selectField(name, label, options, o) {
    o = o || {}; var id = uid();
    return '<div class="field"><label for="' + id + '">' + label + (o.req ? ' *' : '') + '</label><select id="' + id + '" name="' + name + '"' + (o.req ? ' required' : '') + '><option value="">' + (o.placeholder || 'Choose one') + '</option>' +
      options.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></div>';
  }

  /* Parent or guardian block. prefix is "Parent" or "Boy 3 Parent".
     When fromRegistrant is true the name, phone and email come from page 1. */
  function parentBlock(prefix, o) {
    o = o || {};
    var h = '<div class="wiz-stack">';
    if (o.fromRegistrant) {
      h += '<input type="hidden" name="' + prefix + ' Name" data-from="reg-name">' +
           '<input type="hidden" name="' + prefix + ' Phone" data-from="reg-phone">' +
           '<input type="hidden" name="' + prefix + ' Phone On WhatsApp" data-from="reg-wa">' +
           '<input type="hidden" name="' + prefix + ' Email" data-from="reg-email">';
    } else {
      h += textField(prefix + ' Name', 'Full name of the parent or guardian', { req: true, auto: o.auto ? 'name' : 'off' });
      h += '<div class="field-row">' +
           textField(prefix + ' Phone', 'Phone number', { req: true, type: 'tel', kind: 'phone', inputmode: 'tel', auto: o.auto ? 'tel' : 'off', ph: 'e.g. 0775 123 456' }) +
           textField(prefix + ' Email', 'Email address', { type: 'email', kind: 'email', auto: o.auto ? 'email' : 'off' }) + '</div>';
      h += '<label class="check-row mini-check"><input type="checkbox" name="' + prefix + ' Phone On WhatsApp" value="Yes" checked> This number is on WhatsApp</label>';
    }
    h += radioCards(prefix + ' Relationship', 'Relationship to the boy', RELATIONS, { chips: true, req: true });
    h += whereBlock(prefix);
    h += radioCards(prefix + ' WhatsApp Group', 'Are you already in the Boys to Men parents’ WhatsApp group?', GROUP, { req: true, one: true });
    h += '<div class="cond wa-num" hidden data-wa-for="' + prefix + ' WhatsApp Group">' +
         textField(prefix + ' WhatsApp Number To Add', 'WhatsApp number to add <span class="lbl-opt">(only if different from the phone number above)</span>', { type: 'tel', kind: 'phone', inputmode: 'tel', ph: 'e.g. 0775 123 456', optTag: false }) + '</div>';
    return h + '</div>';
  }
  /* Optional parent or guardian details for a young man registering himself */
  function selfParentBlock() {
    return '<div class="wiz-stack">' +
      textField('Parent Name', 'Full name of your parent or guardian', { auto: 'off' }) +
      '<div class="field-row">' + textField('Parent Phone', 'Their phone number', { type: 'tel', kind: 'phone', inputmode: 'tel', ph: 'e.g. 0775 123 456' }) + '<div></div></div>' +
      '<label class="check-row mini-check"><input type="checkbox" name="Parent Phone On WhatsApp" value="Yes" checked> This number is on WhatsApp</label>' +
      radioCards('Parent Relationship', 'Who are they to you?', RELATIONS, { chips: true }) + '</div>';
  }
  function whereBlock(prefix) {
    return '<div class="where" data-prefix="' + prefix + '">' +
      radioCards(prefix + ' Applying From', 'Where does the family live?', ['Based in Uganda', 'Based elsewhere in Africa', 'Diaspora'], { chips: true, req: true }) +
      '<div class="where-d cond" hidden style="margin-top:14px;">' + selectField(prefix + ' District', 'District', LISTS.districts, { req: true, placeholder: 'Choose district' }) + '</div>' +
      '<div class="where-c cond" hidden style="margin-top:14px;">' + selectField(prefix + ' Country', 'Country', LISTS.countries, { req: true, placeholder: 'Choose country' }) + '</div></div>';
  }

  /* ---------- elements ---------- */
  var body = $('#wizBody');
  var scYou = $('#sc-you'), scCount = $('#sc-count'), scParent = $('#sc-parent'), scPay = $('#sc-pay'), scReview = $('#sc-review');
  var btnBack = $('#wizBack'), btnNext = $('#wizNext'), btnSubmit = $('#wizSubmit');
  var fill = $('#wizFill'), lblSection = $('#wizSection'), lblCount = $('#wizCount');

  $('#parentMountParent').innerHTML = parentBlock('Parent', { fromRegistrant: true });
  $('#parentMountHelper').innerHTML = parentBlock('Parent', { auto: false });
  $('#parentMountSelf').innerHTML = selfParentBlock();
  $('#otherParentMount').innerHTML =
    '<div class="wiz-stack">' +
    textField('Other Parent Name', 'Full name') +
    '<div class="field-row">' + textField('Other Parent Phone', 'Phone number', { type: 'tel', kind: 'phone', inputmode: 'tel', ph: 'e.g. 0775 123 456' }) + '<div></div></div>' +
    '<label class="check-row mini-check"><input type="checkbox" name="Other Parent Phone On WhatsApp" value="Yes" checked> This number is on WhatsApp</label>' +
    radioCards('Other Parent Relationship', 'Relationship to the boy', RELATIONS, { chips: true }) +
    radioCards('Other Parent WhatsApp Group', 'Are they already in the parents’ WhatsApp group?', OTHER_GROUP, { one: true }) +
    '</div>';

  /* ---------- state ---------- */
  var boyEls = [];
  var defaultCamp = '';
  var cur = 0;
  var list = [];

  function mode() {
    var v = checkedVal('Registered By');
    if (v === 'Parent or guardian') return 'parent';
    if (v === 'Helping to register him') return 'helper';
    if (v === 'The young man himself') return 'self';
    return '';
  }
  function count() { var n = parseInt(val('Number Of Boys'), 10); return n > 0 ? n : 0; }
  function diffParents() { return mode() === 'helper' && count() > 1 && checkedVal('Same Parent For All') === 'No'; }
  function needParentStep() { var m = mode(); return m === 'parent' || m === 'self' || (m === 'helper' && !diffParents()); }

  /* ---------- boy pages ---------- */
  function makeBoy(i) {
    var n = i + 1, p = 'Boy ' + n + ' ';
    var sec = document.createElement('section');
    sec.className = 'wiz-screen'; sec.hidden = true; sec.setAttribute('data-screen', 'boy'); sec.setAttribute('data-i', i);
    var camps = CAMPS.map(function (c) { return { value: c.value, title: c.name, sub: c.dates, fee: 'Fee ' + c.fee }; });
    var ages = []; for (var a = 8; a <= 23; a++) ages.push(String(a));
    var html =
      '<div class="boy-head"><span class="boy-badge">' + n + '</span><div><h3 class="boy-title">Boy ' + n + '</h3><p class="boy-sub"></p></div></div>' +
      (n > 1 ? '<button type="button" class="copy-prev" data-copy-prev="' + i + '">↺ Copy camp and changes from Boy ' + (n - 1) + '</button>' : '') +
      '<div class="wiz-stack">' +
      textField(p + 'Name', '<span class="lbl-name">His full name</span>', { req: true, optTag: false, auto: 'off' }) +
      '<div><fieldset class="fs" data-required><legend class="lg"><span class="sw" data-he="His age" data-you="Your age">His age</span> *</legend><div class="chips ages">' +
      ages.map(function (x) { return '<label class="chip"><input type="radio" name="' + p + 'Age" value="' + x + '"><span>' + x + '</span></label>'; }).join('') +
      '</div></fieldset><p class="age-note" aria-live="polite"></p></div>' +
      radioCards(p + 'Camp', '<span class="sw" data-he="Which camp is he joining?" data-you="Which camp are you joining?">Which camp is he joining?</span>', camps, { req: true, one: true }) +
      '<div class="phone-block"><fieldset class="fs"><legend class="lg">How can we reach him? <span class="opt-tag">(optional, but it helps us prepare him before camp)</span></legend>' +
      '<div class="opt-grid one">' +
      '<label class="opt"><input type="radio" name="' + p + 'Phone Type" value="His own phone"><span class="opt-box">He has his own phone</span></label>' +
      '<label class="opt"><input type="radio" name="' + p + 'Phone Type" value="A family member’s phone"><span class="opt-box">He uses a family member’s phone</span></label>' +
      '<label class="opt"><input type="radio" name="' + p + 'Phone Type" value="No phone, call the parent"><span class="opt-box">He has no phone, please call the parent</span></label>' +
      '</div></fieldset>' +
      '<div class="cond phone-num" hidden style="margin-top:14px;">' + textField(p + 'Phone', 'A number we can use to speak to him', { type: 'tel', kind: 'phone', inputmode: 'tel', ph: 'e.g. 0775 123 456', hint: 'We may call him to welcome him and prepare him for camp.' }) + '</div></div>' +
      '<div><fieldset class="fs"><legend class="lg"><span class="sw" data-he="What change do you hope camp will bring in him?" data-you="What change do you hope camp will bring in you?">What change do you hope camp will bring in him?</span> <span class="opt-tag">(tick all that fit)</span></legend><div class="outcomes">' +
      OUTCOMES.map(function (o, k) { return '<label class="check-row outcome-row"><input type="checkbox" name="' + p + 'Desired Outcome" value="' + esc(o[0]) + '"> <span class="sw" data-he="' + esc(o[1]) + '" data-you="' + esc(OUTCOMES_SELF[k]) + '">' + esc(o[1]) + '</span></label>'; }).join('') +
      '</div></fieldset></div>' +
      '<div class="field"><label for="' + uid() + '"><span class="sw" data-he="Tell us about him in your own words" data-you="Tell us about yourself in your own words">Tell us about him in your own words</span> <span class="lbl-opt">(optional)</span></label>' +
      '<textarea name="' + p + 'About Him" rows="4" placeholder="His character, his struggles, his strengths, anything that will help his mentors know him."></textarea></div>' +
      '<div class="boy-parent cond" hidden><hr class="sect-line"><p class="sect-title">His parent or guardian</p>' +
      '<p class="hint" style="margin:0 0 14px;">Please give the details of the parent or guardian responsible for this boy.</p>' +
      '<div class="parent-card">' + parentBlock('Boy ' + n + ' Parent', {}) + '</div></div>' +
      '</div>';
    sec.innerHTML = html;
    // match the label to the textarea for assistive tech
    var ta = sec.querySelector('textarea'), lb = ta.parentNode.querySelector('label'); ta.id = lb.getAttribute('for');
    return sec;
  }
  function setCount(n) {
    while (boyEls.length < n) {
      var el = makeBoy(boyEls.length);
      body.insertBefore(el, scPay);
      boyEls.push(el);
      if (boyEls.length > 1) { inheritFromFirst(el); } else if (defaultCamp) { pickCamp(el, defaultCamp); }
    }
    while (boyEls.length > n) { var gone = boyEls.pop(); gone.parentNode.removeChild(gone); }
  }
  function pickCamp(el, value) { var r = $$('input[type="radio"]', el).filter(function (x) { return /Camp$/.test(x.name) && x.value === value; })[0]; if (r) r.checked = true; }
  function inheritFromFirst(el) {
    var first = boyEls[0], r = $$('input[type="radio"]:checked', first).filter(function (x) { return /Camp$/.test(x.name); })[0];
    if (r) pickCamp(el, r.value);
  }
  function copyPrev(i) {
    var prev = boyEls[i - 1], el = boyEls[i]; if (!prev || !el) return;
    var c = $$('input[type="radio"]:checked', prev).filter(function (x) { return /Camp$/.test(x.name); })[0];
    if (c) pickCamp(el, c.value);
    var ticked = $$('input[type="checkbox"]', prev).filter(function (x) { return /Desired Outcome$/.test(x.name); });
    var targets = $$('input[type="checkbox"]', el).filter(function (x) { return /Desired Outcome$/.test(x.name); });
    ticked.forEach(function (t, k) { targets[k].checked = t.checked; });
    sync();
  }

  /* ---------- screen list and navigation ---------- */
  function screens() {
    var l = [scYou];
    if (mode() !== 'self') l.push(scCount);
    if (needParentStep()) l.push(scParent);
    boyEls.forEach(function (b) { l.push(b); });
    l.push(scPay, scReview);
    return l;
  }
  function sectionName(el) {
    if (el === scYou) return 'About you';
    if (el === scCount) return 'Your boys';
    if (el === scParent) return 'Parent or guardian';
    if (el === scPay) return 'Payment';
    if (el === scReview) return 'Review';
    if (boyEls.length === 1) return mode() === 'self' ? 'Your details' : 'About him';
    return 'Boy ' + (parseInt(el.getAttribute('data-i'), 10) + 1) + ' of ' + boyEls.length;
  }
  function show(idx, noScroll) {
    list = screens();
    if (idx < 0) idx = 0; if (idx > list.length - 1) idx = list.length - 1;
    cur = idx;
    [scYou, scCount, scParent, scPay, scReview].concat(boyEls).forEach(function (s) { s.hidden = true; });
    list[cur].hidden = false;
    var n = list.length;
    lblSection.textContent = sectionName(list[cur]);
    lblCount.textContent = n <= 12 ? 'Step ' + (cur + 1) + ' of ' + n : Math.round((cur / (n - 1)) * 100) + '% done';
    fill.style.width = Math.max(6, Math.round((cur / (n - 1)) * 100)) + '%';
    btnBack.hidden = cur === 0;
    var last = cur === n - 1;
    btnNext.hidden = last; btnSubmit.hidden = !last;
    refreshLabels(); sync();
    if (list[cur] === scReview) renderReview();
    if (list[cur] === scPay) sendPartial('Reached payment');
    queueSave();
    if (!noScroll) {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var f = list[cur].querySelector('input:not([type=hidden]):not([disabled]),select,textarea');
      if (f && !/radio|checkbox/.test(f.type)) { setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }, 350); }
    }
  }
  function next() {
    var bad = validate(list[cur]); if (bad) { focusBad(bad); return; }
    if (list[cur] === scYou) sendPartial('Finished page 1');
    show(cur + 1);
  }
  function back() { show(cur - 1); }

  function refreshLabels() {
    var m = mode(), n = count();
    var titleP = $('#parentTitle'), subP = $('#parentSub');
    $('#otherParentSummary').textContent = m === 'self' ? 'Add a second parent or guardian (optional)' : 'Add the other parent or guardian (optional)';
    if (m === 'self') {
      titleP.textContent = 'Your parent or guardian';
      subP.textContent = 'If you have a father, mother or guardian, please give us their name and number so we can reach them when needed. You can leave this empty and continue.';
    } else if (m === 'parent') {
      titleP.textContent = 'Your details as parent or guardian';
      subP.textContent = 'We already have your name and number from the first page. Just a few more details.';
    } else {
      titleP.textContent = n > 1 ? 'The parent or guardian responsible for the boys' : 'The parent or guardian responsible for the boy';
      subP.textContent = 'Please give the details of the parent or guardian, not your own. This is the person our team will speak to about him.';
    }
    $('#parentMountParent').hidden = m !== 'parent';
    $('#parentMountHelper').hidden = m !== 'helper';
    $('#parentMountSelf').hidden = m !== 'self';
    $('#selfWaWrap').hidden = m !== 'self';
    var sg = checkedVal('Registrant WhatsApp Group');
    $('#selfWaNum').hidden = !(sg && !/^Yes/.test(sg));
    $$('.wa-num').forEach(function (w) {
      var g = checkedVal(w.getAttribute('data-wa-for'));
      w.hidden = !(g && !/^Yes/.test(g));
    });
    var ct = $('#consentText');
    if (ct) ct.textContent = m === 'self'
      ? 'I confirm these details are correct.'
      : 'I confirm these details are correct.';
    $('#youFields').hidden = !m;
    $('#helperRole').hidden = m !== 'helper';
    $('#sameParentWrap').hidden = !(m === 'helper' && n > 1);
    $('#whoPaysWrap').hidden = m !== 'helper';
    $('#youSub').textContent = m === 'self' ? 'Tell us how to reach you. This is the number and email we will use.' : 'Your details first, so we know who is registering.';
    boyEls.forEach(function (el, i) {
      var t = $('.boy-title', el); t.textContent = boyEls.length > 1 ? 'Boy ' + (i + 1) + ' of ' + boyEls.length : (m === 'self' ? 'About you' : 'About the boy');
      var s = $('.boy-sub', el);
      s.textContent = m === 'self' ? 'A few details about you.' : (boyEls.length > 1 ? 'Details for boy number ' + (i + 1) + '.' : 'A few details about him.');
      $('.lbl-name', el).textContent = m === 'self' ? 'Your full name' : (m === 'parent' ? 'Your son’s full name' : 'His full name');
      $('.boy-parent', el).hidden = !diffParents();
      var ph = $('.phone-block', el); ph.hidden = (m === 'self');
      $$('.sw', el).forEach(function (x) { x.textContent = m === 'self' ? x.getAttribute('data-you') : x.getAttribute('data-he'); });
      var ta = $('textarea', el); ta.placeholder = m === 'self' ? 'Your character, your struggles, your strengths, anything that will help your mentors know you.' : 'His character, his struggles, his strengths, anything that will help his mentors know him.';
    });
    var anySummer = boyEls.some(function (el) { return /^Summer/.test(campOf(el)); });
    $('#summerWrap').hidden = !anySummer;
    var paid = checkedVal('How Much Paid So Far');
    $('#paidDetails').hidden = !(paid && paid !== 'Nothing yet');
  }
  function campOf(el) { var r = $$('input[type="radio"]:checked', el).filter(function (x) { return /Camp$/.test(x.name); })[0]; return r ? r.value : ''; }
  function campInfo(v) { return CAMPS.filter(function (c) { return c.value === v; })[0]; }

  /* ---------- keep hidden and copied fields in step ---------- */
  function feeText() {
    var ugx = 0, usd = 0;
    boyEls.forEach(function (el) { var c = campInfo(campOf(el)); if (!c) return; if (c.cur === 'USD') usd += c.book; else ugx += c.book; });
    var parts = []; if (ugx) parts.push('UGX ' + ugx.toLocaleString('en-US')); if (usd) parts.push('USD ' + usd);
    return parts.join(' and ');
  }
  function sync() {
    refreshLabels();
    // copy page 1 details into the parent proxies
    var map = { 'reg-name': 'Registrant Name', 'reg-phone': 'Registrant Phone', 'reg-email': 'Registrant Email' };
    $$('[data-from]').forEach(function (el) {
      var f = el.getAttribute('data-from');
      if (f === 'reg-wa') { var c = $('input[name="Registrant Phone On WhatsApp"]'); el.value = c && c.checked ? 'Yes' : 'No'; }
      else if (map[f]) { var s = form.elements[map[f]]; el.value = s ? s.value : ''; }
    });
    // young man registering himself: his phone is the registrant phone
    if (mode() === 'self' && boyEls[0]) {
      var pn = form.elements['Boy 1 Phone']; if (pn) pn.value = val('Registrant Phone');
      var own = $('input[name="Boy 1 Phone Type"][value="His own phone"]'); if (own) own.checked = true;
      var nm = form.elements['Boy 1 Name']; if (nm && !nm.dataset.touched) nm.value = val('Registrant Name');
    }
    // number of boys fixed at one for the young man himself
    if (mode() === 'self') { var cs = form.elements['Number Of Boys']; if (cs && cs.value !== '1') { cs.value = '1'; setCount(1); } }
    // booking fee fields
    var paid = checkedVal('How Much Paid So Far');
    form.elements['Booking Fee Paid'].value = paid && paid !== 'Nothing yet' ? 'Yes (I have paid)' : (paid ? 'Not yet (I will pay after submitting)' : '');
    form.elements['Booking Fee Total'].value = feeText();
    form.elements['Location'].value = boyEls[0] ? (campOf(boyEls[0]) || defaultCamp) : defaultCamp;
    // phone box appears once a phone type that needs a number is chosen
    boyEls.forEach(function (el, i) {
      var t = checkedVal('Boy ' + (i + 1) + ' Phone Type');
      $('.phone-num', el).hidden = !(t === 'His own phone' || t === 'A family member’s phone');
      var chk = checkedVal('Boy ' + (i + 1) + ' Age');
      $('.age-note', el).textContent = chk ? clusterFor(parseInt(chk, 10)) : '';
    });
    $('#feeTotalValue').textContent = feeText() || 'Choose a camp for each boy';
    $('#feeTotalNote').textContent = boyEls.length > 1
      ? 'This is the booking fee for ' + boyEls.length + ' boys. It secures their places, counts toward the camp fees and is non-refundable.'
      : 'This secures his place, counts toward the camp fee and is non-refundable.';
    // turn off anything inside a hidden conditional block so it is not sent
    $$('input,select,textarea').forEach(function (el) {
      if (el.id === 'proofFile') return;
      var c = el.closest('.cond[hidden], .phone-block[hidden]');
      var p1 = el.closest('#parentMountParent[hidden], #parentMountHelper[hidden], #parentMountSelf[hidden]');
      var step = (el.closest('#sc-parent') && !needParentStep());
      el.disabled = !!(c || p1 || step);
    });
  }
  function clusterFor(a) {
    if (a <= 10) return 'He will join the Young Explorers.';
    if (a <= 13) return 'He will join the Path Finders.';
    if (a <= 17) return 'He will join the Rising Men.';
    return 'He will join the Young Men.';
  }

  /* ---------- validation ---------- */
  function visible(el, root) { for (var n = el; n && n !== root; n = n.parentNode) { if (n.hidden) return false; } return true; }
  function clearErrors(root) { $$('.err', root).forEach(function (x) { x.classList.remove('err'); }); $$('.f-err', root).forEach(function (x) { x.parentNode.removeChild(x); }); }
  function fail(box, msg, fs) { if (!box || box.classList.contains('err')) return box; box.classList.add('err'); var d = document.createElement('div'); d.className = 'f-err'; d.setAttribute('role', 'alert'); d.textContent = msg; box.appendChild(d); return box; }
  function validate(root) {
    clearErrors(root);
    var first = null;
    $$('input,select,textarea', root).forEach(function (el) {
      if (el.disabled || el.type === 'radio' || el.type === 'checkbox' || el.type === 'hidden' || el.type === 'file') return;
      if (!visible(el, root)) return;
      var v = el.value.trim(), msg = '';
      if (el.required && !v) msg = el.tagName === 'SELECT' ? 'Please choose one.' : 'Please fill this in.';
      else if (v && el.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = 'Please enter a valid email address.';
      else if (v && el.getAttribute('data-kind') === 'phone' && v.replace(/\D/g, '').length < 7) msg = 'Please enter a phone number we can call, for example 0775 123 456.';
      if (msg) { var b = fail(el.closest('.field'), msg); if (!first) first = el; }
    });
    $$('fieldset[data-required]', root).forEach(function (fs) {
      if (fs.disabled || !visible(fs, root)) return;
      if (!fs.querySelector('input:checked')) { fail(fs, 'Please choose one.'); if (!first) first = fs.querySelector('input'); }
    });
    $$('input[data-need-check]', root).forEach(function (c) {
      if (c.disabled || !visible(c, root)) return;
      if (!c.checked) { fail(c.closest('.check-row'), 'Please tick this box to continue.'); if (!first) first = c; }
    });
    return first;
  }
  function focusBad(el) { var box = el.closest('.field, fieldset') || el; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (el.type !== 'radio') { try { el.focus({ preventScroll: true }); } catch (e) {} } }

  /* ---------- review ---------- */
  function renderReview() {
    var m = mode(), h = '';
    function line(a, b) { return b ? '<p>' + esc(a) + ' ' + esc(b) + '</p>' : ''; }
    h += '<div class="sum-card"><header><h4>You</h4><button type="button" class="chg" data-goto="you">Edit details</button></header>' +
         '<p><strong>' + esc(val('Registrant Name')) + '</strong></p>' + line('Phone', val('Registrant Phone')) + line('Email', val('Registrant Email')) +
         (m === 'helper' ? line('Helping as', val('Registrant Relationship')) : '') + '</div>';
    if (needParentStep() && (m !== 'self' || val('Parent Name') || val('Parent Phone'))) {
      var pn = m === 'parent' ? val('Registrant Name') : val('Parent Name'), pp = m === 'parent' ? val('Registrant Phone') : val('Parent Phone');
      h += '<div class="sum-card"><header><h4>Parent or guardian</h4><button type="button" class="chg" data-goto="parent">Edit details</button></header>' +
           '<p><strong>' + esc(pn) + '</strong>' + (val('Parent Relationship') ? ', ' + esc(val('Parent Relationship').toLowerCase()) : '') + '</p>' + line('Phone', pp) + line('WhatsApp group', val('Parent WhatsApp Group')) +
           (val('Other Parent Name') ? line('Other parent', val('Other Parent Name') + (val('Other Parent Phone') ? ', ' + val('Other Parent Phone') : '')) : '') + '</div>';
    }
    h += '<div class="sum-card"><header><h4>' + (boyEls.length > 1 ? 'The boys (' + boyEls.length + ')' : 'The boy') + '</h4></header>';
    boyEls.forEach(function (el, i) {
      var n = i + 1, c = campInfo(campOf(el));
      h += '<div class="sum-boy"><span><strong>' + esc(val('Boy ' + n + ' Name')) + '</strong> <small>age ' + esc(checkedVal('Boy ' + n + ' Age')) + ', ' + esc(c ? c.name : '') + '</small></span><button type="button" class="chg" data-goto-boy="' + i + '">Edit details</button></div>';
    });
    h += '</div>';
    var paid = checkedVal('How Much Paid So Far');
    h += '<div class="sum-card"><header><h4>Booking fee</h4><button type="button" class="chg" data-goto="pay">Edit details</button></header><p><strong>' + esc(feeText()) + '</strong></p>' +
         '<p>Paid so far: ' + esc(paid || 'not answered') + '</p></div>';
    $('#reviewMount').innerHTML = '<div class="sum">' + h + '</div>';
  }

  /* ---------- events ---------- */
  btnNext.addEventListener('click', next);
  btnBack.addEventListener('click', back);

  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
      e.preventDefault();
      if (cur < list.length - 1) next();
    }
  });

  form.addEventListener('click', function (e) {
    var t = e.target;
    var cp = t.closest && t.closest('[data-copy-prev]'); if (cp) { copyPrev(parseInt(cp.getAttribute('data-copy-prev'), 10)); return; }
    var g = t.closest && t.closest('[data-goto]'); if (g) { var tgt = { you: scYou, parent: scParent, pay: scPay }[g.getAttribute('data-goto')]; show(screens().indexOf(tgt)); return; }
    var gb = t.closest && t.closest('[data-goto-boy]'); if (gb) { show(screens().indexOf(boyEls[parseInt(gb.getAttribute('data-goto-boy'), 10)])); return; }
  });

  function onChange(e) {
    var t = e.target;
    if (t.name === 'Number Of Boys') { var n = count(); if (n > 0) setCount(n); }
    if (t.name === 'Registered By' && mode() === 'self') { setCount(1); }
    if (t.name === 'Registered By' && mode() !== 'self' && !count()) { /* wait for the count page */ }
    // show district or country
    if (/Applying From$/.test(t.name)) {
      var w = t.closest('.where');
      var uganda = t.value === 'Based in Uganda';
      $('.where-d', w).hidden = !uganda; $('.where-c', w).hidden = uganda;
    }
    if (/Name$/.test(t.name) && /^Boy 1 /.test(t.name) && mode() === 'self') t.dataset.touched = '1';
    var box = t.closest('.err'); if (box) { box.classList.remove('err'); var fe = box.querySelector('.f-err'); if (fe) fe.parentNode.removeChild(fe); }
    sync();
  }
  form.addEventListener('change', onChange);
  form.addEventListener('input', function (e) { var box = e.target.closest && e.target.closest('.err'); if (box && e.target.value) { box.classList.remove('err'); var fe = box.querySelector('.f-err'); if (fe) fe.parentNode.removeChild(fe); } if (/^Registrant /.test(e.target.name)) sync(); });

  // "Apply Now" buttons above pick a camp
  var hiddenLoc = $('#location');
  hiddenLoc.addEventListener('change', function () {
    var old = defaultCamp; defaultCamp = hiddenLoc.value;
    boyEls.forEach(function (el) { var c = campOf(el); if (!c || c === old) pickCamp(el, defaultCamp); });
    sync();
  });
  // "Paid already" links
  window.addEventListener('b2m:paid', function () { window.b2mPaidPreset = true; presetPaid(); });
  function presetPaid() { var r = $('input[name="How Much Paid So Far"][value="The booking fee, or part of it"]'); if (r && !checkedVal('How Much Paid So Far')) { r.checked = true; sync(); } }
  if (window.b2mPaidPreset) presetPaid();

  /* ---------- submit ---------- */
  document.addEventListener('submit', function (e) {
    if (e.target !== form) return;
    sync();
    if (cur < list.length - 1) { e.preventDefault(); e.stopPropagation(); next(); return; }
    // check every page before sending
    for (var i = 0; i < list.length; i++) {
      var wasHidden = list[i].hidden; var bad = validate(list[i]);
      if (bad) { e.preventDefault(); e.stopPropagation(); show(i, true); validate(list[i]); focusBad(list[i].querySelector('.err input, .err select, .err textarea') || bad); return; }
    }
    $$('input[data-kind="phone"]').forEach(function (el) { if (!el.disabled && el.value.trim()) el.value = normPhone(el.value); });
    sync();
    if (PREVIEW) {
      e.preventDefault(); e.stopPropagation();
      var box = document.createElement('div'); box.className = 'card card-gold'; box.setAttribute('role', 'status');
      box.innerHTML = '<h3>Preview only. Nothing was sent.</h3><p>This is how the form works. The real form is not live yet.</p>';
      form.parentNode.replaceChild(box, form); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, true);

  /* ---------- phone numbers: tidy to +256 ---------- */
  // Is the family based in Uganda? true, false, or null when we do not know yet.
  function familyUganda() {
    var w = val('Parent Applying From') || val('Boy 1 Parent Applying From');
    if (!w) return null;
    return w === 'Based in Uganda';
  }
  // Numbers with a country code are always kept. A local style number (0775...) is only
  // changed to +256 when we know the family is in Uganda, so numbers from abroad are never changed wrongly.
  function normPhone(v) {
    var raw = String(v).trim(), t = raw.replace(/[\s\-().]/g, '');
    if (/^\+\d+$/.test(t)) return t;
    if (/^00\d+$/.test(t)) return '+' + t.slice(2);
    if (familyUganda() === true) {
      if (/^0\d{9}$/.test(t)) return '+256' + t.slice(1);
      if (/^256\d{9}$/.test(t)) return '+' + t;
      if (/^7\d{8}$/.test(t)) return '+256' + t;
    }
    return raw;
  }

  /* ---------- half finished registrations ---------- */
  var sentStages = {}, finished = false;
  function sendPartial(stage) {
    if (finished || sentStages[stage] || typeof SHEET_ENDPOINT === 'undefined' || !SHEET_ENDPOINT || PREVIEW) return;
    var ph = val('Registrant Phone'), nm = val('Registrant Name');
    if (!ph && !nm) return;
    sentStages[stage] = 1;
    var b = new URLSearchParams();
    b.append('_form', 'partial'); b.append('Stage', stage);
    b.append('Registered By', val('Registered By') ? checkedVal('Registered By') : '');
    b.append('Registrant Name', nm); b.append('Registrant Phone', normPhone(ph)); b.append('Registrant Email', val('Registrant Email'));
    b.append('Number Of Boys', val('Number Of Boys')); b.append('Boy 1 Name', val('Boy 1 Name'));
    try { fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body: b, keepalive: true }); } catch (e) {}
  }

  /* ---------- save and restore a draft on this device ---------- */
  var DKEY = 'b2m_draft_v1', saveTimer = null;
  function lsGet() { try { return JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) { return null; } }
  function lsSet(o) { try { localStorage.setItem(DKEY, JSON.stringify(o)); } catch (e) {} }
  function lsDel() { try { localStorage.removeItem(DKEY); } catch (e) {} }
  // The parent block exists three times (parent, helper, self). Only the one in use counts.
  function inIdleMount(el) { return !!el.closest('#parentMountParent[hidden], #parentMountHelper[hidden], #parentMountSelf[hidden]'); }
  function collect() {
    var v = {};
    $$('input,select,textarea').forEach(function (el) {
      if (inIdleMount(el)) return;
      if (!el.name || el.type === 'hidden' || el.type === 'file' || el.type === 'submit' || el.name === '_gotcha' || el.name === 'Consent Confirmed') return;
      if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
      else if (el.type === 'checkbox') { v[el.name] = v[el.name] || []; if (el.checked) v[el.name].push(el.value); }
      else v[el.name] = el.value;
    });
    return v;
  }
  function queueSave() {
    if (finished) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (finished) return;
      var v = collect(); if (!v['Registered By']) return;
      lsSet({ t: Date.now(), step: cur, v: v });
    }, 600);
  }
  function fire(el) { el.dispatchEvent(new Event('change', { bubbles: true })); }
  function setEl(name, value) {
    var els = $$('[name="' + name.replace(/"/g, '\\"') + '"]').filter(function (el) { return !inIdleMount(el); });
    els.forEach(function (el) {
      if (el.type === 'radio') el.checked = (el.value === value);
      else if (el.type === 'checkbox') el.checked = (value || []).indexOf(el.value) !== -1;
      else el.value = value;
    });
    return els;
  }
  function restore(d) {
    var v = d.v;
    ['Registered By', 'Number Of Boys'].forEach(function (k) {
      if (!(k in v)) return;
      var els = setEl(k, v[k]); var on = els.filter(function (x) { return x.checked; })[0] || (els[0] && els[0].tagName === 'SELECT' ? els[0] : null);
      if (on) fire(on);
    });
    Object.keys(v).forEach(function (k) {
      if (k === 'Registered By' || k === 'Number Of Boys') return;
      var els = setEl(k, v[k]);
      els.forEach(function (el) { if ((el.type === 'radio' && el.checked) || el.tagName === 'SELECT') fire(el); });
    });
    sync();
    show(Math.max(0, Math.min(d.step || 0, screens().length - 1)), false);
  }
  window.b2mClearDraft = function () { finished = true; clearTimeout(saveTimer); lsDel(); };
  form.addEventListener('change', queueSave);
  form.addEventListener('input', queueSave);
  (function offerDraft() {
    if (PREVIEW) return;
    var d = lsGet();
    if (!d || !d.v || !d.v['Registered By'] || Date.now() - d.t > 7 * 864e5) { if (d) lsDel(); return; }
    var bar = document.createElement('div'); bar.className = 'draft-bar'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<p><strong>Welcome back.</strong> We kept your earlier answers on this phone.</p>' +
      '<div><button type="button" class="btn btn-gold" data-d="go">Continue where I stopped</button> <button type="button" class="wiz-back" data-d="new">Start fresh</button></div>';
    form.parentNode.insertBefore(bar, form);
    bar.addEventListener('click', function (e) {
      var t = e.target.getAttribute && e.target.getAttribute('data-d'); if (!t) return;
      if (t === 'go') restore(d); else lsDel();
      bar.parentNode.removeChild(bar);
    });
  })();

  show(0, true);
});
