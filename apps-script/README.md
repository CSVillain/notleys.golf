# Contact Relay

The contact form uses the free Google Apps Script relay in `contact-relay.gs` to email enquiries to `thenotleysgc@gmail.com`.

## Deploy

1. Sign in to Google as `Notleys <thenotleysgc@gmail.com>`.
2. Open Google Apps Script at `https://script.google.com/`.
3. Create a new project named `Notleys Contact Relay`.
4. Replace the default script contents with `contact-relay.gs`.
5. Confirm `RECIPIENT` is still `thenotleysgc@gmail.com`.
6. Click `Deploy` then `New deployment`.
7. Select deployment type `Web app`.
8. Set `Execute as` to `Me`.
9. Set `Who has access` to `Anyone`.
10. Click `Deploy`.
11. Authorize the script from the Notleys Gmail account when prompted.
12. Copy the Web app URL ending in `/exec`.
13. In `index.html`, replace the placeholder value with the copied Web App URL ending in `/exec`. Do not paste the example placeholder URL below:

```html
data-contact-endpoint="https://script.google.com/macros/s/REPLACE_WITH_APPS_SCRIPT_DEPLOYMENT_ID/exec"
```

The frontend posts through a hidden iframe instead of `fetch` so the static site is not blocked by Apps Script CORS behaviour. No script properties, environment variables, CAPTCHA, or third-party form service are required.

## Security notes

The Web App URL is public because browsers need to submit to it directly. Treat the Apps Script as a public endpoint and keep the server-side checks in place:

- only the known homepage `source` and subject list are accepted
- name, email, phone, and message values are length-limited before email delivery
- invalid email addresses are rejected before being used as `replyTo`
- the hidden `website` field remains a honeypot
- per-email and global daily counters limit basic abuse
- errors returned to the browser are generic, with details written only to Apps Script logs

If spam increases, rotate the Apps Script deployment URL and redeploy after adding a stronger challenge, such as a Turnstile or reCAPTCHA check.
