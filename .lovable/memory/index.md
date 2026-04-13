# Project Memory

## Core
Light minimalist theme. Primary #1978E5, bg white, Inter font, radius 8px.
French electrical company ERP connected to Dolibarr API via edge function proxy.
No glass/glass-strong utilities. Solid cards with bg-card border-border shadow-sm.
Solid bg-primary buttons, no gradients.
Roles: admin, secretaire, technicien — sidebar adapts per role.
API adresse.data.gouv.fr for address autocomplete (no key needed).
Facture status: 0=Brouillon(grey), >=1 && !paye=Impayée(amber), paye=Payée(green).
Email: via edge function send-email-smtp (SMTP OVH), NO Dolibarr sendByEmail endpoints.
Auto-confirm email enabled for immediate user activation.
Intervention statuts: 0=Brouillon, 1=Validée, 2=En cours, 3=Terminée, 5=Fermée (native Dolibarr).
Devis→Facture: GET devis lines then POST /invoices (no /createinvoice endpoint).

## Memories
- [Dolibarr API mapping](mem://features/dolibarr-api) — Field mapping from Dolibarr to TypeScript interfaces
- [User roles & permissions](mem://features/roles) — Admin/Secrétaire/Technicien permission matrix
- [Intervention workflow](mem://features/interventions) — Types, anti-collision, signature, PDF generation
- [Config defaults](mem://features/config) — TVA 20%, délai 30j, durée intervention 2h, taux horaire 45€
- [Dolibarr conformity](mem://constraints/dolibarr-conformity) — No phantom fields/endpoints, strict REST API only
