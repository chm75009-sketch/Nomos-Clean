# État de la sécurisation — HACCP Pro / Nomos (projet kiknaxuzpovvivkjqzss)

> Suite aux 2 audits externes (21/06/2026). Bilan de ce qui est fait et de ce qu'il reste.

## ✅ FAIT — sécurisé et stable

| Élément | Détail |
|---|---|
| **Mots de passe hachés (bcrypt)** | `etablissements` + `comptes_clients` ; `login_etab` vérifie le hash et migre à la volée |
| **`etablissements` verrouillée** | RLS : policies `etab_insert/update/delete` (anon), **pas de SELECT** → emails/tél/adresses non lisibles en anonyme. Lecture admin via RPC. |
| **`comptes_clients` verrouillée** | SELECT anon coupé (policy `Allow public select on clients` supprimée) |
| **`historique_admin` verrouillée** | SELECT anon coupé |
| **`demandes_inscription` verrouillée** | INSERT public conservé (formulaire), reste coupé |
| **Opérations admin via RPC** (security definer, gardées par `admin_check`) | `admin_list_demandes/comptes/etablissements/historique`, `admin_validate_demande`, `admin_refuse_demande`, `admin_get_etab`, `admin_update_client` |
| **Flux publics via RPC** | `get_essai_config`, `eu3j_stats`, `reset_password` (mot de passe oublié = reset sécurisé) |
| **Consentement RGPD** | horodaté à l'inscription (`rgpd_accepte_le`), affiché dans l'admin |
| **Hébergement UE** | Supabase West EU (Irlande) |

→ **La fuite de données personnelles des 2 rapports est FERMÉE.**

## ✅ FAIT — `controles_haccp` VERROUILLÉE (RLS actif)

**État : RLS ACTIVÉ et fonctionnel.** Chaque vrai compte ne voit/écrit que SES contrôles.

**Mécanique en place :**
- `sync_auth_login(p_code, p_pwd, p_estid, p_etabid)` : à **chaque connexion réussie**, `login_etab` l'appelle pour synchroniser le compte Supabase Auth (mot de passe haché + `app_metadata` avec `establishment_id`, `etab_id` = `etablissements.id`, et `code`). → tout compte (présent ou futur) obtient un JWT valide à sa connexion, **automatiquement**.
- Le frontend (`_ouvrirSessionAuth`) ouvre la session Auth après `login_etab` → le JWT (porteur de `etab_id`) sert de bearer pour les lectures/écritures de contrôles.
- Policies RLS (cloisonnement par **ID interne**, qui est ce que contient réellement `code_client` pour les vrais comptes) :
  ```sql
  using/with check ( code_client = (auth.jwt() -> 'app_metadata' ->> 'etab_id')
                     OR code_client like 'local-%' )
  ```
  → un vrai client ne voit que ses contrôles ; les contrôles démo `local-…` (non sensibles, ex. RTH75) restent accessibles pour ne pas casser les comptes de test.

**Points clés appris :**
- `code_client` des vrais comptes = `etablissements.id` (UUID), PAS le code_acces ni `establishment_id`.
- 238/279 contrôles étaient des démos `local-RTH75/RTH3` → laissés ouverts (non sensibles).
- L'équipe est stockée DANS `controles_haccp` (`module='__equipe_registre__'`, `code_client=ETAB_ID`) → couverte par la même règle, donc OK pour les vrais comptes et les démos.

**Rollback de secours** (si jamais un souci) :
```sql
alter table public.controles_haccp disable row level security;
```

→ **Les 5 tables sont désormais verrouillées. Audit entièrement traité côté fuite de données.**

## ⏭️ Secondaire (rapport audit, plus tard)
- Retirer les comptes test en clair du code (`RTH75`/`826700` dans `CODES_LOCAUX`).
- Pages légales accessibles (mentions / politique de confidentialité) + CSP `<meta>`.
- (Optionnel) Horodatage qualifié RFC 3161 pour les signatures.
