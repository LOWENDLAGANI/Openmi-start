# Openmi

An AI front-end builder: describe a UI, watch it stream into a sandboxed live preview, then publish
it to a permanent `openmi.app/p/<id>` link.

- **Next.js App Router + TypeScript + Tailwind CSS**
- **Firebase Auth** (Google + email/password) and **Cloud Firestore** for quotas and published projects
- **DeepSeek** (`deepseek-flash`) as the default generator, any OpenAI-compatible API as fallback
- **Zero-runtime preview**: generated code becomes a `Blob` URL inside a sandboxed `<iframe>`
- **Visual system**: warm cream canvas, charcoal ink and a single hot-orange accent, set in Space Grotesk + IBM Plex Mono (a groq.com-inspired editorial look). Tokens live in `tailwind.config.ts`, component classes in `app/globals.css`.

---

## Why do I see "Setup" / demo mode?

The badge in the builder header and the "Setup needed" panel appear when a deployment is missing
environment variables. There are two independent switches:

| Missing | Consequence |
| --- | --- |
| `DEEPSEEK_API_KEY` | Generations stream the built-in placeholder design instead of model output |
| `NEXT_PUBLIC_FIREBASE_*` | No accounts, no Firestore quotas, no publishing → local demo session |

Set both and restart the server: the badge switches to the provider name and the panel disappears.
Nothing else needs code changes.

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
4. **Firestore Database**: create a database, then publish the rules in [`firestore.rules`](./firestore.rules):

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Project settings → Your apps → Web app**: copy the config into `.env.local`.

---

## Production checklist

1. **Keys in the host**, not in the repo: set the six `NEXT_PUBLIC_FIREBASE_*` values plus
   `DEEPSEEK_API_KEY` (and optional `DEEPSEEK_MODEL`) in your platform's environment settings.
2. **Authorized domain**: add the real domain in Firebase → Authentication → Settings.
3. **Firestore rules**: deploy `firestore.rules`. Published projects are public-read and immutable;
   quota documents are owner-only.
4. **Build once per environment**: `NEXT_PUBLIC_*` values are inlined at build time, so rebuild after
   changing them. `DEEPSEEK_*` and `OPENAI_*` are read per request at runtime.
5. **Smoke test**: open `/`, sign in, generate, publish, then open the `/p/<id>` link in a private
   window. A bad provider key returns a 502 with a readable message instead of a blank preview.
6. **Hardening (recommended for real traffic)**: move quota enforcement into a callable Cloud
   Function for server-authoritative limits, and put a shared rate limiter (Upstash, Cloudflare) or
   Firebase App Check in front of `/api/generate` — its current limiter is in-memory per instance.

---

## How it works

| Piece | File | Notes |
| --- | --- | --- |
| Provider resolution | `lib/ai-config.ts` | DeepSeek first, OpenAI-compatible fallback, safe status for the UI |
| Streaming API | `app/api/generate/route.ts` | Proxies provider SSE as plain text, 10 req/min per IP |
| HTML wrapper | `lib/preview-html.ts` | Strips markdown fences, injects Tailwind/Lucide CDNs and the house-style fonts |
| Live preview | `components/PreviewPane.tsx` | New `Blob` URL per update, sandboxed iframe, desktop/mobile frames |
| Auth + quota + publish | `components/AuthProvider.tsx`, `lib/backend/*` | One `Backend` interface, two implementations: Firestore and a keyless demo |
| Publishing | `lib/backend/firebase.ts`, `app/p/[id]/page.tsx` | 6-character id in `projects/{id}`, server-rendered viewer via the Firestore REST API |

### Daily quota

`users/{uid}` holds `generations_left` and `last_reset_date` (UTC `YYYY-MM-DD`). Every generation
runs a Firestore transaction that:

1. resets `generations_left` to 5 when `last_reset_date` is not today,
2. decrements by one when credits remain,
3. refuses the request when the counter is already 0.

The client never assumes success: the UI only starts a generation after the transaction allows it.

---

## Security notes

- Preview and published pages run in `<iframe sandbox>` **without** `allow-same-origin`, so generated
  JavaScript cannot touch cookies, `localStorage` or the parent document.
- `firestore.rules` makes published projects public-read and immutable, while quota documents are only
  readable/writable by their owner.
- `/api/generate` is unauthenticated by design (the quota lives in Firestore). It is rate limited per IP
  in memory; for a hardened multi-instance deployment, put a real rate limiter or Firebase App Check in
  front of it.
- Firestore writes happen from the browser with the web SDK, so the client-side rules are the
  enforcement point for the quota. A determined user can bypass their own counter; add a callable Cloud
  Function if you need server-authoritative quotas.
