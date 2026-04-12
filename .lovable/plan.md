

# Plan: Fix Auth, Dolibarr Conflicts, Accessibility & Sync

## 1. Fix Auth — Zero Friction User Creation

**File: `supabase/functions/create-user/index.ts`**
- Change `email_confirm: false` → `email_confirm: true` on line 77. This tells the admin API to mark the email as confirmed immediately, so the user can log in without checking their inbox.
- Also use `configure_auth` tool to ensure `auto_confirm` is enabled at the project level.

## 2. Dolibarr User Conflict — Graceful Degradation

**File: `src/services/dolibarr.ts`**
- Wrap `createDolibarrUser` in try/catch. On error containing "existe déjà" or status 500:
  - Call `GET /users?sqlfilters=(t.login='${login}')` to find existing user
  - Return the existing user ID instead of throwing
- Toast message: "Utilisateur Dolibarr existant lié avec succès"

**File: `src/hooks/useDolibarr.ts`**
- Update `useCreateDolibarrUser` onError to check if the error is a "duplicate" and show the appropriate message instead of generic "Synchro échouée".

## 3. Accessibility — DialogDescription Warnings

**File: `src/components/ui/dialog.tsx`**
- In `DialogContent`, add a default `DialogPrimitive.Description` with `className="sr-only"` when no description is provided, using `aria-describedby={undefined}` approach. Actually, the cleaner fix: update the `DialogContent` component to accept an optional `aria-describedby` override.

**All pages with `DialogContent` without `DialogDescription`:**
- `Utilisateurs.tsx` (create user dialog) — add `<DialogDescription className="sr-only">Formulaire de création d'utilisateur</DialogDescription>`
- `Devis.tsx` (multiple dialogs) — add sr-only descriptions
- `Factures.tsx` (create, detail, email dialogs) — add sr-only descriptions
- `Interventions.tsx` — add sr-only descriptions
- `Catalogue.tsx` — add sr-only descriptions
- `Clients.tsx` — add sr-only descriptions

Import `DialogDescription` in each file where missing.

## 4. Sync — invalidateQueries Reinforcement

The hooks already have `invalidateQueries` in `onSuccess`. The issue is that **page-level components** call mutations without `onSuccess` callbacks that close the detail dialog and reset local state.

**Files: `Devis.tsx`, `Factures.tsx`, `Interventions.tsx`**
- After every mutation call (validate, close, delete), add `.then(() => { setSelected(null); })` or use the mutation's `onSuccess` option to close the detail modal, forcing re-render from the invalidated query cache.

---

### Summary

| Change | File(s) |
|--------|---------|
| `email_confirm: true` | `create-user/index.ts` + auth config |
| Dolibarr duplicate user fallback | `dolibarr.ts`, `useDolibarr.ts` |
| sr-only DialogDescription | All 6 pages + dialog component |
| Close modal after mutation | `Devis.tsx`, `Factures.tsx`, `Interventions.tsx` |

