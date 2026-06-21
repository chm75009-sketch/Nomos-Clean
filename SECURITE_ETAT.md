# État de la sécurisation — HACCP Pro / Nomos (projet kiknaxuzpovvivkjqzss)

> Suite à 3 audits externes (21/06/2026). Bilan de ce qui est fait et de ce qu'il reste.
>
> **✅ 3ᵉ audit (navigation privée) PASSÉ** : RLS confirmée active sur les 9 tables,
> accès anonyme à `controles_haccp` coupé (retourne `[]`), mot de passe admin non
> exposé. Application déclarée **sécurisée sur ses vecteurs d'attaque majeurs**.

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
| **Mot de passe admin dans le Vault** | `admin_check` lit le secret `admin_password` (Vault). **Repli public `826700` SUPPRIMÉ** : secret vide → accès refusé (plus aucun retour au mot de passe public). Secret fort défini sur les 2 projets. |
| **`826700` retiré du code client (module Audit)** | `DEFAULT_ADMIN_PWD` vidé dans `audit/shared.js` + `audit/audit.html` (et versions isolées). Login admin **fail-closed** : serveur injoignable → accès refusé (plus de repli `getAdminPwd()`). |
| **`enregistrements` VERROUILLÉE** | Table morte (jamais relue/écrite par l'app, cf. `sbSauvegarderModule` no-op). Policy ouverte `acces enregistrements` (`using=true`) **SUPPRIMÉE** → plus aucun accès anonyme. |
| **XSS échappés** | Noms de fichiers (`_echap`) + message « email envoyé à … » (`audit/index.html`, `audit/audit.html`, audits isolés) échappé via `replace(/[&<>"]/g, …)`. |
| **Consentement RGPD** | horodaté à l'inscription (`rgpd_accepte_le`), affiché dans l'admin |
| **Hébergement UE** | Supabase West EU (Irlande) |

→ **La fuite de données personnelles des 3 rapports est FERMÉE.**

## ✅ FAIT — `controles_haccp` VERROUILLÉE (RLS actif)

**État : RLS ACTIVÉ et fonctionnel.** Chaque vrai compte ne voit/écrit que SES contrôles.

**Mécanique en place :**
- `sync_auth_login(p_code, p_pwd, p_estid, p_etabid)` : à **chaque connexion réussie**, `login_etab` l'appelle pour synchroniser le compte Supabase Auth (mot de passe haché + `app_metadata` avec `establishment_id`, `etab_id` = `etablissements.id`, et `code`). → tout compte (présent ou futur) obtient un JWT valide à sa connexion, **automatiquement**.
- Le frontend (`_ouvrirSessionAuth`) ouvre la session Auth après `login_etab` → le JWT (porteur de `etab_id`) sert de bearer pour les lectures/écritures de contrôles.
- Policy de **lecture** (`ch_select`) **resserrée le 21/06** — la branche `local-%` a été **retirée** (le 3ᵉ audit a montré qu'elle laissait lire les lignes de test en anonyme) :
  ```sql
  -- SELECT (ch_select) : lecture réservée à chaque établissement authentifié
  using ( code_client = (auth.jwt() -> 'app_metadata' ->> 'etab_id') )
  ```
  → la clé publique seule ne lit **plus rien**. Seul effet de bord : le compte démo `RTH75` ne recharge plus son équipe depuis le cloud (non gênant, compte de test).
- Policies d'**écriture** (`ch_insert` / `ch_update`) inchangées (cloisonnement par `etab_id`).

**Points clés appris :**
- `code_client` des vrais comptes = `etablissements.id` (UUID), PAS le code_acces ni `establishment_id`.
- L'équipe est stockée DANS `controles_haccp` (`module='__equipe_registre__'`, `code_client=ETAB_ID`) → couverte par la même règle, donc OK pour les vrais comptes.

**Rollback de secours** (si jamais un souci) :
```sql
alter table public.controles_haccp disable row level security;
```

→ **Toutes les tables sensibles sont verrouillées. Les 3 audits sont traités côté fuite de données.**

## 🔐 Vérifier l'état de la base (à tout moment)
```sql
-- RLS active par table (doit être =true partout)
select string_agg(relname||'='||relrowsecurity, ' | ' order by relname)
from pg_class where relnamespace='public'::regnamespace and relkind='r';

-- Règles de LECTURE publique (ne doit rester que controles_haccp scopé par etab_id)
select string_agg(tablename||' ['||cmd||'] using='||coalesce(qual,'∅'), E'\n' order by tablename)
from pg_policies where schemaname='public' and cmd in ('SELECT','ALL');
```

## ⏭️ Secondaire / optionnel (non bloquant)
- Retirer le compte test `RTH75` du code (`CODES_LOCAUX`) quand les démos n'en ont plus besoin.
- En-têtes HTTP de sécurité (CSP, X-Frame-Options…) : **impossibles sur GitHub Pages** → nécessitent un changement d'hébergeur (Cloudflare Pages / Netlify, gratuit).
- Code de validation email (OTP) généré côté serveur (Edge Function) au lieu du navigateur.
- Surveillance des logs Supabase (appels échoués à `login_etab` / `admin_check` = tentative de brute-force).
- (Optionnel) Horodatage qualifié RFC 3161 pour les signatures.
