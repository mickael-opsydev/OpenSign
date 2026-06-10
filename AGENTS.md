# OpenSign — Architecture & Conventions

## Overview
OpenSign is a free, open-source alternative to DocuSign for electronic signatures.
It uses a monorepo structure with two main applications:
- **`apps/OpenSign/`** — React frontend (Vite, Parse SDK, Tailwind CSS)
- **`apps/OpenSignServer/`** — Parse Server backend (Express, MongoDB, ESM)

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Redux Toolkit, react-router v6, react-pdf, pdf-lib, Tailwind CSS |
| Backend | Node.js, Express 5, Parse Server 8, MongoDB 7 |
| Auth | Parse Sessions + `loginAs` (master-key impersonation) |
| Email | Mailgun or SMTP (via `nodemailer`) |
| SMS | Twilio (via `twilio` SDK) |
| PDF Signing | `@signpdf/signpdf` + `@signpdf/signer-p12` (PKCS#12 digital certs) |
| i18n | `react-i18next` with JSON files in `public/locales/{lang}/` |

## Key Conventions

### Backend (OpenSignServer)
- **Language**: ES Modules (`"type": "module"`)
- **Entry**: `index.js`
- **Cloud Functions**: Each in `cloud/parsefunction/*.js`, default-exported, registered in `cloud/main.js`
- **Hooks**: `afterSave`/`beforeSave`/`afterFind` registered in `cloud/main.js`
- **Custom Routes**: Express routes in `cloud/customRoute/customApp.js`
- **Migrations**: `databases/migrations/YYYYMMDDHHmmss-*.cjs` (CommonJS, `exports.up`/`exports.down`)
- **Utils**: Shared utilities in `Utils.js` and `utils/`
- **Environment**: Variables loaded via `dotenv`, key vars in `.env.example`

### Frontend (OpenSign)
- **Language**: JSX, ES Modules
- **Entry**: `src/index.jsx`, routing in `src/App.jsx`
- **Pages**: `src/pages/` (23 route components)
- **Components**: `src/components/` (reusable), `src/components/pdf/` (signing-specific)
- **State**: Redux in `src/redux/reducers/` (6 slices)
- **Constants/Utils**: `src/constant/Utils.js` (~4800 lines)
- **API**: Parse SDK (`Parse.Cloud.run`, `Parse.Query`) + Axios for REST
- **i18n**: `src/i18n.js` loading from `public/locales/{lang}/translation.json`

### Database (Parse Server on MongoDB)
Classes follow `{domain}_{Name}` convention:
- `contracts_Document` — documents sent for signature
- `contracts_Template` — reusable templates
- `contracts_Users` — extended user profiles
- `contracts_Contactbook` — signer contacts
- `contracts_Signature` — saved signatures/initials/stamps
- `defaultdata_Otp` — OTP storage (created at runtime, no migration)
- `partners_Tenant` — org/tenant configuration
- `_User` — Parse built-in users

## SMS OTP Feature (added June 2026)

### Architecture
```
SMSProvider (abstract interface)
  ├── TwilioProvider     (current)
  ├── AmazonSNSProvider  (future)
  └── ...                (future)
```

### Database Fields
- `contracts_Document.OTPType` (String: `"none"`, `"email"`, `"sms"`, `"both"`)
- `contracts_Template.OTPType` (String: same values)
- `defaultdata_Otp.Phone` (String, for SMS OTPs)

### Key Files Modified/Added
| File | Purpose |
|---|---|
| `databases/migrations/*-add_otptype.cjs` | Migration for `OTPType` field |
| `cloud/smsProviders/SMSProvider.js` | Abstract SMS provider interface |
| `cloud/smsProviders/TwilioProvider.js` | Twilio implementation |
| `cloud/parsefunction/SendSMSOTP.js` | Cloud function to send SMS OTP |
| `cloud/parsefunction/AuthLoginAsMail.js` | Updated to support phone-based verification |
| `cloud/main.js` | Registration of new cloud functions |
| `Utils.js` | SMS provider initialization |
| `src/pages/Form.jsx` | UI for OTP type selection |
| `src/pages/GuestLogin.jsx` | SMS OTP flow for guest signers |
| `src/components/pdf/VerifySMSOTP.jsx` | SMS OTP verification modal |
| `src/pages/PdfRequestFiles.jsx` | OTP type detection in recipient flow |
| `src/pages/SignyourselfPdf.jsx` | OTP type detection in self-sign flow |
| `src/pages/PlaceHolderSign.jsx` | OTPType propagation in autosave |
| `src/components/pdf/EditTemplate.jsx` | OTPType in template edit form |
| `src/pages/TemplatePlaceholder.jsx` | OTPType propagation for templates |
| `.env.example` | Twilio config vars |
| `public/locales/*/translation.json` | i18n keys for SMS OTP |

### Environment Variables (SMS)
```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

### SMS OTP Flow
1. Sender enables SMS OTP (or Email+SMS) on document
2. Signer receives signing link, enters phone number
3. Frontend calls `SendSMSOTP` cloud function
4. Backend generates 4-digit OTP, sends via Twilio, stores in `defaultdata_Otp`
5. Signer enters OTP, frontend calls `AuthLoginAsMail` with `{phone, otp}`
6. On success, Parse session created, signing proceeds

### Phone User Auto-Creation
When `AuthLoginAsMail` is called with `phone` and no existing `_User` has that phone number, a new user is automatically created:
- `username`: `phone_<sanitized_number>`
- `phone`: the submitted phone number
- `password`: random string (never used for password login)

This mirrors the email flow where the signer must exist as a `_User` to receive a Parse session via `loginAs`.

### Code Style
- No comments in code (per project convention)
- Follow existing patterns for imports, error handling, async/await
- Frontend: Tailwind CSS utility classes (`op-btn`, `op-input`, etc.)
- Backend: Parse Query patterns, `useMasterKey: true` for privileged operations
- Tests: Jasmine (`spec/Tests.spec.js`)
