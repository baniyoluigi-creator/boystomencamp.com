/* Boys to Men: attach proof of payment page.
   Sends the receipt picture to the same Google Apps Script as the forms.
   The script saves it in the private Google Drive folder "Boys to Men Payment Proofs". */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('proofForm');
  if (!form) return;
  var err = document.getElementById('pfError');
  var btn = document.getElementById('pfBtn');
  function fail(msg) { err.textContent = msg; err.hidden = false; btn.disabled = false; btn.textContent = 'Send my proof of payment'; }

  var dateBox = document.getElementById('pfDate');
  if (dateBox) { var t = new Date(); dateBox.max = t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  var chosen = document.getElementById('pfChosen');
  document.getElementById('pfFile').addEventListener('change', function () {
    var f = this.files[0];
    if (chosen) chosen.textContent = f ? 'Chosen file: ' + f.name + ' (' + Math.max(1, Math.round(f.size / 1024)) + ' KB)' : '';
  });

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject('We could not read that file. Please try another one.'); };
      if (file.type === 'application/pdf') {
        if (file.size > 2 * 1024 * 1024) return reject('That PDF is too large. Please upload a screenshot or photo instead.');
        reader.onload = function () { resolve({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] }); };
        reader.readAsDataURL(file);
      } else if (file.type.indexOf('image/') === 0) {
        reader.onload = function () {
          var img = new Image();
          img.onerror = function () { reject('We could not read that picture. If it is a photo from an iPhone, please take a screenshot of it instead, or choose a JPG or PNG.'); };
          img.onload = function () {
            var ratio = Math.min(1, 1400 / Math.max(img.width, img.height));
            var c = document.createElement('canvas');
            c.width = Math.round(img.width * ratio); c.height = Math.round(img.height * ratio);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.72).split(',')[1] });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      } else { reject('Please upload a screenshot, a photo or a PDF.'); }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.hidden = true;
    var v = function (id) { return document.getElementById(id).value.trim(); };
    if (!v('pfName') || !v('pfPhone') || !v('pfBoy')) return fail('Please fill in your name, phone number and the name or code of each boy this payment is for.');
    if (!v('pfDate')) return fail('Please choose the date you made the payment.');
    var file = document.getElementById('pfFile').files[0];
    if (!file && !v('pfTxn')) return fail('Please upload your receipt, or at least enter the transaction ID.');
    btn.disabled = true; btn.textContent = 'Sending...';
    var step = file ? readFile(file) : Promise.resolve(null);
    step.then(function (proof) {
      var body = new URLSearchParams();
      var dp = v('pfDate').split('-');
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var niceDate = dp.length === 3 ? (parseInt(dp[2], 10) + ' ' + months[parseInt(dp[1], 10) - 1] + ' ' + dp[0]) : v('pfDate');
      new FormData(form).forEach(function (val, key) {
        // The date is also written beside the amount, so it always reaches the team's sheet and email.
        if (key === 'Amount Paid') val = (val ? val + ' ' : '') + '(paid on ' + niceDate + ')';
        body.append(key, val);
      });
      body.append('_form', 'proof');
      body.append('_page', location.pathname);
      if (proof) { body.append('Proof File Name', proof.name); body.append('Proof File Type', proof.type); body.append('Proof File Data', proof.data); }
      return fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', body: body });
    }).then(function () {
      form.hidden = true;
      document.getElementById('pfDone').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(function (m) { fail(typeof m === 'string' ? m : 'Something went wrong. Please check your internet and try again.'); });
  });
});
