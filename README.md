# Openmi

An AI front-end builder shaped like a chat: describe a site, watch a **multi-page static project**
stream into a sandboxed live preview, keep chatting to change it, then publish a permanent
`/p/<id>` link. Output is stored in **Firebase Storage** and grounded in **live web research**.

- **Next.js App Router + TypeScript + Tailwind CSS**
- **Firebase Auth** (Google + email/password, verification and password reset) and **Cloud Firestore**
- **Server-charged quotas**: a credit is taken only after a generation actually succeeds, and the
  browser cannot edit the counter
- **DeepSeek** (`deepseek-flash`) as the default generator, any OpenAI-compatible API as fallback
- **Multi-file output**: `index.html`, `styles.css`, `app.js`, extra pages — up to 8 files, no build step
- **Live research** (Exa) feeds current references and image URLs into each build, and is optional
- **Preview**: files are inlined into a Blob document while streaming, then served from Storage
  (`/api/preview/<chatId>/`) so links between pages work
- **Chat history**: each conversation is saved and can be reopened and continued

---

## Why do I see "Setup" / demo mode?

The badge in the header and the setup panel appear when a deployment is missing environment
variables. Four independent switches:

| Missing | Consequence |
| --- | --- |
| `DEEPSEEK_API_KEY` | Builds stream the built-in placeholder project instead of model output |
| `NEXT_PUBLIC_FIREBASE_*` | No accounts, no chats, no publishing → local demo session |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | No server quota and no Storage: whole-project previews and `/p/` links need it |
| `EXA_API_KEY` | Builds are designed from the prompt only — no live references or stock imagery |

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

### 2. Live research (optional)

```bash
EXA_API_KEY=...
```

[exa.ai](https://exa.ai) returns result snippets, source links and image URLs for a query. The route
turns the user's request into a search, then prepends a compact brief to the model message so builds
can use real references and hotlink real images. If the call fails or the key is missing, generation
continues unchanged. Only the returned image URLs are embedded in generated pages.

### 3. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: enable *Google* and *Email/Password*.
3. **Authentication → Settings → Authorized domains**: add `localhost` and your production domain.
4. **Authentication → Templates**: verification and reset emails use Firebase's hosted action handler.
5. **Firestore Database**: create a database and publish [`firestore.rules`](./firestore.rules):

   ```bash
   firebase deploy --only firestore:rules
   ```

6. **Storage**: create the default bucket. Generated projects are written to `previews/<chatId>/…`
   by the Admin SDK.
7. **Project settings → Your apps → Web app**: copy the config into `NEXT_PUBLIC_FIREBASE_*`.
8. **Project settings → Service accounts → Generate new private key**: put the JSON in
   `FIREBASE_SERVICE_ACCOUNT_KEY` (raw or base64 — `base64 -w0 serviceAccount.json`). This identity
   verifies ID tokens, charges quotas and writes Storage.

### 4. Email flows

- **Sign-up** sends a verification email; until confirmed, the chat header shows *Resend* / *Verified*.
- **Forgot?** on the sign-in form sends a reset link. Unknown addresses get the same neutral message,
  so the form can't be used to discover accounts.
- Both rely on Firebase's hosted handler, so the domain must be authorized or the links bounce.

---

## Production checklist

1. **Keys in the host**, not in the repo: `NEXT_PUBLIC_FIREBASE_*`, `DEEPSEEK_API_KEY`,
   `FIREBASE_SERVICE_ACCOUNT_KEY` (or the three individual fields), optional `EXA_API_KEY`,
   optional `FIREBASE_STORAGE_BUCKET`.
2. **Authorized domain** for auth, and **Storage** enabled in the same project.
3. **Firestore rules** deployed. `users/*` is read-only to its owner; `chats/*` is private;
   published `projects/*` are public-read and immutable.
4. **Build once per environment**: `NEXT_PUBLIC_*` is inlined at build time; server values are read
   per request.
5. **Smoke test**: sign up, verify, build a site, send a correction, publish, open `/p/<id>` in a
   private window, then reload the chat from *Chats*.
6. **Hardening (recommended)**: put a shared rate limiter (Upstash, Cloudflare) or Firebase App Check
   in front of `/api/generate` — its limiter is in-memory per instance. Also consider a lifecycle rule
   on the Storage bucket to expire previews for abandoned chats.

---

## How it works

| Piece | File | Notes |
| --- | --- | --- |
| Provider resolution | `lib/ai-config.ts` | DeepSeek first, OpenAI-compatible fallback, research flag for the UI |
| Research | `lib/server/research.ts` | Exa search → snippets + image URLs → prompt brief; failures are non-fatal |
| Generation API | `app/api/generate/route.ts` | Verifies the ID token, pre-checks quota, streams the model, saves files, charges on success |
| File format | `lib/file-bundle.ts` | Parses `<<<FILE path="…">>>` blocks, tolerating the unterminated last block |
| Preview | `lib/preview-html.ts`, `components/PreviewPane.tsx` | Inlines local CSS/JS into a Blob document while streaming |
| Stored preview | `app/api/preview/[chatId]/[[...path]]/route.ts` | Serves the project from Storage, so relative links between pages resolve |
| Chat UI | `components/Builder.tsx` | Thread, composer, corrections, chat switcher, publish |
| Publishing | `lib/backend/firebase.ts`, `app/p/[id]/page.tsx` | 6-character id in `projects/{id}`; the viewer iframes the stored project |

### Data model

| Path | Contents | Access |
| --- | --- | --- |
| `users/{uid}` | `generations_left`, `last_reset_date` | Owner read, **server write only** |
| `chats/{chatId}` | `title`, `entry`, `files[]` (path + contents), `messages[]`, `published_id` | Owner only |
| `projects/{id}` | `chat_id`, `entry` — the public `/p/` page | Public read, immutable |
| Storage `previews/{chatId}/…` | The servable project files | Read via `/api/preview/…` |

The chat document carries file contents so a conversation can be reopened and continued; Storage holds
the copy that is actually served, so page-to-page links work.

### Quota, charged on success

1. The browser sends its Firebase ID token with each turn.
2. `readRemaining()` refuses an exhausted account before any model call.
3. The response streams the file bundle. When the upstream stream ends **normally**, the route parses
   the bundle, writes the files to Storage, and charges one credit inside a transaction — all before
   closing the stream, so the counter the browser reads afterwards is already settled.
4. Errors, empty output and interrupted streams charge nothing.

Demo mode (no Firebase) keeps a browser-local counter and decrements it after a successful build; it is
explicitly not a security boundary.

---

## Security notes

- Generated pages and published links run in `<iframe sandbox>` **without** `allow-same-origin`, so
  their JavaScript cannot touch cookies, `localStorage` or the parent document.
- Quotas are server-authoritative: `firestore.rules` denies all writes to `users/*`, and the Admin SDK
  is the only writer.
- `/api/generate` requires a verified ID token whenever admin credentials are configured.
- `/api/preview/<chatId>/…` is an unguessable capability URL: anyone with the chat id can read those
  files, but chat documents (and thus the id) are private. Treat published output as public by design;
  if previews must be strictly private, front them with signed URLs.
- The in-memory rate limiter (10 requests/minute per IP) is per instance.
