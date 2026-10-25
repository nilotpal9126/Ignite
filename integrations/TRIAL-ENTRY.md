# Optional trial entry and enrolment handoff

The landing page opens a dismissible native dialog once per tab visit. Name,
board, guardian contact number and guardian email are optional for access: Close,
Escape and Skip for now all allow anonymous practice. Continue validates supplied
details with the existing enrolment rules and prefills the full enquiry form.

Personal fields remain only in this page's forms and are never written to browser
storage or sent by the entry popup. The session marker contains only true/false;
the existing board preference contains no contact data. Reload clears contact
fields. Choosing CBSE/ICSE during entry updates the convenience content filter
without reloading, preserving the in-memory form data. Other boards can be used
for the enquiry while the trial keeps its currently available board options.

After a real sample finishes, the existing enrolment dialog opens once on that
page. The selected sample class prefills its Class field. Existing enquiry values
are retained, not overwritten. Closing returns to the sample results. Illustrative
recovery previews do not trigger this handoff.

Student / Location / Contact are keyboard-accessible navigation buttons. Backward
navigation preserves entries; forward jumps validate earlier steps and focus the
first missing field. Consent and WhatsApp controls remain native checkboxes.

If endpointUrl or turnstileSiteKey is missing, the final action is Review enquiry.
It validates and clearly states that nothing was sent. This is not a successful
admission or saved lead. Connected submissions retain the existing verification,
server validation, deduplication, receipt checks and retry handling. Pending saves
disable all steps; failed saves restore controls and preserve entries. Successful
saves clear the contact fields and optional entry form.

Configuration keys and the real submission destination must be supplied separately
before enquiries can be recorded. This change neither creates a new backend nor
changes authentication, academic content or game scores.
