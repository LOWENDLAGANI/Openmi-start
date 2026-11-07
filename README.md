# Openmi

An AI front-end builder: describe a UI, watch it stream into a sandboxed live preview, then publish
it to a permanent `openmi.app/p/<id>` link.

- **Next.js App Router + TypeScript + Tailwind CSS**
- **Firebase Auth** (Google + email/password) and **Cloud Firestore** for quotas and published projects
- **Zero-runtime preview**: generated code becomes a `Blob` URL inside a sandboxed `<iframe>`
- **Streaming generation** from any OpenAI-compatible chat completions API

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Without keys the app boots in **demo mode**: a placeholder design is streamed from the server, the
quota counter is stored in `localStorage`, and publishing is disabled with an explanatory message.

### 1. Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: enable *Google* and *Email/Password*.
3. **Authentication → Settings → Authorized domains**: add `localhost` and your production domain.
4. **Firestore Database**: create a database, then publish the rules in [`firestore.rules`](./firestore.rules):

   ```bash
   firebase deploy --only firestore:rules
   ```

5. **Project settings → Your apps → Web app**: copy the config into `.env.local`:

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

### 2. AI generator

```bash
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # optional
OPENAI_MODEL=gpt-4o-mini                    # optional
```

Any OpenAI-compatible endpoint works — for example the Freebuff API
(`OPENAI_BASE_URL=https://freebuff.com/api/v1/paid`). The key is only read inside the server route.

---

## Deploy

The app is a standard Next.js deployment (Vercel, Cloud Run, a Node host). Set the same environment
variables in your host. `npm run build && npm start` runs the production server.

---

## How it works

| Piece | File | Notes |
| --- | --- | --- |
| Auth + quota + publish | `components/AuthProvider.tsx`, `lib/backend/*` | One `Backend` interface, two implementations: Firestore and a keyless demo |
| Streaming API | `app/api/generate/route.ts` | Proxies an OpenAI-compatible SSE stream as plain text, 10 req/min per IP |
| HTML wrapper | `lib/preview-html.ts` | Strips markdown fences, injects the Tailwind + Lucide CDNs |
| Live preview | `components/PreviewPane.tsx` | New `Blob` URL per update, sandboxed iframe, desktop/mobile frames |
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
