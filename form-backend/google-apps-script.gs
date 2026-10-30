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
    var sheet = ss.getSheetByName(TABS[formType]) || ss.insertSheet(TABS[formType]);

    // New style Apply form: several boys in one submission.
    var boys = parseInt(first_(p['Number Of Boys']), 10);
    if (formType === 'apply' && boys >= 1) {
      var family = buildFamilyRows_(p, boys);
      writeRows_(sheet, family.rows);
      notifyFamily_(family);
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
  var familyId = makeFamilyId_();
  var submitted = now_();

  // Family level details
  var reg = {
    name: g('Registrant Name'), phone: g('Registrant Phone'), email: g('Registrant Email'),
    wa: yn_(g('Registrant Phone On WhatsApp')), role: g('Registrant Relationship'),
    group: g('Registrant WhatsApp Group'), waNum: g('Registrant WhatsApp Number To Add')
  };
  var other = {
    name: g('Other Parent Name'), phone: g('Other Parent Phone'), wa: yn_(g('Other Parent Phone On WhatsApp')),
    relation: g('Other Parent Relationship'), group: g('Other Parent WhatsApp Group')
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
      country: g(pp + 'Country'), group: g(pp + 'WhatsApp Group'), waNum: g(pp + 'WhatsApp Number To Add')
    };

    var boy = {
      no: i, name: g(b + 'Name'), age: g(b + 'Age'), camp: g(b + 'Camp'), phone: g(b + 'Phone'),
      phoneType: g(b + 'Phone Type'), outcomes: (p[b + 'Desired Outcome'] || []).join('; '), about: g(b + 'About Him')
    };
    boyList.push({ boy: boy, parent: parent });

    var row = {
      'Submitted At': submitted,
      'Family ID': familyId,
      'Boy Of Family': i + ' of ' + n,
      'Registered By': registeredBy,
      'Registrant Name': reg.name,
      'Registrant Phone': reg.phone,
      'Registrant Phone On WhatsApp': reg.wa,
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
      'Wants WhatsApp Group': self ? reg.group : parent.group,
      'Form Opened At': g('_opened_at'),

      // New columns
      'Boy Phone': boy.phone,
      'Boy Phone Type': boy.phoneType,
      'Parent Relationship': parent.relation,
      'Parent Phone On WhatsApp': parent.wa,
      'Parent WhatsApp Group': parent.group,
      'Parent WhatsApp Number To Add': parent.waNum,
      'Registrant WhatsApp Group': reg.group,
      'Registrant WhatsApp Number To Add': reg.waNum,
      'Other Parent Name': hasOther ? other.name : '',
      'Other Parent Phone': hasOther ? other.phone : '',
      'Other Parent Phone On WhatsApp': hasOther ? other.wa : '',
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
  var subject = 'New Registration: Boys to Men (' + lead + ') ' + f.n + (f.n === 1 ? ' boy' : ' boys');

  var L = [];
  L.push('Family ID: ' + f.id);
  L.push('Number of boys: ' + f.n);
  L.push('');
  L.push('FILLED IN BY');
  L.push(f.registeredBy);
  L.push(line_('Name', f.reg.name)); L.push(line_('Phone', f.reg.phone + (f.reg.wa === 'Yes' ? ' (WhatsApp)' : '')));
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
    L.push('BOY ' + b.no + ' OF ' + f.n + ': ' + b.name + ', age ' + b.age);
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

  // Things the team has to do
  var todo = [];
  if (f.self && /^No, please/.test(f.reg.group)) todo.push('Add ' + f.reg.name + ' (' + (f.reg.waNum || f.reg.phone) + ') to the Boys to Men WhatsApp platform');
  else if (f.self && /^Not sure/.test(f.reg.group)) todo.push('Check if ' + f.reg.name + ' (' + (f.reg.waNum || f.reg.phone) + ') is on the Boys to Men WhatsApp platform');
  f.boys.forEach(function (x) {
    if (x.parent.group && /^No, please/.test(x.parent.group)) todo.push('Add ' + x.parent.name + ' (' + (x.parent.waNum || x.parent.phone) + ') to the parents\' WhatsApp group');
    else if (x.parent.group && /^Not sure/.test(x.parent.group)) todo.push('Check if ' + x.parent.name + ' (' + (x.parent.waNum || x.parent.phone) + ') is in the parents\' WhatsApp group');
  });
  if (f.hasOther && /^No, please/.test(f.other.group)) todo.push('Add ' + f.other.name + ' (' + f.other.phone + ') to the parents\' WhatsApp group');
  else if (f.hasOther && /^Not sure/.test(f.other.group)) todo.push('Check if ' + f.other.name + ' (' + f.other.phone + ') is in the parents\' WhatsApp group');
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
    sheet.appendRow(values);
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
