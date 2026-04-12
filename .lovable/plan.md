
# Correction: Fallback recherche Dolibarr ne fonctionne pas

## Cause racine

Dans `create-user/index.ts` ligne 143, l'URL de recherche contient des caractères non encodés :
```
${dolibarrApiUrl}/users?sqlfilters=(login='bth.nadjib')
```
Les parenthèses et apostrophes ne sont pas URL-encodées. Dolibarr rejette probablement la requête, mais le code ne logge rien si `searchResp.ok` est `false` — le fallback échoue silencieusement et `dolibarr_user_id` reste `null`.

## Corrections dans `supabase/functions/create-user/index.ts`

1. **URL-encoder le paramètre `sqlfilters`** :
```typescript
const filter = encodeURIComponent(`(login='${login}')`);
const searchResp = await fetch(
  `${dolibarrApiUrl}/users?sqlfilters=${filter}&limit=1`,
  ...
);
```

2. **Ajouter un log si la recherche échoue** pour éviter les échecs silencieux :
```typescript
if (!searchResp.ok) {
  console.error("Dolibarr search failed:", await searchResp.text());
}
```

3. **Ajouter une recherche par email en fallback** si la recherche par login ne trouve rien :
```typescript
// Si pas trouvé par login, chercher par email
if (!dolibarrUserId) {
  const emailFilter = encodeURIComponent(`(email='${email}')`);
  const emailResp = await fetch(`${dolibarrApiUrl}/users?sqlfilters=${emailFilter}&limit=1`, ...);
  ...
}
```

## Fichier impacté

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/create-user/index.ts` | URL-encoder `sqlfilters`, ajouter logs d'erreur, fallback par email |

Correction mineure, une seule passe.
