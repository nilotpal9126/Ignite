'use strict';

// The same rules run in the browser, the Worker and Apps Script (as Rules.gs).
(function (root) {
  const states = Object.freeze([
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
    'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
    'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
    'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
    'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  ]);
  const boards = Object.freeze(['CBSE', 'CISCE', 'State board', 'Regional board', 'NIOS', 'IB', 'Cambridge', 'Other']);
  const fields = Object.freeze([
    'studentName', 'studentClass', 'school', 'board', 'otherBoard', 'state',
    'district', 'city', 'preferredLocation', 'guardianName', 'phone',
    'whatsapp', 'sameWhatsapp', 'email', 'consent', 'whatsappOptIn',
  ]);
  const clean = (value) => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : '';
  const fold = (value) => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const requiresBoardName = (board) => ['State board', 'Regional board', 'Other'].includes(board);
  const isSiliguri = (city) => clean(city).toLowerCase() === 'siliguri';
  const placeholders = new Set(['test', 'testing', 'testschool', 'dummy', 'dummyschool',
    'sample', 'asdf', 'asdfgh', 'qwerty', 'abc', 'abcd', 'abcdef', 'xyz', 'na',
    'none', 'unknown', 'studentname', 'schoolname', 'yourname', 'guardianname']);
  function plausible(value) {
    const key = fold(value);
    return !placeholders.has(key) && !/^(.)\1{2,}$/u.test(key);
  }
  function phone(value) {
    let digits = clean(value).replace(/[\s()+-]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    return digits;
  }
  function validPhone(value) {
    return /^[6-9][0-9]{9}$/.test(value) && !/([0-9])\1{5}/.test(value)
      && !['9876543210', '9999988888', '9123456789'].includes(value);
  }
  function validate(raw) {
    const data = {};
    const errors = {};
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    fields.forEach((key) => { data[key] = clean(input[key]); });
    ['sameWhatsapp', 'consent', 'whatsappOptIn'].forEach((key) => { data[key] = input[key] === true; });
    function text(key, label, min, max, pattern) {
      const value = data[key];
      if (value.length < min || value.length > max || !pattern.test(value) || !plausible(value)) {
        errors[key] = `Enter ${label} (${min}\u2013${max} characters).`;
      }
    }
    const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} .\u2019'\-]*$/u;
    text('studentName', 'the student\u2019s name using letters', 2, 80, namePattern);
    text('guardianName', 'the parent or guardian\u2019s name using letters', 2, 80, namePattern);
    const placePattern = /^(?=.*\p{L})[\p{L}\p{M}\p{N} .,'\u2019&()/#\-]+$/u;
    text('school', 'the school\u2019s name', 3, 120, placePattern);
    if (!/^(?:[1-9]|1[0-2])$/.test(data.studentClass)) errors.studentClass = 'Choose a class from the list.';
    if (!boards.includes(data.board)) errors.board = 'Choose a school board.';
    if (requiresBoardName(data.board)) text('otherBoard', 'the school board\u2019s name', 2, 80, placePattern);
    else data.otherBoard = '';
    if (!states.includes(data.state)) errors.state = 'Choose a state or union territory.';
    text('district', 'the district name', 2, 80, placePattern);
    text('city', 'the city or town name', 2, 80, placePattern);
    if (isSiliguri(data.city)) text('preferredLocation', 'a preferred area or neighbourhood in Siliguri', 2, 100, placePattern);
    else data.preferredLocation = '';
    data.phone = phone(data.phone);
    data.whatsapp = data.sameWhatsapp ? data.phone : phone(data.whatsapp);
    if (!validPhone(data.phone)) errors.phone = 'Enter a valid Indian mobile number; avoid repeated or sample numbers.';
    if (!validPhone(data.whatsapp)) errors.whatsapp = 'Enter a valid WhatsApp mobile number.';
    data.email = data.email.toLowerCase();
    if (data.email.length > 120 || !/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(data.email)) {
      errors.email = 'Enter a valid guardian email address.';
    }
    if (!data.consent) errors.consent = 'Please confirm guardian consent to submit this enquiry.';
    return { data, errors, valid: Object.keys(errors).length === 0 };
  }
  // Same child + class + school + guardian phone; siblings can share a phone.
  function duplicateKey(data) {
    return [phone(data.phone), fold(data.studentName), data.studentClass, fold(data.school)].join('|');
  }
  const rules = Object.freeze({ states, boards, fields, clean, requiresBoardName, isSiliguri, validate, duplicateKey });
  root.IgniteEnrollmentRules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
})(globalThis);
