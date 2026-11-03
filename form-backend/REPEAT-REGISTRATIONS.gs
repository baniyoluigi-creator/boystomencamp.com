/**
 * Boys to Men: same boy registered twice.
 *
 * If the same boy is registered again within 14 days by the same person
 * (same phone number or same email), no new row is added and no new code is
 * given. The parent gets a short note saying the registration was already
 * received, with the same codes, and is told what to do if they meant to
 * register someone else. The team gets a copy.
 *
 * Added to the live script together with two small calls inside doPost.
 * See PASTE-REPEAT-REGISTRATIONS.txt
 */

var REPEAT_WINDOW_DAYS = 14;
var REPEAT_TAB = 'Repeat Registrations';
var REPEAT_APPLY_PAGE = 'https://boystomencamp.com/apply.html';

// Returns one entry per boy ({name, code, family, on}) when EVERY boy in this
// submission was already registered recently by the same person. Otherwise null,
// and the registration goes through as normal.
function findRepeatRegistration_(sheet, p, n) {
  var regName = first_(p['Registrant Name']);
  var regEmail = String(first_(p['Registrant Email'])).toLowerCase().trim();
  if (isTest_(regName, regEmail)) return null; // your own tests always go through
  if (!sheet || sheet.getLastRow() < 2) return null;

  var vals = sheet.getDataRange().getValues();
  var h = vals[0];
  var cName = h.indexOf('Applicant Name'), cAt = h.indexOf('Submitted At'), cBoy = h.indexOf('Boy ID');
  var cFam = h.indexOf('Family ID'), cRegPh = h.indexOf('Registrant Phone'), cPh = h.indexOf('Phone');
  var cRegEm = h.indexOf('Registrant Email'), cEm = h.indexOf('Email');
  if (cName < 0 || cAt < 0 || cBoy < 0) return null;

  var regPhone = d9_(first_(p['Registrant Phone']));
  if (!regPhone && !regEmail) return null;
  var cutoff = new Date().getTime() - REPEAT_WINDOW_DAYS * 86400000;
  var hits = [];

  for (var i = 1; i <= n; i++) {
    var boyName = first_(p['Boy ' + i + ' Name']);
    var key = norm_(boyName);
    if (!key) return null;
    var found = null;
    for (var r = vals.length - 1; r >= 1 && !found; r--) {
      var row = vals[r];
      if (norm_(row[cName]) !== key) continue;
      if (!String(row[cBoy]).trim()) continue;
      var ms = toMs_(row[cAt]);
      if (!(ms >= cutoff)) continue;
      var samePhone = regPhone && ((cRegPh >= 0 && d9_(row[cRegPh]) === regPhone) || (cPh >= 0 && d9_(row[cPh]) === regPhone));
      var sameEmail = regEmail && ((cRegEm >= 0 && String(row[cRegEm]).toLowerCase().trim() === regEmail) || (cEm >= 0 && String(row[cEm]).toLowerCase().trim() === regEmail));
      if (samePhone || sameEmail) {
        found = {
          name: boyName,
          code: String(row[cBoy]).trim(),
          family: cFam >= 0 ? String(row[cFam]).trim() : '',
          on: Utilities.formatDate(new Date(ms), 'Africa/Kampala', 'd MMMM yyyy')
        };
      }
    }
    if (!found) return null;
    hits.push(found);
  }
  return hits;
}

// Keeps a record, writes to the parent and lets the team know.
function repeatRegistration_(ss, p, n, hits) {
  var regName = first_(p['Registrant Name']);
  var regEmail = first_(p['Registrant Email']);
  var test = isTest_(regName, regEmail);

  var names = hits.map(function (x) { return x.name; });
  var nameText = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  var codes = hits.map(function (x) { return x.name + ' is ' + x.code; }).join(', ');
  var family = hits[0].family || hits[0].code;

  try {
    if (!test) {
      var tab = ss.getSheetByName(REPEAT_TAB) || ss.insertSheet(REPEAT_TAB);
      writeRows_(tab, [{
        'Submitted At': now_(), 'Registrant Name': regName, 'Registrant Phone': first_(p['Registrant Phone']),
        'Registrant Email': regEmail, 'Boys': names.join(', '), 'Existing Codes': hits.map(function (x) { return x.code; }).join(', '),
        'Reply Sent': /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(regEmail) ? 'Yes' : 'No email given'
      }]);
    }
  } catch (logErr) {}

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(regEmail)) return;

  var lines = [
    'Dear ' + (regName || 'Parent') + ',',
    'Thank you. We already received the registration of ' + nameText + ' on ' + hits[0].on + ', so there is no need to fill the form in again.',
    'Your reference number is ' + family + '. ' + codes + '. These codes stay the same.',
    'If you meant to register someone else, please fill in the form again with that person\'s details. He will receive his own code.',
    'If something needs to be corrected, just reply to this email and our team will update it.',
    'Warm regards,\nBoys to Men Mentorship Camp Team'
  ];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); };
  var applyButton = '<p style="margin:0 0 18px;"><a href="' + REPEAT_APPLY_PAGE + '" style="display:inline-block;background:#cc9a2e;color:#1f2d1f;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:999px;">Register someone else</a></p>';
  var html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:560px;">' +
    lines.map(function (t, i) { return '<p style="margin:0 0 18px;">' + esc(t) + '</p>' + (i === 3 ? applyButton : ''); }).join('') + '</div>';
  var plain = lines.map(function (t, i) { return t + (i === 3 ? '\n\nThe form is here, ' + REPEAT_APPLY_PAGE : ''); }).join('\n\n');

  var mail = {
    to: regEmail, replyTo: REPLY_TO_CONFIRMATION,
    subject: 'BOYS TO MEN | WE ALREADY HAVE THIS REGISTRATION',
    body: plain, htmlBody: html, name: 'Boys to Men Mentorship Camp Team'
  };
  if (!test) mail.bcc = NOTIFY_EMAIL;
  try { MailApp.sendEmail(mail); } catch (mailErr) {}
}

// Run once. Saves a backup copy of this spreadsheet, then writes every phone number
// in Registrations and Contact Messages with its country code (+256 for Uganda).
function tidyRegistrationPhones() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stamp = Utilities.formatDate(new Date(), 'Africa/Kampala', 'd MMM yyyy HH:mm');
  DriveApp.getFileById(ss.getId()).makeCopy('Boys to Men Registrations, backup before phone tidy, ' + stamp);
  var changed = 0;
  ['Registrations', 'Contact Messages'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    h.forEach(function (title, c) {
      if (!/(^|\s)Phone$|WhatsApp Number( To Add)?$/.test(String(title))) return;
      var rng = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1);
      var vals = rng.getValues();
      var out = vals.map(function (v) {
        var cur = String(v[0]).trim();
        var fixed = mPhone_(cur);
        if (fixed !== cur) changed++;
        return [fixed === '' ? v[0] : fixed];
      });
      rng.setNumberFormat('@');
      rng.setValues(out);
    });
  });
  Logger.log('Phone numbers rewritten: ' + changed);
}
