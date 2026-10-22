# Ignite Firebase Authentication

Firebase project: `projectignite-9c8cf`. The original web app configuration was recovered from
the existing Ignite build. Google's public project-config endpoint confirmed the project and
authorized domains, including `nilotpal9126.github.io`, during implementation.
A synthetic failed sign-in also reached the email/password endpoint and returned
`INVALID_LOGIN_CREDENTIALS`; no live accounts were created and no emails were sent.

## What is implemented

- Email/password account creation and sign-in using Firebase's modular Web SDK 13.1.0.
- Email verification, resend, verification refresh, password reset and actual Firebase sign-out.
- Dashboard access requires a verified sign-in. Unverified users can still try public quizzes.
- Firebase controls token persistence/refresh; the old manually cached JWT is retired.
- Session persistence keeps sign-ins scoped to the current browser tab/session. Different
  accounts can be used on separate devices or independently opened tabs. A newly duplicated
  tab can initially inherit its opener's session; sign out in that tab before changing accounts.
- Browser practice/assessment/game keys use `firebase:<uid>`, so switching accounts cannot
  accidentally load the old single-device prototype profile. Existing local data is preserved,
  but is not automatically claimed by a new Firebase account.
- Game progress and dashboard practice still save **in that browser** under the account UID.
  Cross-device progress synchronization and an admissions approval service are not implemented.
- Anonymous visitors can use the public quiz without loading authentication. The game loads
  identity before choosing a progress key. If it cannot check identity, play remains available
  but progress is not saved under an uncertain identity.
- Each email corresponds to one Firebase account and one practice identity. This does not
  implement several child profiles under one guardian email. Use separate learning accounts
  for now; shared guardian/child profiles require a protected student-profile service.
- Enrolment enquiries continue through the separate private Google Sheets integration. No
  passwords or Firebase tokens are sent to Sheets, and a Sheet receipt is not a login credential.

## Console activation

1. Open [Ignite Authentication](https://console.firebase.google.com/project/projectignite-9c8cf/authentication/providers).
2. Enable **Email/Password** (not email-link sign-in or phone/SMS) if it is not already enabled.
3. Confirm authorized domains: `nilotpal9126.github.io`, the project's Firebase domains, and
   `localhost` for local smoke testing. Add a future custom domain before moving the website.
4. Review verification/reset email templates and password policy in the Firebase Console.
5. Deploy the updated website files, including `firebase-session.js`, `firebase-auth.js`,
   `account-ui.js`, `account.css`, HTML entry points and updated dashboard/game controllers.
6. With an owner-controlled test email, create an account, verify the email, sign in, open the
   dashboard, play a round, reload, sign out, and repeat using a different email in another
   independent tab/browser. Verify progress separation and password reset delivery.

The public Web API key/App ID are client configuration, not an admin credential. Never add
service-account JSON, private keys or an owner's password to the repository. No new Firebase
project, paid plan or administrator key is required for this integration.

Client-side page gates provide the login experience for public practice content. Every future
private API must verify Firebase ID tokens and authorize its own records on the server. Do not
use a browser UID string or local progress as proof of identity, grades or paid admission.

## Checks

Run `node --test integrations/firebase/authentication.test.mjs`. These use synthetic SDK
fixtures for verification, independent sessions, account switching, tokens, resets and errors.
Browser QA should also cover the form, dashboard gate, native enrolment link and mobile header.
No synthetic accounts are created in the live Firebase project by this suite. Console settings
and real verification-email delivery require the owner-controlled smoke test above.

References: [password authentication](https://firebase.google.com/docs/auth/web/password-auth),
[user management](https://firebase.google.com/docs/auth/web/manage-users),
[session persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).
