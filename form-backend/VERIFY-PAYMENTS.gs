/**
 * Boys to Men: check proof of payment against Centenary Bank alerts, then send the receipt.
 *
 * HOW IT WORKS
 * Every minute this script looks at the proof of payment rows that have not been checked yet.
 * A row is left alone for the first 3 minutes so the bank alert has time to arrive.
 * It then reads the Centenary credit alerts in this Gmail inbox and looks for the payment.
 *
 *   Verified      the bank reference, the amount and the date all agree with one alert
 *                 (or, when no reference can be matched, the amount, the date and the
 *                 depositor name agree with exactly one alert).
 *   Pending       no matching alert yet. It tries again after 10 minutes, 30 minutes
 *                 and 2 hours.
 *   Needs Review  something does not agree, or the alert never came. You get one email.
 *
 * Each bank reference can be used for one payment only, so one genuine payment can never
 * be claimed by two families. A Finance Department receipt is made and emailed only when
 * a payment is Verified.
 *
 * To confirm a payment by hand, type Approved in the "Verify Status" cell of its row
 * (and the bank reference in "Bank Ref" if you have it). The next minute it is treated
 * as verified and the receipt goes out.
 *
 * This file is added BELOW the live script. It does not change doPost. All its names
 * start with vp so they cannot clash with the live script.
 * Setup: see PASTE-VERIFY-PAYMENTS.txt
 */

var VP = {
  BANK_SENDER: 'notifications@centenarybank.co.ug',
  ACCOUNT_ENDS_WITH: '782',          // only alerts for the account ending in this are used
  PROOF_TAB_NAME: '',                // leave empty and the script finds the proof tab by its headings
  REGISTRATIONS_TAB: 'Registrations',
  MIN_AGE_MINUTES: 3,
  CHECK_AT_MINUTES: [3, 10, 30, 120],
  DATE_TOLERANCE_DAYS: 1,
  LOOKBACK_DAYS: 14,
  MAX_ROWS_PER_RUN: 6,
  INCLUDE_ROWS_FROM: '',             // for example '2026-11-01 00:00' to also check older rows. Empty means only rows from the day vpStart is first run.
  ALERT_EMAIL: '',                   // empty means the Google account that owns this script
  REPLY_TO: 'info@potentialunexplored.com',
  SEND_FROM: 'info@potentialunexplored.com', // used only if it is a "Send mail as" address in this Gmail
  RECEIPT_ADDRESS: '',               // the full address with the box number. Receipts wait until this is filled.
  FINANCE_CONTACT: 'Kokora Patricia, +256 775 502 323',
  SEND_CAMP_DOCUMENTS: false,        // leave false if the live script already sends the camp documents. When true, the Camp Guidelines are sent only with an admission letter for every boy.
  DATABASE_FOLDER: 'Potential Unexplored Database',
  CAMP_DOCS_FOLDER: 'Camp Documents',
  RECEIPT_FOLDER: 'Finance Receipts',
  LOGO_PUL: 'https://boystomencamp.com/pul-logo.png',
  LOGO_B2M: 'https://boystomencamp.com/b2m-logo.png',
  TZ: 'Africa/Kampala'
};

// Columns this script adds to the proof tab, in this order.
var VP_COLS = ['Verify Status', 'Verify Note', 'Verify Attempts', 'Verify Checked At', 'Bank Ref', 'Bank Amount',
  'Bank Time', 'Receipt No', 'Receipt Link', 'Receipt Sent At', 'Docs Sent At'];
var VP_USED_TAB = 'Bank Refs Used';

/* ------------------------------------------------------------------ */
/* Buttons you run from the Apps Script editor                         */
/* ------------------------------------------------------------------ */

// Looks only. Writes nothing and sends nothing. Read the Execution log afterwards.
function vpPreview() { vpRun_(true); }

// Starts the every minute check.
function vpStart() {
  if (!VP.RECEIPT_ADDRESS) {
    throw new Error('Please fill in RECEIPT_ADDRESS at the top of this file first (the full address with the box number), then run vpStart again.');
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VP_START_MS')) props.setProperty('VP_START_MS', String(Date.now()));
  vpStop();
  ScriptApp.newTrigger('vpTick').timeBased().everyMinutes(1).create();
  vpTick();
}

// Stops only this check. Other timers are left alone.
function vpStop() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'vpTick') ScriptApp.deleteTrigger(t);
  });
}

function vpTick() {
  try { vpRun_(false); } catch (err) { console.error('vpTick: ' + err); }
}

/* ------------------------------------------------------------------ */
/* The main run                                                        */
/* ------------------------------------------------------------------ */

function vpRun_(dry) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = vpFindProofSheet_(ss);
    if (!sheet || sheet.getLastRow() < 2) { if (dry) console.log('No proof of payment rows found.'); return; }
    vpHead_ = null;
    if (!dry) vpEnsureColumns_(sheet);

    var data = sheet.getDataRange().getValues();
    var head = data[0];
    var get = function (row, n) { var c = head.indexOf(n); return c < 0 ? '' : row[c]; };
    var tz = ss.getSpreadsheetTimeZone();
    var cutoff = vpCutoffMs_();
    if (dry && !cutoff) console.log('No start time is set yet, so every row is shown. vpStart sets it, and rows from before it are left alone.');

    var due = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!String(get(row, 'Amount Paid') || '').trim() && !String(get(row, 'Transaction ID') || '').trim()) continue;   // not a payment row
      var status = String(get(row, 'Verify Status') || '').trim();
      var submittedMs = vpSubmittedMs_(get(row, 'Submitted At'), tz);
      if (cutoff && status !== 'Approved' && (!submittedMs || submittedMs < cutoff)) continue;   // older than the start time
      var needsDocs = VP.SEND_CAMP_DOCUMENTS && !String(get(row, 'Docs Sent At') || '').trim();
      var finished = status === 'Needs Review' || status === 'Receipt Failed' || (status === 'Verified' && String(get(row, 'Receipt Sent At') || '').trim());
      if (finished && !needsDocs) continue;
      due.push({ r: r, row: row, status: status, docsOnly: finished, submittedMs: submittedMs });
      if (due.length >= VP.MAX_ROWS_PER_RUN) break;
    }
    if (!due.length) return;

    var alerts = null, used = null, regs = null, review = [];
    var write = function (rowNo, name, value) { if (!dry) vpSet_(sheet, rowNo, name, value); };

    due.forEach(function (d) {
      var rowNo = d.r + 1;
      var row = d.row;
      var phone = String(get(row, 'Phone') || '');
      var proof = {
        txnId: String(get(row, 'Transaction ID') || ''),
        amount: vpAmount_(get(row, 'Amount Paid')),
        day: vpDay_(get(row, 'Date Paid'), tz),
        name: String(get(row, 'Full Name') || '')
      };
      var email = String(get(row, 'Email') || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) email = dry ? '' : vpEmailFromRegs_(ss, phone);
      var ageMin = d.submittedMs ? (Date.now() - d.submittedMs) / 60000 : 999;
      var item = function (note) { return { rowNo: rowNo, name: proof.name, phone: phone, amount: String(get(row, 'Amount Paid') || ''), txn: proof.txnId, note: note }; };

      // Optional: the three camp documents go out straight away, before any checking.
      if (VP.SEND_CAMP_DOCUMENTS && !String(get(row, 'Docs Sent At') || '').trim() && !dry) {
        if (!regs) regs = vpLoadRegs_(ss);
        if (!email) write(rowNo, 'Docs Sent At', 'No email address');
        else {
          try {
            var sent = vpSendDocs_(email, proof.name, vpBoys_(String(get(row, 'Boy Name Or Reference') || ''), regs), sheet, rowNo);
            if (!sent.sent) {
              var why = 'Held, no admission letter yet for ' + sent.missing.join(', ') + '. Nothing was sent. Save the letter, then clear this cell to send.';
              write(rowNo, 'Docs Sent At', why);
              review.push(item(why));
            }
          } catch (e) { write(rowNo, 'Docs Sent At', 'Failed ' + String(e).slice(0, 80)); }
        }
      }
      if (d.docsOnly) return;

      var result;
      if (d.status === 'Approved') {
        // Confirmed by the team by hand.
        var typedRef = String(get(row, 'Bank Ref') || '').trim();
        result = { status: 'verified', method: 'Approved by the team', note: '',
          alert: { ref: typedRef, amount: proof.amount ? proof.amount.value : '', when: '' } };
      } else if (d.status === 'Verified') {
        result = { status: 'verified', already: true };
      } else {
        var attempts = parseInt(get(row, 'Verify Attempts'), 10) || 0;
        var dueAt = VP.CHECK_AT_MINUTES[Math.min(attempts, VP.CHECK_AT_MINUTES.length - 1)];
        if (ageMin < Math.max(VP.MIN_AGE_MINUTES, dueAt)) return;     // not time yet
        if (!alerts) { alerts = vpLoadAlerts_(); used = vpLoadUsed_(ss); }
        result = vpMatch_(proof, alerts, used);
        write(rowNo, 'Verify Checked At', vpNow_());
        if (result.status === 'pending') {
          attempts++;
          write(rowNo, 'Verify Attempts', attempts);
          if (attempts >= VP.CHECK_AT_MINUTES.length) {
            result = { status: 'review', note: 'No matching bank alert after ' + Math.round(ageMin) + ' minutes. ' + vpCandidateText_(result.candidates) };
          } else {
            write(rowNo, 'Verify Status', 'Pending');
            write(rowNo, 'Verify Note', 'Waiting for the bank alert (check ' + attempts + ' of ' + VP.CHECK_AT_MINUTES.length + ')');
            if (dry) console.log('Row ' + rowNo + ' (' + proof.name + '): no bank alert yet, would check again later.');
            return;
          }
        }
      }

      if (result.status === 'review') {
        write(rowNo, 'Verify Status', 'Needs Review');
        write(rowNo, 'Verify Note', result.note);
        review.push(item(result.note));
        if (dry) console.log('Row ' + rowNo + ' (' + proof.name + '): NEEDS REVIEW. ' + result.note);
        return;
      }

      // Verified from here on.
      if (!result.already) {
        var a = result.alert;
        if (dry) { console.log('Row ' + rowNo + ' (' + proof.name + '): WOULD VERIFY. ' + result.method + ', bank ref ' + (a.ref || 'none') + '.'); return; }
        write(rowNo, 'Verify Status', 'Verified');
        write(rowNo, 'Verify Note', result.method);
        write(rowNo, 'Bank Ref', a.ref || '');
        write(rowNo, 'Bank Amount', a.amount || '');
        write(rowNo, 'Bank Time', a.when || '');
        if (!used) used = vpLoadUsed_(ss);
        if (a.ref) { vpMarkUsed_(ss, a, rowNo, proof.name); used[vpNorm_(a.ref)] = 'row ' + rowNo; }
        row = row.slice(); row[head.indexOf('Bank Ref')] = a.ref || '';
      } else if (dry) { console.log('Row ' + rowNo + ' is verified, receipt not sent yet.'); return; }

      if (dry) return;
      if (!VP.RECEIPT_ADDRESS) { write(rowNo, 'Verify Note', 'Verified. Receipt on hold until RECEIPT_ADDRESS is filled in.'); return; }

      if (!regs) regs = vpLoadRegs_(ss);
      try {
        var out = vpIssueReceipt_(ss, {
          parent: proof.name, to: email, amount: proof.amount ? proof.amount.value : 0,
          paidDay: proof.day, boys: vpBoys_(String(get(row, 'Boy Name Or Reference') || ''), regs),
          bankRef: String(get(row, 'Bank Ref') || '') || (result.alert && result.alert.ref) || '',
          proofLink: String(get(row, 'Proof of Payment Link') || '')
        });
        write(rowNo, 'Receipt No', out.no);
        write(rowNo, 'Receipt Link', out.link);
        write(rowNo, 'Receipt Sent At', email ? vpNow_() : 'Saved, no email address');
        if (!email) review.push(item('Verified, but there is no email address for this parent. Receipt ' + out.no + ' is saved in Drive.'));
      } catch (e) {
        write(rowNo, 'Verify Status', 'Receipt Failed');
        write(rowNo, 'Verify Note', 'Verified, but the receipt failed: ' + String(e).slice(0, 120));
        review.push(item('Payment verified, but making or sending the receipt failed. ' + String(e).slice(0, 120)));
      }
    });

    if (review.length && !dry) vpSendReviewEmail_(review, ss);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Rows submitted before this moment are left alone. vpStart sets it the first time it runs.
function vpCutoffMs_() {
  if (VP.INCLUDE_ROWS_FROM) {
    var m = VP.INCLUDE_ROWS_FROM.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0) - 3, +(m[5] || 0));
  }
  return parseInt(PropertiesService.getScriptProperties().getProperty('VP_START_MS'), 10) || 0;
}

/* ------------------------------------------------------------------ */
/* Reading the bank alerts                                             */
/* ------------------------------------------------------------------ */

// Turns one Centenary alert into plain facts. Returns null if it is not a credit to our account.
function vpParseAlert_(subject, body, id) {
  var text = String(body || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  var isCredit = /CREDIT/i.test(String(subject)) || /Transaction Type:\s*CREDIT/i.test(text);
  if (!isCredit) return null;
  var acct = text.match(/account ending with\s*\**\s*(\d+)/i);
  if (VP.ACCOUNT_ENDS_WITH && acct && acct[1].slice(-VP.ACCOUNT_ENDS_WITH.length) !== VP.ACCOUNT_ENDS_WITH) return null;
  var amt = text.match(/Transaction Amount:\s*UGX\s*([\d,\.]+)/i);
  var when = text.match(/Transaction Date:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  var ref = text.match(/Transaction Ref:\s*([A-Za-z0-9\-\/]+)/i);
  if (!amt || !when || !ref) return null;
  var desc = text.match(/Transaction Description:\s*(.*?)\s*Transaction Ref:/i);
  var sub = String(subject).match(/\((.*)\)\s*$/);
  var amount = parseInt(amt[1].replace(/[,\.]/g, ''), 10);
  var detail = ((sub ? sub[1] : '') + ' ' + (desc ? desc[1] : '')).trim();
  return {
    id: id || '', ref: ref[1], amount: amount, day: when[1], when: when[1] + ' ' + when[2],
    detail: detail, hay: detail.toLowerCase().replace(/[^a-z0-9]/g, '')
  };
}

function vpLoadAlerts_() {
  var out = [], seen = {};
  var threads = GmailApp.search('from:' + VP.BANK_SENDER + ' newer_than:' + VP.LOOKBACK_DAYS + 'd', 0, 150);
  GmailApp.getMessagesForThreads(threads).forEach(function (msgs) {
    msgs.forEach(function (m) {
      var a = vpParseAlert_(m.getSubject(), m.getPlainBody(), m.getId());
      if (a && !seen[a.ref]) { seen[a.ref] = true; out.push(a); }
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

function vpNorm_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function vpDayNo_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

// Reads text like "UGX 50,000 (paid on 7 Nov 2026)", "50k" or "USD 50".
function vpAmount_(v) {
  if (typeof v === 'number') return { value: v, currency: 'UGX' };
  var s = String(v || '').split('(')[0].trim();
  if (!s) return null;
  var currency = /USD|\$|dollar/i.test(s) ? 'USD' : (/EUR|GBP|KES|SSP/i.test(s) ? 'OTHER' : 'UGX');
  var t = s.replace(/,/g, '');
  var k = /(\d+(?:\.\d+)?)\s*k\b/i.exec(t);
  if (k) return { value: Math.round(parseFloat(k[1]) * 1000), currency: currency };
  t = t.replace(/\d{1,3}(?:\.\d{3})+(?!\d)/g, function (x) { return x.replace(/\./g, ''); });
  var m = t.match(/\d+(\.\d+)?/);
  return m ? { value: Math.round(parseFloat(m[0])), currency: currency } : null;
}

// The Date Paid cell may be text (2026-11-07) or a real date.
function vpDay_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz || VP.TZ, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

// Submitted At is written in Kampala time. Returns milliseconds, or 0 if it cannot be read.
function vpSubmittedMs_(v, tz) {
  var s = (v instanceof Date) ? Utilities.formatDate(v, tz || VP.TZ, 'yyyy-MM-dd HH:mm:ss') : String(v || '');
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 3, +m[5], +(m[6] || 0));   // Kampala is UTC+3
}

function vpCandidateText_(cands) {
  if (!cands || !cands.length) return 'No bank alert with that amount was found around that date.';
  return 'Possible bank alerts: ' + cands.slice(0, 4).map(function (a) {
    return 'UGX ' + vpMoney_(a.amount) + ' on ' + a.when + ' ref ' + a.ref + (a.detail ? ' (' + a.detail + ')' : '');
  }).join(' | ');
}

// p = { txnId, amount:{value,currency}, day, name }   alerts = list from vpParseAlert_   used = { NORMREF: 'row N' }
function vpMatch_(p, alerts, used) {
  if (!p.amount) return { status: 'review', note: 'The amount could not be read. Please check this payment by hand.' };
  if (p.amount.currency !== 'UGX') return { status: 'review', note: 'Paid in ' + p.amount.currency + '. The bank alerts show UGX, so please check this payment by hand.' };
  var tol = VP.DATE_TOLERANCE_DAYS;
  var nearDay = function (a) {
    if (!p.day) return true;
    var x = vpDayNo_(a.day), y = vpDayNo_(p.day);
    return x === null || y === null || Math.abs(x - y) <= tol;
  };
  var free = function (a) { return !used[vpNorm_(a.ref)]; };

  var typed = vpNorm_(p.txnId);
  if (typed.length >= 6) {
    var hits = alerts.filter(function (a) {
      var r = vpNorm_(a.ref);
      return r && (r === typed || (typed.length >= 8 && (typed.indexOf(r) >= 0 || r.indexOf(typed) >= 0)));
    });
    if (hits.length > 1) return { status: 'review', note: 'More than one bank alert fits that transaction ID.' };
    if (hits.length === 1) {
      var h = hits[0];
      if (!free(h)) return { status: 'review', note: 'This bank reference (' + h.ref + ') was already used for ' + used[vpNorm_(h.ref)] + '. Please check.' };
      if (h.amount !== p.amount.value) return { status: 'review', note: 'The reference matches a bank alert, but the amounts differ. The bank shows UGX ' + vpMoney_(h.amount) + ' and the parent wrote UGX ' + vpMoney_(p.amount.value) + '.' };
      if (!nearDay(h)) return { status: 'review', note: 'The reference and amount match, but the bank date is ' + h.day + ' and the parent wrote ' + p.day + '.' };
      return { status: 'verified', method: 'Matched on bank reference, amount and date', note: '', alert: h };
    }
  }

  var cands = alerts.filter(function (a) { return free(a) && a.amount === p.amount.value && nearDay(a); });
  var tokens = String(p.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 3; });
  var named = cands.filter(function (a) { return tokens.some(function (t) { return a.hay.indexOf(t) >= 0; }); });
  if (named.length === 1) return { status: 'verified', method: 'Matched on amount, date and depositor name', note: '', alert: named[0] };
  return { status: 'pending', candidates: cands };
}

/* ------------------------------------------------------------------ */
/* Which boys, and where to send                                       */
/* ------------------------------------------------------------------ */

function vpLoadRegs_(ss) {
  var sh = ss.getSheetByName(VP.REGISTRATIONS_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), h = v[0];
  var cB = h.indexOf('Boy ID'), cF = h.indexOf('Family ID'), cN = h.indexOf('Applicant Name');
  if (cN < 0) return [];
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][cN]) continue;
    out.push({ boyId: cB < 0 ? '' : String(v[i][cB]).toUpperCase(), familyId: cF < 0 ? '' : String(v[i][cF]).toUpperCase(), name: String(v[i][cN]).trim() });
  }
  return out;
}

// Works out the full names of the boys a payment covers, from codes or from names the parent typed.
function vpBoys_(text, regs) {
  var out = [], seen = {};
  var add = function (n) { var k = String(n).toLowerCase(); if (n && !seen[k]) { seen[k] = 1; out.push(n); } };
  var codes = String(text || '').toUpperCase().match(/BTM-\d+/g) || [];
  codes.forEach(function (c) {
    var byBoy = regs.filter(function (r) { return r.boyId === c; });
    var byFam = regs.filter(function (r) { return r.familyId === c; });
    if (codes.length === 1 && byFam.length > 1) byFam.forEach(function (r) { add(r.name); });   // a family reference means the whole family
    else if (byBoy.length) add(byBoy[0].name);
    else byFam.forEach(function (r) { add(r.name); });
  });
  if (!codes.length) {
    var t = String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    regs.forEach(function (r) {
      var n = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n.length >= 5 && t.indexOf(n) >= 0) add(r.name);
    });
  }
  if (!out.length) String(text || '').split(/[,\n]+|\band\b/i).forEach(function (s) { s = s.trim(); if (s) add(s); });
  return out;
}

function vpEmailFromRegs_(ss, phone) {
  var sh = ss.getSheetByName(VP.REGISTRATIONS_TAB);
  var p9 = String(phone || '').replace(/\D/g, '').slice(-9);
  if (!sh || sh.getLastRow() < 2 || !p9) return '';
  var v = sh.getDataRange().getValues(), h = v[0];
  var cP = h.indexOf('Phone'), cE = h.indexOf('Email'), cRE = h.indexOf('Registrant Email');
  for (var i = v.length - 1; i >= 1; i--) {
    if (cP >= 0 && String(v[i][cP]).replace(/\D/g, '').slice(-9) === p9) {
      var e = String((cE >= 0 && v[i][cE]) || (cRE >= 0 && v[i][cRE]) || '').trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return e;
    }
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* The receipt                                                         */
/* ------------------------------------------------------------------ */

function vpMoney_(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function vpEsc_(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function vpNiceDay_(day) {
  var m = String(day || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  var mon = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return m ? (parseInt(m[3], 10) + ' ' + mon[parseInt(m[2], 10) - 1] + ' ' + m[1]) : String(day || '');
}

// Builds the receipt page. d = { no, issued, parent, amount, paidDay, boys[], bankRef, logoPul, logoB2m }
function vpReceiptHtml_(d) {
  var green = '#1B5E20', gold = '#C9A227', cream = '#FBF5E6';
  var logo = function (src, alt, align) { return src ? '<img src="' + src + '" alt="' + alt + '" height="58" style="height:58px;">' : '<b style="color:#fff">' + alt + '</b>'; };
  var boys = (d.boys && d.boys.length ? d.boys : ['(not stated)']).map(function (n) { return '<div style="padding:2px 0;">' + vpEsc_(n) + '</div>'; }).join('');
  var row = function (label, value) {
    return '<tr><td style="padding:9px 12px;width:34%;color:#1B5E20;font-weight:bold;border-bottom:1px solid #E4D9B8;">' + label + '</td><td style="padding:9px 12px;border-bottom:1px solid #E4D9B8;">' + value + '</td></tr>';
  };
  return '<html><body style="margin:0;padding:0;background-color:' + cream + ';font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:' + cream + ';"><tr><td>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:' + green + ';"><tr>' +
    '<td style="padding:14px 22px;" align="left">' + logo(d.logoPul, 'Potential Unexplored Ltd') + '</td>' +
    '<td style="padding:14px 22px;color:#fff;font-size:9.5pt;line-height:1.5;" align="center">potentialunexplored.com<br>info@potentialunexplored.com<br>' + vpEsc_(VP.RECEIPT_ADDRESS) + '</td>' +
    '<td style="padding:14px 22px;" align="right">' + logo(d.logoB2m, 'Boys to Men') + '</td></tr></table>' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td height="4" width="40%" style="background-color:' + green + ';font-size:1px;">&nbsp;</td><td height="4" width="20%" style="background-color:' + gold + ';font-size:1px;">&nbsp;</td><td height="4" width="40%" style="background-color:' + green + ';font-size:1px;">&nbsp;</td></tr></table>' +
    '<div style="padding:26px 34px 8px;">' +
    '<div style="font-size:22pt;font-weight:bold;color:' + green + ';">Official Receipt</div>' +
    '<div style="font-size:11pt;color:#000;padding-top:2px;">Finance Department, Boys to Men Mentorship Camp</div>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr><td><b>Receipt number</b><br>' + vpEsc_(d.no) + '</td><td align="right"><b>Date issued</b><br>' + vpEsc_(d.issued) + '</td></tr></table>' +
    '</div>' +
    '<div style="padding:8px 34px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ' + green + ';border-collapse:collapse;">' +
    row('Received from', vpEsc_(d.parent)) +
    row('Amount received', '<b>UGX ' + vpMoney_(d.amount) + '</b>') +
    row('Payment made on', vpEsc_(vpNiceDay_(d.paidDay))) +
    row('Payment is for', boys) +
    row('Paid into', 'Centenary Bank, account of Potential Unexplored Limited') +
    row('Bank reference', vpEsc_(d.bankRef || 'Confirmed by the Finance Department')) +
    '</table></div>' +
    '<div style="padding:18px 34px 0;font-size:10.5pt;text-align:justify;">This payment was checked against the bank\'s own transaction record before this receipt was issued. It counts toward the camp fee. The booking fee is not refundable once paid. Please keep this receipt for your records.</div>' +
    '<div style="padding:46px 34px 18px;" align="center"><div style="border-top:1px solid ' + green + ';padding-top:8px;font-size:10pt;">Finance Department, Boys to Men Mentorship Camp<br>For any question about this receipt, please contact ' + vpEsc_(VP.FINANCE_CONTACT) + '</div></div>' +
    '</td></tr></table></body></html>';
}

function vpLogoData_(url) {
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return '';
    var b = resp.getBlob();
    return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
  } catch (e) { return ''; }
}

function vpNextReceiptNo_() {
  var props = PropertiesService.getScriptProperties();
  var n = parseInt(props.getProperty('NEXT_RECEIPT_NO'), 10);
  if (!(n >= 1001)) n = 1001;
  props.setProperty('NEXT_RECEIPT_NO', String(n + 1));
  return 'BTM-R-' + n;
}

function vpFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function vpReceiptFolder_() {
  var root = DriveApp.getFoldersByName(VP.DATABASE_FOLDER);
  var base = root.hasNext() ? root.next() : DriveApp.getRootFolder();
  return vpFolder_(base, VP.RECEIPT_FOLDER);
}

// Makes the PDF, saves it in Drive and emails it with a copy of the parent's proof. Returns { no, link }.
function vpIssueReceipt_(ss, d) {
  var no = vpNextReceiptNo_();
  var issued = vpNiceDay_(Utilities.formatDate(new Date(), VP.TZ, 'yyyy-MM-dd'));
  var html = vpReceiptHtml_({
    no: no, issued: issued, parent: d.parent, amount: d.amount, paidDay: d.paidDay, boys: d.boys, bankRef: d.bankRef,
    logoPul: vpLogoData_(VP.LOGO_PUL), logoB2m: vpLogoData_(VP.LOGO_B2M)
  });
  var fileName = 'Receipt ' + no + ' - ' + String(d.parent).replace(/[^A-Za-z0-9 ]/g, '').trim() + ' - Boys to Men.pdf';
  var pdf = Utilities.newBlob(html, 'text/html', 'receipt.html').getAs('application/pdf').setName(fileName);
  var file = vpReceiptFolder_().createFile(pdf);
  var link = file.getUrl();

  if (d.to) {
    var attachments = [pdf];
    var pid = String(d.proofLink || '').match(/(?:\/d\/|id=)([-\w]{20,})/);
    if (pid) { try { attachments.push(DriveApp.getFileById(pid[1]).getBlob()); } catch (e) {} }
    var names = (d.boys && d.boys.length) ? d.boys.join(', ') : 'your boy';
    var lines = [
      'Hello ' + d.parent + ',',
      'Thank you. We have received your payment of UGX ' + vpMoney_(d.amount) + ' for ' + names + '. We checked it against the bank record and it is confirmed.',
      'Your official receipt is attached, numbered ' + no + '. We have also attached a copy of the proof of payment you uploaded, for your own records.',
      'If you are paying in instalments, please remember that the balance of the camp fee is completed 7 days before the camp. If you have not yet had your call from our team, you will get one soon, and you are welcome to call us sooner if you have any question.',
      'Warm regards,',
      'Finance Department',
      'Boys to Men Mentorship Camp',
      VP.FINANCE_CONTACT
    ];
    var htmlBody = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:560px;">' +
      lines.map(function (l, i) { return '<p style="margin:0 0 18px;">' + vpEsc_(l).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</div>';
    var opts = { name: 'Boys to Men Camp, Finance', replyTo: VP.REPLY_TO, htmlBody: htmlBody, attachments: attachments };
    var subject = 'Your Boys to Men payment receipt ' + no;
    try {
      if (VP.SEND_FROM) GmailApp.sendEmail(d.to, subject, lines.join('\n\n'), { name: opts.name, replyTo: opts.replyTo, htmlBody: htmlBody, attachments: attachments, from: VP.SEND_FROM });
      else GmailApp.sendEmail(d.to, subject, lines.join('\n\n'), opts);
    } catch (e) {
      GmailApp.sendEmail(d.to, subject, lines.join('\n\n'), opts);   // the sender address is not set up, so use the account itself
    }
  }
  return { no: no, link: link };
}

/* ------------------------------------------------------------------ */
/* Camp documents (only when SEND_CAMP_DOCUMENTS is true)               */
/* ------------------------------------------------------------------ */

// Finds a boy's admission letter, for example "Admission Letter- Brian Okello- Boys to Men".
function vpFindLetter_(folders, boyName) {
  var want = String(boyName).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (var i = 0; i < folders.length; i++) {
    var it = folders[i].getFiles();
    while (it.hasNext()) {
      var f = it.next();
      var n = f.getName().toLowerCase();
      if (/admission letter/.test(n) && n.replace(/[^a-z0-9]/g, '').indexOf(want) >= 0) return f;
    }
  }
  return null;
}

// Sends the camp documents. The Camp Guidelines go out ONLY together with an admission letter for every boy.
// If any boy has no letter yet, nothing is sent. Returns { sent: true } or { sent: false, missing: [names] }.
function vpSendDocs_(to, parent, boys, sheet, rowNo) {
  var root = DriveApp.getFoldersByName(VP.DATABASE_FOLDER);
  if (!root.hasNext()) throw new Error('Folder not found');
  var docs = root.next().getFoldersByName(VP.CAMP_DOCS_FOLDER);
  if (!docs.hasNext()) throw new Error('Camp Documents folder not found');
  var folder = docs.next();
  var searchIn = [folder], subs = folder.getFolders();
  while (subs.hasNext()) searchIn.push(subs.next());

  var names = (boys && boys.length) ? boys : [];
  if (!names.length) return { sent: false, missing: ['(no boy could be identified from this payment)'] };
  var letters = [], missing = [];
  names.forEach(function (n) {
    var f = vpFindLetter_(searchIn, n);
    if (f) letters.push(f.getBlob()); else missing.push(n);
  });
  if (missing.length) return { sent: false, missing: missing };

  var wanted = [/camp information/i, /medical/i, /camp guidelines/i];
  var files = [];
  wanted.forEach(function (re) {
    var it = folder.getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (re.test(f.getName()) && /boys to men/i.test(f.getName()) && !/combined/i.test(f.getName())) { files.push(f.getBlob()); break; }
    }
  });
  if (files.length < 3) throw new Error('Found only ' + files.length + ' of the 3 camp documents');

  var nameText = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  var lines = [
    'Hello ' + parent + ',',
    'Thank you for sending your proof of payment. To help you prepare, we have attached ' + (names.length > 1 ? 'the admission letters for ' : 'the admission letter for ') + nameText + ', together with the Camp Information and Requirements, the Basic Medical Examination Form and the Camp Guidelines for Boys.',
    'Please share ' + (names.length > 1 ? 'each letter with the boy it is addressed to' : 'the letter with him') + ', and reply to this email to say you agree to the camp terms. If you have any question, you are welcome to speak to our team.',
    'Warm regards,', 'Boys to Men Mentorship Camp'
  ];
  var attachments = letters.concat(files);
  var opts = { name: 'Boys to Men Camp', replyTo: VP.REPLY_TO, attachments: attachments };
  try { GmailApp.sendEmail(to, 'Your Boys to Men admission letter and camp documents', lines.join('\n\n'), { name: opts.name, replyTo: opts.replyTo, attachments: attachments, from: VP.SEND_FROM }); }
  catch (e) { GmailApp.sendEmail(to, 'Your Boys to Men admission letter and camp documents', lines.join('\n\n'), opts); }
  vpSet_(sheet, rowNo, 'Docs Sent At', vpNow_());
  return { sent: true };
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function vpNow_() { return Utilities.formatDate(new Date(), VP.TZ, 'yyyy-MM-dd HH:mm:ss'); }

function vpFindProofSheet_(ss) {
  if (VP.PROOF_TAB_NAME) return ss.getSheetByName(VP.PROOF_TAB_NAME);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (sh.getLastColumn() < 3 || sh.getLastRow() < 1) continue;
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (h.indexOf('Date Paid') >= 0 && h.indexOf('Amount Paid') >= 0) return sh;
  }
  return null;
}

function vpEnsureColumns_(sheet) {
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  VP_COLS.forEach(function (name) {
    if (h.indexOf(name) < 0) { h.push(name); sheet.getRange(1, h.length).setValue(name).setFontWeight('bold'); }
  });
}

var vpHead_ = null;   // the heading row, read once per run

function vpSet_(sheet, rowNo, name, value) {
  if (!vpHead_) vpHead_ = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var c = vpHead_.indexOf(name);
  if (c < 0) { vpHead_.push(name); c = vpHead_.length - 1; sheet.getRange(1, c + 1).setValue(name).setFontWeight('bold'); }
  sheet.getRange(rowNo, c + 1).setValue(value);
}

function vpLoadUsed_(ss) {
  var map = {};
  var sh = ss.getSheetByName(VP_USED_TAB);
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    if (r[0]) map[vpNorm_(r[0])] = 'row ' + r[3] + ' (' + r[4] + ')';
  });
  return map;
}

function vpMarkUsed_(ss, alert, rowNo, parent) {
  var sh = ss.getSheetByName(VP_USED_TAB) || ss.insertSheet(VP_USED_TAB);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 6).setValues([['Bank Ref', 'Bank Amount', 'Bank Time', 'Proof Row', 'Parent', 'Locked At']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([alert.ref, alert.amount, alert.when, rowNo, parent, vpNow_()]);
}

function vpSendReviewEmail_(items, ss) {
  var to = VP.ALERT_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var L = ['These payments need a quick look. Each one is marked in the proof of payment tab.', ''];
  items.forEach(function (it) {
    L.push('Row ' + it.rowNo + '. ' + it.name + (it.phone ? ' (' + it.phone + ')' : '') + '. Amount written ' + it.amount + (it.txn ? ', ID written ' + it.txn : ''));
    L.push(it.note);
    L.push('');
  });
  L.push('To confirm a payment yourself, type Approved in its "Verify Status" cell. The receipt goes out within a minute.');
  L.push(ss.getUrl());
  try { MailApp.sendEmail(to, 'Boys to Men payments to check (' + items.length + ')', L.join('\n'), { name: 'Boys to Men Website' }); } catch (e) {}
}
