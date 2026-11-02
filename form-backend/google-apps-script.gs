/**
 * Boys to Men Mentorship Camp: form receiver
 *
 * Saves every Apply and Contact form submission into this Google Sheet,
 * and emails a notice to the sheet owner. No monthly submission limit.
 *
 * The Apply form can register several boys at once. This script saves ONE ROW
 * PER BOY in the "Registrations" tab. Boys registered together share a
 * Family ID, and the parent details are repeated on each boy's row.
 * The payment amount, transaction ID and proof are written on the first boy's
 * row only, so a family's payment is never counted twice.
 * Only ONE alert email is sent for the whole family.
 *
 * Setup: see SETUP-GOOGLE-SHEET-FORMS.txt
 * Update: see UPDATE-SCRIPT-FOR-MULTI-BOY-FORM.txt
 */

// Leave empty to send notices to the Google account that owns this script.
// Or put one or more addresses here, separated by commas.
var NOTIFY_EMAIL = '';

// Invite link of the Boys to Men WhatsApp group. Shown in the confirmation email.
var WHATSAPP_GROUP_LINK = 'https://chat.whatsapp.com/FS8ZutpkQDC4DTMvh5pBPc';

// Sheet (tab) names. They are created automatically on the first submission.
var TABS = {
  apply: 'Registrations',
  contact: 'Contact Messages'
};

// Fields that are only used for spam checks and are not saved.
// The proof of payment file fields are handled separately below, so the
// large file data never goes into a sheet cell.
var SKIP_FIELDS = ['_gotcha', '_subject', '_form', '_page',
                   'Proof File Name', 'Proof File Type', 'Proof File Data'];

// Drive folder where proof of payment pictures are kept. It is created
// automatically in your Google Drive on the first upload. Files are private.
var PROOF_FOLDER_NAME = 'Boys to Men Payment Proofs';

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var p = e.parameters || {};
    var formType = first_(p._form) === 'contact' ? 'contact' : 'apply';

    // Spam trap: real visitors never fill this hidden field.
    if (first_(p._gotcha)) {
      return json_({ ok: true });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Half finished registration: a parent filled the first pages and then stopped.
    if (first_(p._form) === 'partial') {
      savePartial_(ss, p);
      return json_({ ok: true });
    }

    var sheet = ss.getSheetByName(TABS[formType]) || ss.insertSheet(TABS[formType]);

    // New style Apply form: several boys in one submission.
    var boys = parseInt(first_(p['Number Of Boys']), 10);
    if (formType === 'apply' && boys >= 1) {
      var family = buildFamilyRows_(p, boys);
      family.dups = checkDuplicates_(sheet, family);
      family.rows.forEach(function (row, i) {
        row['Possible Duplicate'] = family.dups[i] ? 'Yes, same boy and phone as ' + family.dups[i] : '';
      });
      writeRows_(sheet, family.rows);
      notifyFamily_(family);
      try { sendConfirmation_(family); } catch (x) {}
      try { markPartialsDone_(ss, family); } catch (x) {}
      try { rebuildMaster_(ss, sheet); } catch (x) {}
      return json_({ ok: true });
    }

    // Everything else (Contact form, or the old one boy Apply form):
    // one row per submission, exactly as before.
    var row = { 'Submitted At': now_() };
    Object.keys(p).forEach(function (key) {
      if (SKIP_FIELDS.indexOf(key) !== -1) return;
      var label = key === '_opened_at' ? 'Form Opened At' : key;
      row[label] = p[key].join('; ');
    });
    row['Page'] = first_(p._page) || '';

    // Optional proof of payment: save the picture or PDF to Drive and put
    // the link in the sheet. If this step fails, the registration is still saved.
    if (first_(p['Proof File Data'])) {
      row['Proof of Payment Link'] = proofLink_(p, first_(p['Full Name']) || first_(p['Name']) || 'Registration');
    }

    writeRows_(sheet, [row]);
    notify_(formType, row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Lets you open the web app link in a browser to confirm it is live.
function doGet() {
  return ContentService.createTextOutput('Boys to Men form receiver is running.');
}

/* ------------------------------------------------------------------ */
/* Family registrations (one row per boy)                              */
/* ------------------------------------------------------------------ */

function buildFamilyRows_(p, n) {
  var g = function (name) { return (p[name] || []).join('; ').trim(); };
  var registeredBy = g('Registered By');
  var self = registeredBy === 'The young man himself';
  var helper = registeredBy === 'Helping to register him';
  var differentParents = helper && n > 1 && g('Same Parent For All') === 'No';
  // Every boy gets his own code, BTM-2650 onwards, never repeated. The family reference is the first boy's code.
  var firstNo = reserveBoyNumbers_(n);
  var familyId = 'BTM-' + firstNo;
  var submitted = now_();

  // Family level details
  var reg = {
    name: g('Registrant Name'), phone: g('Registrant Phone'), email: g('Registrant Email'),
    wa: yn_(g('Registrant Phone On WhatsApp')), role: g('Registrant Relationship'),
    group: g('Registrant WhatsApp Group'), waNum: g('Registrant WhatsApp Number To Add') || g('Registrant WhatsApp Number'), waAlt: g('Registrant WhatsApp Number')
  };
  var other = {
    name: g('Other Parent Name'), phone: g('Other Parent Phone'), wa: yn_(g('Other Parent Phone On WhatsApp')),
    relation: g('Other Parent Relationship'), group: g('Other Parent WhatsApp Group'), waAlt: g('Other Parent WhatsApp Number')
  };
  var hasOther = !!(other.name || other.phone);

  var proof = '';
  if (first_(p['Proof File Data'])) {
    proof = proofLink_(p, reg.name || 'Registration');
  }

  var rows = [];
  var boyList = [];
  for (var i = 1; i <= n; i++) {
    var b = 'Boy ' + i + ' ';
    var pp = differentParents ? ('Boy ' + i + ' Parent ') : 'Parent ';
    var parent = {
      name: g(pp + 'Name'), phone: g(pp + 'Phone'), email: g(pp + 'Email'), wa: yn_(g(pp + 'Phone On WhatsApp')),
      relation: g(pp + 'Relationship'), from: g(pp + 'Applying From'), district: g(pp + 'District'),
      country: g(pp + 'Country'), group: g(pp + 'WhatsApp Group'), waNum: g(pp + 'WhatsApp Number To Add') || g(pp + 'WhatsApp Number'), waAlt: g(pp + 'WhatsApp Number')
    };

    var boy = {
      no: i, code: 'BTM-' + (firstNo + i - 1), name: g(b + 'Name'), age: g(b + 'Age'), camp: g(b + 'Camp'), phone: g(b + 'Phone'),
      phoneType: g(b + 'Phone Type'), outcomes: (p[b + 'Desired Outcome'] || []).join('; '), about: g(b + 'About Him')
    };
    boyList.push({ boy: boy, parent: parent });

    var row = {
      'Submitted At': submitted,
      'Family ID': familyId,
      'Boy ID': 'BTM-' + (firstNo + i - 1),
      'Boy Of Family': i + ' of ' + n,
      'Registered By': registeredBy,
      'Registrant Name': reg.name,
      'Registrant Phone': reg.phone,
      'Registrant Phone On WhatsApp': reg.wa,
      'Registrant WhatsApp Number': reg.waAlt,
      'Registrant Email': reg.email,
      'Registrant Relationship': reg.role,

      // Columns the old form used, kept so existing rows and reports still line up.
      // "Full Name", "Email" and "Phone" are the parent or guardian responsible for the boy.
      'Full Name': parent.name || reg.name,
      'Email': parent.email || reg.email,
      'Phone': parent.phone || reg.phone,
      'Applying From': parent.from,
      'District': parent.district,
      'Country': parent.country,
      'Who Is Attending': self ? 'My son / the young man himself is registering' : 'I am registering on his behalf',
      'Applicant Name': boy.name,
      'Age': boy.age,
      'Location': boy.camp,
      'Needs Travel Guidance': g('Needs Travel Guidance'),
      'Preferred Currency': g('Preferred Currency'),
      'Desired Outcome': boy.outcomes,
      'Message': boy.about,
      'Booking Fee Paid': g('Booking Fee Paid'),
      'Wants Call': g('Wants Call') ? 'Yes' : '',
      'Consent Confirmed': g('Consent Confirmed') ? 'Yes' : '',
      'Wants WhatsApp Group': self ? reg.group : parent.group,
      'Form Opened At': g('_opened_at'),

      // New columns
      'Boy Phone': boy.phone,
      'Boy Phone Type': boy.phoneType,
      'Parent Relationship': parent.relation,
      'Parent Phone On WhatsApp': parent.wa,
      'Parent WhatsApp Number': parent.waAlt,
      'Parent WhatsApp Group': parent.group,
      'Parent WhatsApp Number To Add': parent.waNum,
      'Registrant WhatsApp Group': reg.group,
      'Registrant WhatsApp Number To Add': reg.waNum,
      'Other Parent Name': hasOther ? other.name : '',
      'Other Parent Phone': hasOther ? other.phone : '',
      'Other Parent Phone On WhatsApp': hasOther ? other.wa : '',
      'Other Parent WhatsApp Number': hasOther ? other.waAlt : '',
      'Other Parent Relationship': hasOther ? other.relation : '',
      'Other Parent WhatsApp Group': hasOther ? other.group : '',
      'Page': first_(p._page) || ''
    };

    if (i === 1) {
      row['How Much Paid So Far'] = g('How Much Paid So Far');
      row['Amount Paying Now'] = g('Amount Paying Now');
      row['Transaction ID'] = g('Transaction ID');
      row['Who Is Paying'] = g('Who Is Paying');
      row['Booking Fee Due For Family'] = g('Booking Fee Total');
      if (proof) row['Proof of Payment Link'] = proof;
    } else {
      row['Payment Note'] = 'Payment recorded on Boy 1 of this family (' + familyId + ')';
    }
    rows.push(row);
  }

  return {
    id: familyId, n: n, rows: rows, boys: boyList, registeredBy: registeredBy, reg: reg, other: other, hasOther: hasOther,
    differentParents: differentParents, self: self, g: g, proof: proof
  };
}

function notifyFamily_(f) {
  var to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var g = f.g;
  var first = f.boys[0];
  var lead = (first.parent.name || f.reg.name || 'Someone');
  var anyDup = f.dups && Object.keys(f.dups).length > 0;
  var subject = (anyDup ? 'POSSIBLE DUPLICATE. ' : '') + 'New Registration: Boys to Men (' + lead + ') ' + f.n + (f.n === 1 ? ' boy' : ' boys');

  var L = [];
  L.push('Family ID: ' + f.id);
  L.push('Number of boys: ' + f.n);
  if (anyDup) {
    Object.keys(f.dups).forEach(function (i) {
      L.push('WARNING: ' + f.boys[i].boy.name + ' looks already registered with the same phone number, see ' + f.dups[i] + '. Please check before confirming.');
    });
  }
  L.push('');
  L.push('FILLED IN BY');
  L.push(f.registeredBy);
  L.push(line_('Name', f.reg.name)); L.push(line_('Phone', f.reg.phone + (f.reg.wa === 'Yes' ? ' (WhatsApp)' : (f.reg.waAlt ? ' (not on WhatsApp, WhatsApp is ' + f.reg.waAlt + ')' : ' (not on WhatsApp)'))));
  L.push(line_('Email', f.reg.email)); if (f.reg.role) L.push(line_('How they know the boy', f.reg.role));
  if (f.self) { L.push(line_('Boys to Men WhatsApp platform', f.reg.group)); L.push(line_('WhatsApp number to add', f.reg.waNum)); }

  {
    var seen = {};
    f.boys.forEach(function (x) {
      var key = x.parent.name + '|' + x.parent.phone;
      if (seen[key] || (!x.parent.name && !x.parent.phone)) return; seen[key] = true;
      L.push('');
      L.push(f.differentParents ? 'PARENT OR GUARDIAN (of ' + x.boy.name + ')' : 'PARENT OR GUARDIAN');
      L.push(line_('Name', x.parent.name + (x.parent.relation ? ' (' + x.parent.relation + ')' : '')));
      L.push(line_('Phone', x.parent.phone + (x.parent.wa === 'Yes' ? ' (WhatsApp)' : '')));
      if (x.parent.email) L.push(line_('Email', x.parent.email));
      L.push(line_('From', [x.parent.from, x.parent.district || x.parent.country].filter(Boolean).join(', ')));
      L.push(line_('Parents\' WhatsApp group', x.parent.group));
      L.push(line_('WhatsApp number to add', x.parent.waNum));
    });
  }
  if (f.hasOther) {
    L.push('');
    L.push('OTHER PARENT OR GUARDIAN');
    L.push(line_('Name', f.other.name + (f.other.relation ? ' (' + f.other.relation + ')' : '')));
    L.push(line_('Phone', f.other.phone + (f.other.wa === 'Yes' ? ' (WhatsApp)' : '')));
    L.push(line_('Parents\' WhatsApp group', f.other.group));
  }

  f.boys.forEach(function (x) {
    var b = x.boy;
    L.push('');
    L.push('BOY ' + b.no + ' OF ' + f.n + ': ' + b.name + ', age ' + b.age + ' (' + b.code + ')');
    L.push(line_('Camp', b.camp));
    L.push(line_('How to reach him', (b.phoneType || 'Not given') + (b.phone ? ': ' + b.phone : '')));
    L.push(line_('Changes hoped for', b.outcomes));
    L.push(line_('In the parent\'s words', b.about));
  });

  L.push('');
  L.push('PAYMENT');
  L.push(line_('Booking fee due', g('Booking Fee Total')));
  L.push(line_('Paid so far', g('How Much Paid So Far')));
  L.push(line_('Amount paid', g('Amount Paying Now')));
  L.push(line_('Transaction ID', g('Transaction ID')));
  L.push(line_('Who will pay', g('Who Is Paying')));
  if (f.proof) L.push(line_('Proof of payment', f.proof));
  L.push(line_('Travel guidance', g('Needs Travel Guidance')));
  L.push(line_('Fee currency', g('Preferred Currency')));
  L.push(line_('Wants a call', g('Wants Call') ? 'Yes' : ''));
  L.push(line_('Details confirmed correct', g('Consent Confirmed') ? 'Yes' : 'No'));

  // Things the team has to do
  var todo = [];
  if (f.self && /^No, please/.test(f.reg.group)) todo.push('Add ' + f.reg.name + ' (' + (f.reg.waNum || f.reg.phone) + ') to the Boys to Men WhatsApp platform');
  else if (f.self && /^Not sure/.test(f.reg.group)) todo.push('Check if ' + f.reg.name + ' (' + (f.reg.waNum || f.reg.phone) + ') is on the Boys to Men WhatsApp platform');
  f.boys.forEach(function (x) {
    if (x.parent.group && /^No, please/.test(x.parent.group)) todo.push('Add ' + x.parent.name + ' (' + (x.parent.waNum || x.parent.phone) + ') to the parents\' WhatsApp group');
    else if (x.parent.group && /^Not sure/.test(x.parent.group)) todo.push('Check if ' + x.parent.name + ' (' + (x.parent.waNum || x.parent.phone) + ') is in the parents\' WhatsApp group');
  });
  if (f.hasOther && /^No, please/.test(f.other.group)) todo.push('Add ' + f.other.name + ' (' + (f.other.waAlt || f.other.phone) + ') to the parents\' WhatsApp group');
  else if (f.hasOther && /^Not sure/.test(f.other.group)) todo.push('Check if ' + f.other.name + ' (' + (f.other.waAlt || f.other.phone) + ') is in the parents\' WhatsApp group');
  var uniq = todo.filter(function (t, i) { return todo.indexOf(t) === i; });
  if (uniq.length) { L.push(''); L.push('TO DO'); uniq.forEach(function (t) { L.push('- ' + t); }); }

  var options = { name: 'Boys to Men Website' };
  var replyTo = f.reg.email;
  if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) options.replyTo = replyTo;
  try {
    MailApp.sendEmail(to, subject, L.filter(function (x) { return x !== null; }).join('\n'), options);
  } catch (err) {
    // If the daily email limit is ever reached, the entries are still safe in the sheet.
  }
}


/* ------------------------------------------------------------------ */
/* Extras: duplicates, confirmation email, half finished, Master tab    */
/* ------------------------------------------------------------------ */

function d9_(s) { return String(s || '').replace(/\D/g, '').slice(-9); }
function norm_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// Looks for the same boy name with the same parent phone already in the sheet.
function checkDuplicates_(sheet, family) {
  var dup = {};
  try {
    if (sheet.getLastRow() < 2) return dup;
    var vals = sheet.getDataRange().getValues();
    var h = vals[0];
    var cN = h.indexOf('Applicant Name'), cP = h.indexOf('Phone'), cF = h.indexOf('Family ID');
    if (cN < 0 || cP < 0) return dup;
    family.rows.forEach(function (row, i) {
      var nm = norm_(row['Applicant Name']), ph = d9_(row['Phone']);
      if (!nm || !ph) return;
      for (var r = 1; r < vals.length; r++) {
        if (norm_(vals[r][cN]) === nm && d9_(vals[r][cP]) === ph) { dup[i] = (cF >= 0 && vals[r][cF]) ? vals[r][cF] : ('row ' + (r + 1)); break; }
      }
    });
  } catch (err) {}
  return dup;
}

// A short email to the person who filled in the form.
function sendConfirmation_(f) {
  var to = f.reg.email;
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
  var g = f.g;
  var names = f.boys.map(function (x) { return x.boy.name; }).filter(Boolean);
  var nameText = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : (names[0] || 'your boy');
  var plural = f.n > 1;
  var his = plural ? 'their places' : 'his place';
  var paid = g('How Much Paid So Far');
  var hasPaid = paid && paid !== 'Nothing yet' && paid !== 'Not yet';

  // The email is written as separate paragraphs. Each block below is one paragraph or box.
  var B = [];
  B.push({ lines: ['Hello ' + (f.reg.name || '') + ','] });

  var first = ['Thank you for registering ' + nameText + ' for the Boys to Men Mentorship Camp. Your registration has been received.',
    'Your reference number is ' + f.id + '. Please quote it when you pay or when you talk to us.'];
  if (f.n > 1) first.push('Each boy also has his own code. ' + f.boys.map(function (x) { return x.boy.name + ' is ' + x.boy.code; }).join(', ') + '.');
  B.push({ lines: first });

  if (hasPaid) {
    B.push({ lines: ['You told us you have already paid ' + (/full/i.test(paid) ? 'the full camp fee' : 'some of the fee') + '. We will match your payment and confirm ' + his + ' within 24 hours.'] });
  } else {
    B.push({ lines: ['To secure ' + his + ', please pay the booking fee of ' + (g('Booking Fee Total') || 'UGX 50,000 per boy') + '. It counts toward the camp fee and is non refundable. You can pay by bank or by mobile money.'] });
    B.push({ box: true, lines: ['Bank is Centenary Bank, Wakiso Branch.', 'Account name is Potential Unexplored Limited.', 'Account number is 3100125782.'] });
    B.push({ lines: ['The simple steps for MTN MoMo, Airtel Money and the bank are on https://boystomencamp.com/pay.html',
      'After paying, send us the transaction ID or a screenshot on WhatsApp, +256 779 363 354. We will confirm ' + his + ' within 24 hours of receiving it.'] });
  }

  B.push({ button: true, lines: ['If you have not yet joined our WhatsApp group for parents and guardians, please use the button below to ask to join. We approve each request, so it may take a little time.',
    'If you are already in the group, you are welcome to share the same link with another parent or guardian who needs to be on the platform.'] });

  B.push({ lines: ['If any detail is wrong, just reply to this email or message us on WhatsApp.'] });
  B.push({ lines: ['Warm regards,', 'Boys to Men Mentorship Camp'] });

  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var plain = B.map(function (b) {
    return b.lines.join('\n') + (b.button ? '\n' + WHATSAPP_GROUP_LINK : '');
  }).join('\n\n');
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:560px;">' + B.map(function (b) {
    var inner = b.lines.map(esc).join('<br>');
    if (b.box) return '<p style="margin:0 0 18px;padding:12px 16px;background:#f6f1e3;border-left:4px solid #cc9a2e;">' + inner + '</p>';
    if (b.button) return '<p style="margin:0 0 18px;">' + inner + '</p><p style="margin:0 0 18px;"><a href="' + WHATSAPP_GROUP_LINK + '" style="display:inline-block;background:#25D366;color:#073B1B;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:999px;">Join the Boys to Men WhatsApp group</a></p>';
    return '<p style="margin:0 0 18px;">' + inner + '</p>';
  }).join('') + '</div>';
  MailApp.sendEmail(to, 'We have received your registration (' + f.id + ')', plain, { name: 'Boys to Men Camp', htmlBody: html });
}

// Saves what a parent typed on the first pages, in case they never finish.
function savePartial_(ss, p) {
  var tab = 'Incomplete Registrations';
  var sheet = ss.getSheetByName(tab) || ss.insertSheet(tab);
  var g = function (n) { return first_(p[n]); };
  writeRows_(sheet, [{
    'Submitted At': now_(), 'Stage': g('Stage'), 'Registered By': g('Registered By'),
    'Name': g('Registrant Name'), 'Phone': g('Registrant Phone'), 'Email': g('Registrant Email'),
    'Number Of Boys': g('Number Of Boys'), 'Boy 1 Name': g('Boy 1 Name'), 'Status': 'Not finished'
  }]);
}

// When the same phone number later completes a registration, mark the earlier half finished rows.
function markPartialsDone_(ss, f) {
  var sheet = ss.getSheetByName('Incomplete Registrations');
  if (!sheet || sheet.getLastRow() < 2) return;
  var vals = sheet.getDataRange().getValues(), h = vals[0];
  var cP = h.indexOf('Phone'), cS = h.indexOf('Status');
  if (cP < 0 || cS < 0) return;
  var ph = d9_(f.reg.phone);
  if (!ph) return;
  for (var r = 1; r < vals.length; r++) {
    if (d9_(vals[r][cP]) === ph && String(vals[r][cS]).indexOf('Completed') !== 0) {
      sheet.getRange(r + 1, cS + 1).setValue('Completed ' + f.id);
    }
  }
}

// One row per family, rebuilt from the Registrations tab after every registration.
// The last two columns (Payment Confirmed, Notes) are typed by the team and are kept.
function rebuildMaster_(ss, reg) {
  if (reg.getLastRow() < 2) return;
  var vals = reg.getDataRange().getValues(), h = vals[0];
  var ix = function (n) { return h.indexOf(n); };
  var cFam = ix('Family ID');
  if (cFam < 0) return;
  var master = ss.getSheetByName('Master') || ss.insertSheet('Master');
  var kept = {};
  if (master.getLastRow() > 1) {
    var old = master.getDataRange().getValues();
    for (var k = 1; k < old.length; k++) kept[old[k][0]] = [old[k][old[k].length - 2], old[k][old[k].length - 1]];
  }
  var order = [], fam = {};
  var pick = function (row, n) { var c = ix(n); return c < 0 ? '' : row[c]; };
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r], id = row[cFam];
    if (!id) continue;
    if (!fam[id]) {
      fam[id] = { first: row, boys: [] }; order.push(id);
    }
    fam[id].boys.push(pick(row, 'Applicant Name') + (pick(row, 'Boy ID') ? ' ' + pick(row, 'Boy ID') : '') + ' (' + pick(row, 'Age') + ', ' + String(pick(row, 'Location')).split(' — ')[0] + ')');
  }
  var head = ['Family ID', 'Submitted At', 'Registered By', 'Parent Or Guardian', 'Phone', 'Email', 'Number Of Boys', 'Boys',
    'Booking Fee Due', 'How Much Paid So Far', 'Amount Paying Now', 'Transaction ID', 'Who Is Paying', 'Proof Of Payment',
    'Possible Duplicate', 'Payment Confirmed', 'Notes'];
  var out = order.map(function (id) {
    var f = fam[id], r1 = f.first;
    var kp = kept[id] || ['', ''];
    return [id, pick(r1, 'Submitted At'), pick(r1, 'Registered By'), pick(r1, 'Full Name'), pick(r1, 'Phone'), pick(r1, 'Email'),
      f.boys.length, f.boys.join('; '), pick(r1, 'Booking Fee Due For Family'), pick(r1, 'How Much Paid So Far'),
      pick(r1, 'Amount Paying Now'), pick(r1, 'Transaction ID'), pick(r1, 'Who Is Paying'), pick(r1, 'Proof of Payment Link'),
      pick(r1, 'Possible Duplicate'), kp[0], kp[1]];
  });
  master.clearContents();
  master.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  master.setFrozenRows(1);
  if (out.length) {
    master.getRange(2, 5, out.length, 1).setNumberFormat('@');
    master.getRange(2, 1, out.length, head.length).setValues(out);
  }
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function writeRows_(sheet, rows) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  rows.forEach(function (row) {
    Object.keys(row).forEach(function (name) {
      if (headers.indexOf(name) === -1) {
        headers.push(name);
        sheet.getRange(1, headers.length).setValue(name);
      }
    });
  });
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  rows.forEach(function (row) {
    var values = headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    // Phone numbers are kept as text so the + in +256... is never dropped.
    var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length);
    target.setNumberFormats([headers.map(function (h) { return /Phone|Number To Add/.test(h) && !/On WhatsApp|Type/.test(h) ? '@' : 'General'; })]);
    target.setValues([values]);
  });
}

function notify_(formType, row) {
  var to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;

  var who = row['Full Name'] || row['Name'] || 'Someone';
  var subject = formType === 'contact'
    ? 'New message: Boys to Men (' + who + ')'
    : 'New Registration: Boys to Men (' + who + ')';

  var lines = Object.keys(row).map(function (k) {
    return k + ': ' + row[k];
  });

  var options = { name: 'Boys to Men Website' };
  var replyTo = row['Email'];
  if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) options.replyTo = replyTo;

  try {
    MailApp.sendEmail(to, subject, lines.join('\n'), options);
  } catch (err) {
    // If the daily email limit is ever reached, the entry is still safe in the sheet.
  }
}

function proofLink_(p, who) {
  try {
    return saveProof_(
      first_(p['Proof File Data']),
      first_(p['Proof File Type']) || 'image/jpeg',
      first_(p['Proof File Name']) || 'proof',
      who
    );
  } catch (fileErr) {
    return 'Upload failed: ' + String(fileErr);
  }
}

function saveProof_(base64, type, name, who) {
  var folders = DriveApp.getFoldersByName(PROOF_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PROOF_FOLDER_NAME);
  var stamp = Utilities.formatDate(new Date(), 'Africa/Kampala', 'yyyy-MM-dd HH.mm');
  var safeWho = String(who).replace(/[^A-Za-z0-9 ]/g, '').trim() || 'Registration';
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), type, stamp + ' ' + safeWho + ' ' + name);
  return folder.createFile(blob).getUrl();
}

// Hands out the next boy numbers. The first boy ever registered here gets 2650.
// This runs while the script lock is held, so two families can never receive the same number.
function reserveBoyNumbers_(n) {
  var props = PropertiesService.getScriptProperties();
  var next = parseInt(props.getProperty('NEXT_BOY_NO'), 10);
  if (!(next >= 2650)) next = 2650;
  props.setProperty('NEXT_BOY_NO', String(next + n));
  return next;
}

function makeFamilyId_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var tail = '';
  for (var i = 0; i < 4; i++) tail += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'BTM-' + Utilities.formatDate(new Date(), 'Africa/Kampala', 'yyMMdd') + '-' + tail;
}

function now_() {
  return Utilities.formatDate(new Date(), 'Africa/Kampala', 'yyyy-MM-dd HH:mm:ss');
}

function yn_(v) { return v === 'Yes' ? 'Yes' : (v === 'No' ? 'No' : (v ? v : 'No')); }

function line_(label, value) {
  return value ? label + ': ' + value : null;
}

function first_(arr) {
  return arr && arr.length ? arr[0] : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
