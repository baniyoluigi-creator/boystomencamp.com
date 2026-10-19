/**
 * Boys to Men Mentorship Camp: form receiver
 *
 * Saves every Apply and Contact form submission into this Google Sheet,
 * and emails a notice to the sheet owner. No monthly submission limit.
 *
 * Setup: see SETUP-GOOGLE-SHEET-FORMS.txt
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
var SKIP_FIELDS = ['_gotcha', '_subject', '_form', '_page'];

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

    // Build one row of values keyed by field name. Checkboxes with the
    // same name (for example Desired Outcome) are joined with "; ".
    var row = { 'Submitted At': Utilities.formatDate(new Date(), 'Africa/Kampala', 'yyyy-MM-dd HH:mm:ss') };
    Object.keys(p).forEach(function (key) {
      if (SKIP_FIELDS.indexOf(key) !== -1) return;
      var label = key === '_opened_at' ? 'Form Opened At' : key;
      row[label] = p[key].join('; ');
    });
    row['Page'] = first_(p._page) || '';

    // Make sure every field has a column; add new columns when needed.
    var lastCol = sheet.getLastColumn();
    var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    Object.keys(row).forEach(function (name) {
      if (headers.indexOf(name) === -1) {
        headers.push(name);
        sheet.getRange(1, headers.length).setValue(name);
      }
    });
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    var values = headers.map(function (h) { return row[h] !== undefined ? row[h] : ''; });
    sheet.appendRow(values);

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

function first_(arr) {
  return arr && arr.length ? arr[0] : '';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
