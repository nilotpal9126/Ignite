// Apps Script V8. Add enrollment-validation.js as a second file named Rules.gs.
// Script properties: SPREADSHEET_ID and SHEETS_AUTH_SECRET. Never put them in the website.

function doPost(event) {
  function reply(body) {
    return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
  }
  var lock;
  try {
    if (!event || !event.postData || event.postData.contents.length > 16384) {
      return reply({ ok: false, code: 'invalid_request' });
    }
    var body = JSON.parse(event.postData.contents);
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('SHEETS_AUTH_SECRET');
    var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    if (!secret || !spreadsheetId || !body || body.secret !== secret) {
      return reply({ ok: false, code: 'not_authorized' });
    }
    var result = globalThis.IgniteEnrollmentRules.validate(body.data);
    var requestId = body.data && body.data.requestId;
    if (!result.valid || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId || '')) {
      return reply({ ok: false, code: 'invalid_fields' });
    }
    var key = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      globalThis.IgniteEnrollmentRules.duplicateKey(result.data))
      .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return reply({ ok: false, code: 'busy' });
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName('Enquiries') || spreadsheet.insertSheet('Enquiries');
    var headers = ['Received at', 'Reference', 'Request ID', 'Duplicate key', 'Student name',
      'Class', 'School', 'Board', 'State / UT', 'District', 'City / town', 'Preferred area',
      'Guardian name', 'Mobile', 'WhatsApp', 'Email', 'Guardian consent',
      'WhatsApp opt-in', 'Consent version', 'Status'];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else if (JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !== JSON.stringify(headers)) {
      return reply({ ok: false, code: 'sheet_schema_mismatch' });
    }
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var entries = sheet.getRange(2, 2, lastRow - 1, 3).getValues();
      for (var i = 0; i < entries.length; i++) {
        if (entries[i][2] === key) return reply({ ok: true, duplicate: true, reference: entries[i][0] });
        if (entries[i][1] === requestId) return reply({ ok: false, code: 'request_conflict' });
      }
    }
    var data = result.data;
    var reference = 'IGN-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
    var values = [new Date().toISOString(), reference, requestId, key, data.studentName,
      data.studentClass, data.school, data.board === 'Other' ? data.otherBoard : data.board,
      data.state, data.district, data.city, data.preferredLocation, data.guardianName,
      '+91' + data.phone, '+91' + data.whatsapp, data.email, 'Yes',
      data.whatsappOptIn ? 'Yes' : 'No', 'ignite-enquiry-v1', 'New'];
    // Treat submitted values as text, including strings beginning with formula markers.
    values = values.map(function (value) {
      var text = String(value);
      return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
    });
    sheet.getRange(lastRow + 1, 1, 1, values.length).setNumberFormat('@').setValues([values]);
    SpreadsheetApp.flush();
    return reply({ ok: true, duplicate: false, reference: reference });
  } catch (_) {
    return reply({ ok: false, code: 'save_unconfirmed' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
