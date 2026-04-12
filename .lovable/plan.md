

# Plan: Fix API + Light Theme (6 étapes) — FINAL

## Étape 1 — Auth Auto-confirm
Use `configure_auth` tool to enable auto-confirm email signups.

## Étape 2 — Fix Synchronisation & Statuts
- After validate/close mutations in `Devis.tsx`, `Interventions.tsx`, `Factures.tsx`: close detail dialog, let `invalidateQueries` refresh the list with real `fk_statut`.
- **Factures status fix**: In `dolibarr.ts`, if `fk_statut === 0` → "Brouillon" (grey), not "En retard". Only show "Impayée" for `fk_statut >= 1 && !paye`.

## Étape 3 — Fix Email (Remove local fallback)
- Remove `supabase.from('email_history').insert(...)` from Devis, Factures, Interventions pages.
- Keep only Dolibarr `sendByEmail` calls. Show real API errors via `toast.error()`.

## Étape 4 — Boutons CRUD + Générer Facture
- **Modifier** (PUT): Add edit button on Devis drafts, Catalogue products, Client fiches.
- **Générer Facture**: Add button on Devis with status "Validé" or "Signé" calling `POST /proposals/{id}/createinvoice`. Already have `useConvertDevisToFacture` hook.

## Étape 5 — Mapping Interventions
- Use `datest` for display date in `mapDolibarrIntervention`.
- Resolve `user_author_id` against Dolibarr users list for technician `fullname`.

## Étape 6 — Light Minimalist Redesign
- `index.css`: Light CSS variables (white bg, `#1978E5` primary). Remove glass utilities.
- `tailwind.config.ts`: `--radius: 0.5rem`, Inter font.
- All pages: Replace glass/gradient with solid cards and primary buttons.

### Files impacted
| File | Changes |
|---|---|
| Auth config | auto-confirm |
| `src/services/dolibarr.ts` | Facture status fix, intervention date/tech mapping |
| `src/pages/Devis.tsx` | Dialog refresh, edit draft, generate invoice button, remove local email |
| `src/pages/Factures.tsx` | Dialog refresh, remove local email |
| `src/pages/Interventions.tsx` | Dialog refresh, remove local email, tech name display |
| `src/pages/Catalogue.tsx` | Verify edit button |
| `src/pages/Clients.tsx` | Verify edit button |
| `src/index.css` | Light theme variables |
| `tailwind.config.ts` | Radius, Inter font |
| All pages + components | Remove glass/gradient references |

