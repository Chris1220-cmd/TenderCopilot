# Forgot / Reset Password

**Date:** 2026-04-05
**Status:** Approved

## Problem

The login page links to `/forgot-password` but the route doesn't exist (404). Users have no way to recover their password.

## Decisions

- **Token storage:** Reuse existing `VerificationToken` Prisma model — no migration needed
- **Token expiry:** 24 hours (dev/testing-friendly)
- **Email delivery:** Console log only (no SMTP configured yet). Uses existing `sendEmail()` which already falls back to console in dev.
- **Security:** Always show success message regardless of whether email exists (no enumeration)

## Flow

```
Login → "Ξεχάσατε τον κωδικό;" link
  → GET /forgot-password (email form)
  → POST /api/auth/forgot-password
    → Lookup user by email
    → If found: delete any existing tokens for this email, create VerificationToken (24h), log reset URL
    → Always return 200 with generic success message
  → User opens /reset-password?token=xxx
  → GET /reset-password (new password form, reads ?token from URL)
  → POST /api/auth/reset-password { token, password }
    → Find VerificationToken by token
    → Validate not expired
    → bcrypt hash new password → update User.hashedPassword
    → Delete used token
    → Return success
  → Redirect to /login with success message
```

## Pages

### `/forgot-password`
- Same layout/styling as login page (glassmorphism, framer motion animations)
- Single email input + submit button
- Success state: "Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε σύνδεσμο επαναφοράς."
- Back link to `/login`

### `/reset-password`
- Same layout/styling as login page
- Two fields: new password + confirm password
- Password validation: min 8 characters (same as register)
- Reads `token` from URL query param
- Error states: invalid/expired token
- Success: redirect to `/login`

## API Routes

### `POST /api/auth/forgot-password`
- Body: `{ email: string }`
- Validates email format
- Looks up user, creates token if found
- Token: `crypto.randomUUID()`, expires in 24h
- Console logs: `[PASSWORD RESET] http://localhost:3000/reset-password?token=xxx`
- Always returns `{ message: "ok" }` (200)

### `POST /api/auth/reset-password`
- Body: `{ token: string, password: string }`
- Finds VerificationToken by token value
- Checks expiry
- Hashes password with bcrypt (cost 12, same as register)
- Updates `User.hashedPassword`
- Deletes the token
- Returns `{ message: "ok" }` (200)
- Error cases: 400 (invalid/expired token, validation failure)

## i18n Keys

New keys under `auth` namespace in `messages/el.json` and `messages/en.json`:
- `forgotPasswordTitle` — page title
- `forgotPasswordSubtitle` — instructions
- `forgotPasswordSuccess` — generic success message
- `resetPasswordTitle` — page title
- `resetPasswordSubtitle` — instructions
- `newPassword` — field label
- `confirmPassword` — field label
- `passwordMismatch` — validation error
- `resetPasswordSuccess` — success message
- `resetPasswordError` — invalid/expired token error
- `sendResetLink` — button text
- `resetPassword` — button text
- `backToLogin` — link text

## Technical Notes

- Uses existing `VerificationToken` model: `{ identifier (email), token, expires }`
- Password hashing: `bcrypt.hash(password, 12)` via bcryptjs
- Forms: React Hook Form + Zod validation (same pattern as login/register)
- No migration required
