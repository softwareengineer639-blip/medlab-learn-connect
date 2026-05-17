# Netlify Static SPA Conversion

## What changes (and why it's a real rewrite)

Your app currently runs server-side code on Cloudflare Workers. Netlify static hosting can't run that. To make it work, I need to remove the server layer and move every protected operation to the browser, secured by Supabase RLS instead of a server-checked password.

## 1. Replace the admin password with an admin user role

The current `ADMIN_PASSWORD` env var is checked on the server. On a static site, any password shipped to the browser is readable by anyone who opens DevTools — that's not security, it's decoration. The correct fix is Supabase-native:

- New `user_roles` table (`user_id`, `role` enum: `admin` | `student`)
- `has_role(user_id, role)` security-definer function
- RLS policies on `notes` allowing INSERT/UPDATE/DELETE only when `has_role(auth.uid(), 'admin')`
- You sign in to the admin dashboard with a normal email/password account that has been granted the `admin` role in the database
- I'll grant admin to one account you specify (or you can do it manually via the backend UI)

Result: the lecturer logs in like a student does, but the dashboard appears because their role is `admin`. Much stronger than a shared password.

## 2. Rewrite the server functions as direct Supabase calls

- Delete `src/lib/admin.functions.ts`
- Delete `src/integrations/supabase/auth-middleware.ts` usage and `client.server.ts` usage
- `src/routes/admin.tsx` queries `notes`, `profiles`, `reactions`, `comments`, `discussion_messages` directly via the browser Supabase client; RLS enforces admin-only writes
- Engagement counts computed client-side from the same queries

## 3. Switch the build target from Cloudflare Worker to static SPA

- Replace `vite.config.ts` with a plain `@vitejs/plugin-react` + TanStack Router file-router config (no `@cloudflare/vite-plugin`, no SSR entry)
- Update `src/router.tsx` / `__root.tsx` to render as a pure SPA (no `HeadContent`/`Scripts` SSR shell — use a regular `index.html`)
- Add `index.html` at the project root
- Delete `wrangler.jsonc`, `src/server.ts`, `src/start.ts`
- `npm run build` produces `dist/`

## 4. Netlify configuration files

- `public/_redirects`: `/* /index.html 200`
- `netlify.toml`: build command `npm run build`, publish dir `dist`, Node version pinned
- Document the two env vars to set in Netlify: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`

## 5. Verify

- Run the production build locally and confirm `dist/index.html` + assets exist
- Smoke-check routes load and Supabase calls work

## What you lose / accept

- **Lovable Publish stops working for this project** — once I rip out the Cloudflare/TanStack-Start runtime, your `.lovable.app` URL also breaks. Netlify becomes the only deployment target.
- **The shared admin password is gone.** Admin access is per-user-account via the `user_roles` table.
- **No more SSR / server functions.** If you later want gated server-side logic (private API keys, secret-checked webhooks), you'd need Netlify Functions or move back.

## What I need from you to proceed

1. **Confirm you're okay losing Lovable Publish for this project** (this is the big one — there is no going back without reverting).
2. **The email of the account that should be the initial admin** (you can sign it up first at `/signup`, then tell me the email, and I'll grant the role in the migration). Or I can seed a fresh admin account.

Once you confirm, I'll execute the migration, rewrite the files, and run the production build to verify.
