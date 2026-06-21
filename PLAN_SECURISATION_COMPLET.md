# Plan de sécurisation complet — Nomos / HACCP Pro / Audit

> Suite à l'audit externe du 21/06/2026. Objectif : corriger les failles **avant
> commercialisation**, en traitant **séparément** les 3 briques (périmètres et
> backends différents). Aucune donnée réelle en production à ce jour (test/démo) →
> pas d'urgence RGPD, mais corrections requises avant ouverture commerciale.

## Vue d'ensemble : 3 briques, 3 périmètres

| Brique | Backend | Données | Niveau de risque actuel |
|---|---|---|---|
| **1. Nomos (vitrine)** `accueil.html` | EmailJS uniquement | Aucune stockée | ✅ Faible — déjà sécurisée |
| **2. HACCP Pro** `script.js` | Supabase `kiknaxuzpovvivkjqzss` | Établissements, abonnés, contrôles | 🔴 **Critique** |
| **3. App Audit** `audit/` | Supabase `zdwdeavcwivvdtrjqwme` | Prospects, demandes, audits | 🟠 Moyen |

---

## BRIQUE 1 — Nomos (vitrine) ✅

**État : rien de critique.** La page ne stocke aucune donnée, n'a pas de base.
- `0` `innerHTML` (pas de XSS), mailto encodé, honeypot anti-spam en place.
- **Action : aucune.** (Le rapport d'audit ne visait pas cette page.)

---

## BRIQUE 2 — HACCP Pro 🔴 (priorité absolue)

### Failles confirmées (preuves dans le code)
| # | Faille | Preuve |
|---|---|---|
| H1 | Accès anonyme en lecture aux tables sensibles (RLS non activé) | `_sbBearer()` retombe sur la clé anon ; login lit `etablissements` en anon (`script.js:606`) |
| H2 | Mots de passe **en clair** stockés | `mot_de_passe: pwd` (`script.js:1935, 2024`) |
| H3 | Mot de passe vérifié **côté client** | `etab.mot_de_passe !== pwd` (`script.js:659`) |
| H4 | `comptes_clients`, `historique_admin`, `demandes_inscription` sans aucune policy RLS | absentes de `backend/migration_securite.sql` |
| H5 | Suppression possible en anon sur `historique_admin` | aucune policy DELETE restrictive |

### Cause racine
La migration `backend/migration_securite.sql` était **écrite mais jamais activée** :
l'« Étape C » (activation RLS + coupure anon) n'a pas été exécutée car elle casse
l'app tant que le login n'est pas passé en Auth. Le `drop column mot_de_passe`
est resté en commentaire.

### Cible (architecture sécurisée)
1. **Login via Supabase Auth uniquement** (mot de passe haché bcrypt côté GoTrue).
   Supprimer toute lecture de `etablissements.mot_de_passe` et toute comparaison
   client.
2. **RLS activé sur TOUTES les tables**, chaque établissement ne voit que ses
   données (via `establishment_id` du JWT).
3. **Opérations admin** (lire `comptes_clients`, `historique_admin`, valider une
   `demande_inscription`) via **RPC `security definer`** réservées à un rôle admin,
   jamais en accès table direct anon.
4. **Formulaire d'inscription public** : `demandes_inscription` autorise
   l'INSERT anon **mais pas le SELECT**.
5. **Supprimer les colonnes `mot_de_passe`** une fois tous les comptes migrés vers
   Auth.

### Ordre de bascule SÛR (ne casse rien jusqu'au point ⑤)
1. ① **Créer un compte Auth par établissement** (email + mot de passe), lier
   `establishment_id` dans `app_metadata`. (Dashboard Supabase ou API admin.)
2. ② **Déployer le frontend Auth-only** : login = `signInWithPassword`
   exclusivement ; suppression de la comparaison en clair ; admin via RPC.
   *(préparé, à appliquer pendant la fenêtre de bascule — voir checklist)*
3. ③ **Exécuter le SQL RLS complet** (ci-dessous) — Étapes A/B déjà non-cassantes,
   puis Étape C.
4. ④ **Vérifier** : login OK, lecture limitée à son établissement, plus aucun
   accès anon en SELECT sur les tables sensibles.
5. ⑤ **Supprimer les colonnes `mot_de_passe`** (`etablissements`, `comptes_clients`).
6. ⑥ **Roter la clé anon** (l'ancienne a fuité dans le code public).

### SQL complet à exécuter (complète `migration_securite.sql`)
```sql
-- ÉTAPE C-bis — RLS sur les tables NON couvertes par migration_securite.sql
-- (à lancer pendant la fenêtre de bascule, après déploiement du frontend Auth)

-- 1) comptes_clients : aucun accès anon. Lecture/écriture réservées à l'admin (RPC).
alter table public.comptes_clients enable row level security;
-- (pas de policy anon => refus par défaut ; l'admin passe par des RPC security definer)

-- 2) historique_admin : aucun accès anon (ni lecture, ni insert, ni delete).
alter table public.historique_admin enable row level security;
-- l'écriture d'historique se fait via RPC security definer (cf. log_admin_action)

-- 3) demandes_inscription : INSERT public autorisé, SELECT interdit en anon.
alter table public.demandes_inscription enable row level security;

drop policy if exists demandes_insert_public on public.demandes_inscription;
create policy demandes_insert_public on public.demandes_inscription
  for insert to anon, authenticated with check (true);
-- pas de policy SELECT pour anon => les prospects ne sont JAMAIS lisibles en anon

-- 4) RPC admin (exemple) : journaliser une action admin sans exposer la table.
create or replace function public.log_admin_action(p_action text, p_code text, p_motif text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.historique_admin(action, code_concerne, motif)
  values (p_action, p_code, p_motif);
end $$;
revoke all on function public.log_admin_action(text,text,text) from public, anon;
grant execute on function public.log_admin_action(text,text,text) to authenticated;
```
> Les Étapes A/B/C pour `etablissements` et `controles_haccp` sont déjà dans
> `backend/migration_securite.sql` — il reste à **les exécuter** (Étape C) après
> la bascule frontend.

---

## BRIQUE 3 — App Audit 🟠 (`audit/`, projet `zdwdeavcwivvdtrjqwme`)

### Constats
| # | Point | Preuve |
|---|---|---|
| A1 | Mot de passe admin par défaut `826700` **en clair dans le code** | `audit/shared.js:10` |
| A2 | À confirmer : RLS actif sur `demandes`/`prospects`/`audits` (sinon les RPC sont contournables par lecture directe anon) | `saveDemande_remote` POST anon `audit/shared.js:67` |
| A3 | `audits` écrits en anon — vérifier qu'on ne peut pas lire ceux des autres | `audit/audit.html:9297` |

### Bon point déjà en place
Les lectures sensibles passent par des **RPC** (`admin_list_demandes`,
`admin_update_demande`, `admin_delete_demande`) avec mot de passe vérifié
**côté serveur** → bonne architecture, à condition que le RLS bloque l'accès
direct aux tables.

### Actions
1. **Confirmer/activer le RLS** sur `demandes`, `prospects`, `audits` :
   ```sql
   alter table public.demandes  enable row level security;
   alter table public.prospects enable row level security;
   alter table public.audits    enable row level security;
   -- INSERT public (formulaires), pas de SELECT anon :
   create policy demandes_insert  on public.demandes  for insert to anon with check (true);
   create policy prospects_insert on public.prospects for insert to anon with check (true);
   -- audits : insert/lecture réservés à l'établissement authentifié (via RPC ou JWT)
   ```
2. **Remplacer le mot de passe admin en dur** : ne plus passer `826700` depuis le
   client. La RPC admin doit vérifier un **secret stocké côté serveur** (table
   `admin_secret` hachée, ou variable d'environnement de la fonction), jamais une
   valeur par défaut connue.
3. **Roter la clé anon** de ce projet aussi (elle est publique dans le code).

---

## Récapitulatif des actions par responsable

| Action | Où | Qui |
|---|---|---|
| Frontend Auth-only (HACCP Pro) | `script.js` | Claude prépare, appliqué à la bascule |
| SQL RLS complet (HACCP Pro) | Dashboard Supabase `kikna…` | Toi (accès Supabase requis) |
| Créer comptes Auth établissements | Dashboard Supabase | Toi |
| RLS app Audit + secret admin | Dashboard Supabase `zdwde…` | Toi |
| Rotation des 2 clés anon | Dashboard Supabase ×2 | Toi |
| Drop colonnes `mot_de_passe` | SQL, après migration | Toi |

> ⚠️ Les étapes « Dashboard Supabase » nécessitent un accès que Claude n'a pas.
> Claude fournit le SQL et le code prêts ; l'exécution se fait côté Supabase.
