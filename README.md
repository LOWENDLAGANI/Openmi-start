# Openmi

An AI front-end builder: describe a UI, watch it stream into a sandboxed live preview, then publish
it to a permanent `openmi.app/p/<id>` link.

- **Next.js App Router + TypeScript + Tailwind CSS**
- **Firebase Auth** (Google + email/password, verification and password reset) and **Cloud Firestore**
- **Server-charged quotas**: a credit is taken only after a generation actually succeeds, and the
  browser cannot edit the counter
- **DeepSeek** (`deepseek-flash`) as the default generator, any OpenAI-compatible API as fallback
- **Zero-runtime preview**: generated code becomes a `Blob` URL inside a sandboxed `<iframe>`
- **Build history**: every generation is saved to the account and can be reopened or published later
- **Visual system**: warm cream canvas, charcoal ink and a single hot-orange accent, set in Space Grotesk + IBM Plex Mono (a groq.com-inspired editorial look). Tokens live in `tailwind.config.ts`, component classes in `app/globals.css`.

---

## Why do I see "Setup" / demo mode?

The badge in the builder header and the "Setup needed" panel appear when a deployment is missing
environment variables. There are three independent switches:

| Missing | Consequence |
| --- | --- |
| `DEEPSEEK_API_KEY` | Generations stream the built-in placeholder design instead of model output |
| `NEXT_PUBLIC_FIREBASE_*` | No accounts, no Firestore quotas, no publishing → local demo session |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Quotas are not server-charged: the API rejects token-bearing requests with a `503`, because a browser must never be trusted to decrement its own credits |

Set all three and restart the server: the badge switches to the provider name and the panel
disappears. Nothing else needs code changes.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

### 1. DeepSeek

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com   # optional
DEEPSEEK_MODEL=deepseek-flash                # deepseek-flash | deepseek-v4-pro
DEEPSEEK_THINKING=disabled                   # faster first tokens
```

Create a key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys). The key is
only read inside `app/api/generate/route.ts`; it is never sent to the browser.

Prefer another provider? Leave `DEEPSEEK_API_KEY` empty and set `OPENAI_API_KEY` +
`OPENAI_BASE_URL` + `OPENAI_MODEL` for any OpenAI-compatible endpoint.

### 2. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: enable *Google* and *Email/Password*.
3. **Authentication → Settings → Authorized domains**: add `localhost` and your production domain.
4. **Authentication → Templates**: the verification and password-reset emails use Firebase's default
   action handler (`https://<project>.firebaseapp.com/__/auth/action`). To send them from your own
   domain, customise the action handler under **Templates → Email address verification / Password reset**.
5. **Firestore Database**: create a database, then publish the rules in [`firestore.rules`](./firestore.rules):

   ```bash
   firebase deploy --only firestore:rules
   ```

6. **Project settings → Your apps → Web app**: copy the config into `NEXT_PUBLIC_FIREBASE_*`.
7. **Project settings → Service accounts → Generate new private key**: put the downloaded JSON in
   `FIREBASE_SERVICE_ACCOUNT_KEY` (raw JSON or base64). This is the server identity used to verify
   ID tokens and charge quotas.

```bash
# base64 is friendlier for hosts that mangle newlines
base64 -w0 serviceAccount.json
```

### 3. Email flows

- **Sign-up** sends a verification email automatically. Until it is confirmed, the builder shows a
  banner with *Resend link* and *I've verified* — the status comes from `emailVerified` on the
  Firebase user, refreshed through `reload()`.
- **Forgot?** on the sign-in form sends a reset email. Unknown addresses are answered with the same
  neutral message so the form can't be used to discover accounts.
- Neither flow uses a custom page in this repo: Firebase's hosted action handler verifies the link and
  redirects back to `/`. Add the domain under Authorized domains or the links will bounce.

---

## Production checklist

1. **Keys in the host**, not in the repo: the six `NEXT_PUBLIC_FIREBASE_*` values, `DEEPSEEK_API_KEY`
   (plus optional `DEEPSEEK_MODEL`), and the server credentials — `FIREBASE_SERVICE_ACCOUNT_KEY` or
   `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.
2. **Authorized domain**: add the real domain in Firebase → Authentication → Settings.
3. **Firestore rules**: deploy `firestore.rules`. Published projects are public-read and immutable;
   `users/*` is read-only to its owner; `generations/*` is private per user.
4. **Build once per environment**: `NEXT_PUBLIC_*` values are inlined at build time, so rebuild after
   changing them. `DEEPSEEK_*`, `OPENAI_*` and `FIREBASE_*` server values are read per request.
5. **Smoke test**: open `/`, create an account, verify the email, generate, reopen the build from
   *Your builds*, publish, then open `/p/<id>` in a private window. A bad provider key returns a 502
   with a readable message instead of a blank preview.
6. **Hardening (recommended for real traffic)**: put a shared rate limiter (Upstash, Cloudflare) or
   Firebase App Check in front of `/api/generate` — its current limiter is in-memory per instance.

---

## How it works

| Piece | File | Notes |
| --- | --- | --- |
| Provider resolution | `lib/ai-config.ts` | DeepSeek first, OpenAI-compatible fallback, safe status for the UI |
| Streaming API | `app/api/generate/route.ts` | Verifies the ID token, pre-checks quota, proxies provider SSE as plain text, charges on success |
| Server quota | `lib/server/quota.ts`, `lib/server/admin.ts` | Admin SDK transaction; daily reset and decrement live server-side |
| HTML wrapper | `lib/preview-html.ts` | Strips markdown fences, injects Tailwind/Lucide CDNs and the house-style fonts |
| Live preview | `components/PreviewPane.tsx` | New `Blob` URL per update, sandboxed iframe, desktop/mobile frames |
| Auth, history, quota UI | `components/AuthProvider.tsx`, `lib/backend/*` | One `Backend` interface, two implementations: Firestore and a keyless demo |
| Publishing | `lib/backend/firebase.ts`, `app/p/[id]/page.tsx` | 6-character id in `projects/{id}`, server-rendered viewer via the Firestore REST API |

### Data model

| Path | Contents | Access |
| --- | --- | --- |
| `users/{uid}` | `generations_left`, `last_reset_date` (UTC `YYYY-MM-DD`) | Owner read, **server write only** |
| `generations/{id}` | `user_id`, `prompt`, `code`, `published_id`, `created_at` | Owner only |
| `projects/{id}` | `user_id`, `code`, `created_at` — the public `/p/` page | Public read, immutable |

### Daily quota, charged on success

1. The client sends its Firebase ID token; the route verifies it with the Admin SDK.
2. `readRemaining()` refuses an exhausted account (or a reset day) before any model call, so no credits
   are burned on a request that can't succeed.
3. The response streams the design. When the upstream stream ends **normally with usable markup**, the
   route charges one credit inside a Firestore transaction, *before* it closes the stream — so when the
   browser sees the stream finish, the settled counter is already readable.
4. Errors, empty output and interrupted streams charge nothing.
5. On the following UTC day the counter resets to 5 on the next successful charge.

Demo mode (no Firebase) keeps a browser-local counter and decrements it locally after a successful
generation; it is explicitly not a security boundary.

---

## Security notes

- Preview and published pages run in `<iframe sandbox>` **without** `allow-same-origin`, so generated
  JavaScript cannot touch cookies, `localStorage` or the parent document.
- Quotas are server-authoritative: `firestore.rules` denies all writes to `users/*`, and the Admin SDK
  (which bypasses rules) is the only writer. A user editing the counter in devtools changes nothing.
- `/api/generate` requires a verified ID token whenever admin credentials are configured, and charges
  only after successful generation. Without admin credentials (demo mode) it serves placeholders.
- The in-memory rate limiter (10 requests/minute per IP) is per instance; add a shared limiter or App
  Check before exposing the route to real traffic.
- Published pages are public by design. Anyone with a 6-character id can read that design; don't publish
  anything private.
