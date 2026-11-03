/**
 * Boys to Men: keep "Boys to Men Master Registrations" up to date by itself.
 *
 * Paste this at the bottom of the live Apps Script (the one inside the
 * "Boys to Men Registrations" sheet). It does not change anything else.
 *
 * What it does, every 5 minutes
 *  - Reads the "Registrations" tab.
 *  - Leaves out your own test registrations.
 *  - Adds every boy who is not yet in the master sheet, under the right camp,
 *    newest first, the same way the sheet is laid out today.
 *  - Numbers the rows again and fixes the Subtotal and TOTAL rows.
 *  - Writes the boy code (BTM-2650 and so on) in column Q, so each boy is
 *    recognised for good.
 *
 * What it never does
 *  - It never deletes a row.
 *  - It never changes anything you typed. Paid so far, Reply status,
 *    Added to WhatsApp, Notes and the other columns stay as you left them.
 *    It only fills empty cells, and only on rows it adds itself.
 *
 * How to start it: see PASTE-SYNC-MASTER-REGISTRATIONS.txt
 */

var MASTER_FILE_ID = '1ipA0b6EezaGLAxXmrorHFuEStRdEO65LhUNBsvv9bek';
var MASTER_SOURCE_TAB = 'Registrations';

// Your own emails. Registrations made with these are tests and are left out.
var MASTER_OWN_EMAILS = ['baniyoluigi@gmail.com', 'banio@potentialunexplored.com'];

// One block per camp. "prefix" is how the title row starts in the master sheet.
// A new block is made by itself when the first boy for that camp arrives.
var MASTER_SECTIONS = [
  { key: 'kampala', prefix: 'KAMPALA CAMP', title: 'KAMPALA CAMP, 13 to 19 December 2026', fee: 500000, booking: 50000 },
  { key: 'arua', prefix: 'ARUA CAMP', title: 'ARUA CAMP, 10 to 16 January 2027', fee: 400000, booking: 50000 },
  { key: 'summer', prefix: 'SUMMER CAMP', title: 'SUMMER CAMP, 7 to 16 July 2027', fee: '', booking: '' }
];

var MASTER_COLS = 17; // A to Q. Column Q holds the boy code.
var MASTER_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ------------------------------------------------------------------ */
/* Start and stop                                                      */
/* ------------------------------------------------------------------ */

// Run this once. It saves a backup copy of the master sheet, starts the
// 5 minute timer and does the first update.
function startMasterSync() {
  var stamp = Utilities.formatDate(new Date(), 'Africa/Kampala', 'd MMM yyyy HH:mm');
  DriveApp.getFileById(MASTER_FILE_ID).makeCopy('Boys to Men Master Registrations, backup before auto update, ' + stamp);
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncMasterRegistrations'; });
  if (!exists) ScriptApp.newTrigger('syncMasterRegistrations').timeBased().everyMinutes(5).create();
  syncMasterRegistrations(true);
}

// Run this to stop the automatic updates.
function stopMasterSync() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncMasterRegistrations') ScriptApp.deleteTrigger(t);
  });
}

// Run this first if you want to see what would be added, without changing anything.
// Look in View, then Logs (or Executions) afterwards.
function previewMasterSync() {
  masterSync_(true);
}

// The timer calls this. It is quick when nothing is new.
function syncMasterRegistrations(force) {
  masterSync_(false, force === true);
}

/* ------------------------------------------------------------------ */
/* The update                                                          */
/* ------------------------------------------------------------------ */

function masterSync_(dryRun, force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return; // a registration is being saved, try again in 5 minutes
  try {
    var src = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MASTER_SOURCE_TAB);
    if (!src || src.getLastRow() < 2) return;

    var props = PropertiesService.getScriptProperties();
    var sig = src.getLastRow() + ':' + src.getLastColumn();
    if (!dryRun && !force && props.getProperty('masterSyncSig') === sig) return;

    var data = src.getDataRange().getValues();
    var records = masterRecords_(data[0], data.slice(1));

    var sheet = SpreadsheetApp.openById(MASTER_FILE_ID).getSheets()[0];
    var layout = masterLayout_(sheet);
    var plan = masterPlan_(records, layout);

    if (dryRun) {
      Logger.log('Boys found in Registrations: ' + records.length);
      Logger.log('Would add ' + plan.adds.length + ' boys and stamp ' + plan.stamps.length + ' codes.');
      plan.adds.forEach(function (r) { Logger.log('  ADD ' + r.camp + ': ' + r.boy + ' (' + r.code + ') parent ' + r.parent); });
      plan.skipped.forEach(function (s) { Logger.log('  SKIPPED ' + s); });
      return;
    }

    // Stamp codes on rows that were already there.
    plan.stamps.forEach(function (s) { sheet.getRange(s.row, MASTER_COLS).setValue(s.code); });

    // Add new boys camp by camp. The layout is read again after each change.
    MASTER_SECTIONS.forEach(function (sec) {
      var boys = plan.adds.filter(function (r) { return r.camp === sec.key; });
      if (!boys.length) return;
      boys.sort(function (a, b) { return b.sortKey - a.sortKey; }); // newest first, like the sheet
      var lay = masterLayout_(sheet);
      if (!lay.sections[sec.key]) { masterAddSection_(sheet, lay, sec); lay = masterLayout_(sheet); }
      masterInsertBoys_(sheet, lay.sections[sec.key], sec, boys);
    });

    masterFinish_(sheet);
    props.setProperty('masterSyncSig', sig);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ------------------------------------------------------------------ */
/* Reading the registrations (pure, easy to test)                      */
/* ------------------------------------------------------------------ */

function mNorm_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/btm-\d+/g, ' ').replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function mTitle_(s) {
  return String(s || '').replace(/btm-\d+/gi, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s\-'(])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}

function mGet_(obj, names) {
  for (var i = 0; i < names.length; i++) {
    var v = obj[names[i]];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function mCampOf_(text) {
  var t = String(text || '').toLowerCase();
  if (t.indexOf('summer') >= 0 || t.indexOf('diaspora') >= 0) return 'summer';
  if (t.indexOf('arua') >= 0) return 'arua';
  if (t.indexOf('kampala') >= 0) return 'kampala';
  return '';
}

function mDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return { y: v.getFullYear(), m: v.getMonth(), d: v.getDate() };
  }
  var s = String(v || '');
  var a = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (a) return { y: +a[1], m: +a[2] - 1, d: +a[3] };
  var b = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (b) return { y: +b[3], m: +b[1] - 1, d: +b[2] };
  return null;
}

function mIsTest_(parent, boy, email) {
  var em = String(email || '').toLowerCase().trim();
  if (MASTER_OWN_EMAILS.indexOf(em) !== -1) return true;
  if (/banio luiji|\btest\b/i.test(parent + ' ' + boy)) return true;
  try { if (typeof isTest_ === 'function' && isTest_(parent, email)) return true; } catch (x) {}
  return false;
}

// Turns the rows of the Registrations tab into one record per boy.
function masterRecords_(headers, rows) {
  var out = [];
  rows.forEach(function (row, i) {
    var o = {};
    headers.forEach(function (h, c) { o[String(h).trim()] = row[c]; });

    var boy = mTitle_(mGet_(o, ['Boy 1 Name', 'Boy Name', 'Applicant Name']));
    if (!boy) return;

    var attending = mGet_(o, ['Who Is Attending', 'Registered By']);
    var himself = /himself/i.test(attending);
    var parentRaw = mGet_(o, ['Registrant Name', 'Parent Or Guardian', 'Full Name']);
    var parent = himself ? (boy + ' (himself)') : mTitle_(parentRaw);
    var email = mGet_(o, ['Registrant Email', 'Email']);

    var district = mGet_(o, ['District']);
    var country = mGet_(o, ['Country']);
    var place = district;
    if (country && !/^uganda$/i.test(country)) place = (district ? district + ', living in ' : '') + country;
    if (!place) { var from = mGet_(o, ['Applying From']); if (from && !/based in uganda/i.test(from)) place = from; }

    var plan = mGet_(o, ['Payment Note']);
    if (!plan) { var amt = mGet_(o, ['Amount Paying Now']); if (amt) plan = 'Paying now: ' + amt; }

    var d = mDate_(o['Submitted At']);
    out.push({
      code: mGet_(o, ['Boy ID']),
      boy: boy,
      age: mGet_(o, ['Boy 1 Age', 'Age']),
      parent: parent,
      email: email,
      phone: mGet_(o, ['Registrant Phone', 'Phone']),
      place: place,
      plan: plan,
      camp: mCampOf_(mGet_(o, ['Boy 1 Camp', 'Location'])),
      dup: mGet_(o, ['Possible Duplicate']),
      registeredOn: d ? (d.d + ' ' + MASTER_MONTHS[d.m] + ' ' + d.y) : '',
      sortKey: d ? (d.y * 10000 + (d.m + 1) * 100 + d.d) * 1000 + Math.min(i, 999) : i,
      test: mIsTest_(parent + ' ' + parentRaw, boy, email)
    });
  });
  return out;
}

// Decides who is new. "layout" is what masterLayout_ found in the master sheet.
function masterPlan_(records, layout) {
  var byCode = {}, byBoyEmail = {}, byBoyNoEmail = {};
  layout.rows.forEach(function (r) {
    var b = mNorm_(r.boy), e = mNorm_(r.email);
    if (r.code) byCode[r.code] = r;
    if (b) { byBoyEmail[b + '|' + e] = r; if (!e) byBoyNoEmail[b + '|' + r.section] = r; }
  });

  var plan = { adds: [], stamps: [], skipped: [] };
  var seen = {};
  records.forEach(function (rec) {
    if (rec.test) return;
    if (!rec.camp) { plan.skipped.push(rec.boy + ': camp not recognised'); return; }
    var b = mNorm_(rec.boy), e = mNorm_(rec.email);
    var key = b + '|' + e + '|' + rec.camp;
    if (seen[key]) return; // the same boy twice in Registrations: one row only
    seen[key] = true;

    var hit = (rec.code && byCode[rec.code]) || byBoyEmail[b + '|' + e] || byBoyNoEmail[b + '|' + rec.camp];
    if (hit) {
      if (rec.code && !hit.code) plan.stamps.push({ row: hit.row, code: rec.code });
      return;
    }
    plan.adds.push(rec);
  });
  return plan;
}

/* ------------------------------------------------------------------ */
/* Reading and writing the master sheet                                */
/* ------------------------------------------------------------------ */

// Finds each camp block, its header row, its Subtotal row and the TOTAL row.
function masterLayout_(sheet) {
  var lastRow = sheet.getLastRow();
  var vals = lastRow ? sheet.getRange(1, 1, lastRow, MASTER_COLS).getValues() : [];
  var lay = { sections: {}, rows: [], totalRow: 0, lastRow: lastRow };
  var cur = null;

  for (var i = 0; i < vals.length; i++) {
    var r = i + 1, a = String(vals[i][0]).trim(), b = String(vals[i][1]).trim();
    var sec = MASTER_SECTIONS.filter(function (s) { return a.toUpperCase().indexOf(s.prefix) === 0; })[0];
    if (sec) { cur = lay.sections[sec.key] = { key: sec.key, titleRow: r, headerRow: 0, subtotalRow: 0 }; continue; }
    if (b === 'TOTAL ALL CAMPS') { lay.totalRow = r; cur = null; continue; }
    if (!cur) continue;
    if (a === 'No.') { cur.headerRow = r; continue; }
    if (b === 'Subtotal') { cur.subtotalRow = r; cur = null; continue; }
    if (cur.headerRow && (vals[i][2] !== '' || vals[i][1] !== '')) {
      lay.rows.push({ row: r, section: cur.key, boy: String(vals[i][2]), email: String(vals[i][5]), code: String(vals[i][16]).trim() });
    }
  }
  return lay;
}

// Makes a new camp block just above the TOTAL row.
function masterAddSection_(sheet, lay, sec) {
  var at = lay.totalRow || (lay.lastRow + 1);
  sheet.insertRowsBefore(at, 4); // title, header, subtotal, blank
  sheet.getRange(at, 1).setValue(sec.title).setFontWeight('bold');
  var anyHeader = null;
  Object.keys(lay.sections).forEach(function (k) { if (lay.sections[k].headerRow) anyHeader = lay.sections[k].headerRow; });
  if (anyHeader) {
    var src = sheet.getRange(anyHeader, 1, 1, MASTER_COLS);
    src.copyTo(sheet.getRange(at + 1, 1, 1, MASTER_COLS));
  } else {
    sheet.getRange(at + 1, 1, 1, MASTER_COLS).setValues([['No.', 'Parent or applicant', 'Boy or young man', 'Age', 'Registered on', 'Email', 'Phone', 'District or country', 'Payment plan stated', 'Fee (UGX)', 'Booking fee due (UGX)', 'Paid so far (UGX)', 'Balance (UGX)', 'Reply status', 'Added to WhatsApp', 'Notes', 'Boy code']]).setFontWeight('bold');
  }
  sheet.getRange(at + 2, 2).setValue('Subtotal').setFontWeight('bold');
}

// Puts new boys at the top of their camp block, under the header row.
function masterInsertBoys_(sheet, section, sec, boys) {
  var first = section.headerRow + 1;
  var below = first; // the row that is now below the insertion point
  sheet.insertRowsAfter(section.headerRow, boys.length);
  var belowIsData = String(sheet.getRange(below + boys.length, 2).getValue()).trim() !== 'Subtotal';
  if (belowIsData) {
    sheet.getRange(below + boys.length, 1, 1, MASTER_COLS).copyTo(sheet.getRange(first, 1, boys.length, MASTER_COLS), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
  var values = boys.map(function (r, i) {
    var row = first + i;
    var note = r.dup ? 'Possible duplicate, check before calling' : '';
    return ['', r.parent, r.boy, r.age, r.registeredOn, r.email, r.phone, r.place, r.plan,
            sec.fee, sec.booking, '', '=N(J' + row + ')-N(L' + row + ')', 'New', '', note, r.code];
  });
  sheet.getRange(first, 7, boys.length, 1).setNumberFormat('@'); // keep +256 numbers as typed
  sheet.getRange(first, 1, boys.length, MASTER_COLS).setValues(values);
}

// Numbers the rows again and fixes every Subtotal and the TOTAL row.
function masterFinish_(sheet) {
  var lay = masterLayout_(sheet);
  var subtotals = [];
  MASTER_SECTIONS.forEach(function (sec) {
    var s = lay.sections[sec.key];
    if (!s || !s.headerRow || !s.subtotalRow) return;
    var first = s.headerRow + 1, last = s.subtotalRow - 1;
    if (!sheet.getRange(s.headerRow, MASTER_COLS).getValue()) sheet.getRange(s.headerRow, MASTER_COLS).setValue('Boy code').setFontWeight('bold');
    if (last >= first) {
      var n = last - first + 1, nums = [];
      for (var k = 1; k <= n; k++) nums.push([k]);
      sheet.getRange(first, 1, n, 1).setValues(nums);
      sheet.getRange(s.subtotalRow, 3).setFormula('=COUNTA(C' + first + ':C' + last + ')');
      ['J', 'K', 'L', 'M'].forEach(function (c) { sheet.getRange(c + s.subtotalRow).setFormula('=SUM(' + c + first + ':' + c + last + ')'); });
    }
    subtotals.push(s.subtotalRow);
  });
  if (lay.totalRow && subtotals.length) {
    sheet.getRange(lay.totalRow, 3).setFormula('=' + subtotals.map(function (r) { return 'C' + r; }).join('+'));
    ['J', 'K', 'L', 'M'].forEach(function (c) {
      sheet.getRange(c + lay.totalRow).setFormula('=' + subtotals.map(function (r) { return c + r; }).join('+'));
    });
  }
}
