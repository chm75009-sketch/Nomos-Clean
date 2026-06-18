# Runbook — Migration sécurité backend (Supabase)

> Objectif : corriger SEC-1→4, M1/M2, DATA-3/4, CONC-2 **sans casser l'app live**.
> Fichier SQL associé : `migration_securite.sql` (3 étapes A / B / C).
>
> ⚠️ **Règle d'or** : l'étape **C casse l'app** tant que le frontend authentifié (JWT)
> n'est pas déployé. Étapes **A et B sûres** (additives), **C en fenêtre de bascule**.

---

## Étape A — Additif (sûr, à faire dès maintenant)
1. Dashboard Supabase → **SQL Editor** → coller le bloc **ÉTAPE A** → Run.
2. Vérifier :
   - `etablissements.establishment_id` rempli (UUID) pour chaque ligne.
   - `controles_haccp.establishment_id` rempli (backfill A6) — sinon vérifier que
     `code_client = etablissements.code_acces`.
   - Insérer un contrôle de test → `recorded_at` et `seal` se remplissent seuls.
3. **Aucun changement frontend requis.** L'app continue de fonctionner à l'identique.

## Étape B — Auth & Storage (sûr, préparation)
1. Coller le bloc **ÉTAPE B** (table `memberships` + helpers).
2. **Authentication → Users** : créer 1 utilisateur par établissement
   (email pro + mot de passe). Renseigner `app_metadata.establishment_id` = l'UUID
   de l'établissement (via API admin `auth.admin.updateUserById`).
3. `insert into memberships(user_id, establishment_id) values (...)` pour chaque compte.
4. **Storage** : créer/garder le bucket `haccp-photos`, le passer **Privé**
   (Storage → Settings → Public = OFF). Ajouter une policy d'accès par préfixe
   `establishment_id/`. (Tant que le frontend lit encore en URL publique, NE PAS
   couper le public avant la bascule C.)

## Étape C — Bascule (fenêtre coordonnée, casse l'ancien flux anon)
> À faire **en même temps** que le déploiement du frontend authentifié.
> Prévenir les clients d'une courte coupure (quelques minutes).

1. **Frontend** : déployer la version qui
   - se connecte via **Supabase Auth** (`signInWithPassword`) au lieu du GET REST,
   - envoie `Authorization: Bearer <session.access_token>` (JWT user, plus l'anon),
   - envoie `client_control_id` + `establishment_id` à chaque contrôle,
   - rattache les photos via **RPC `haccp_lier_photo`** (plus de PATCH),
   - sert les images via **`createSignedUrl`** (60 s).
2. **SQL** : coller le bloc **ÉTAPE C** (RLS + policies + RPC).
3. **Storage** : confirmer le bucket en privé.
4. Tester : login, saisie d'un contrôle, photo, lecture rapport, depuis 2 comptes
   différents → chacun ne voit QUE ses données.
5. Une fois tous les comptes migrés vers Auth : `alter table etablissements drop
   column mot_de_passe;` (supprime les mots de passe en clair).

## Rollback d'urgence (étape C)
Exécuter le bloc **ROLLBACK** du SQL (désactive RLS, supprime la RPC) et
redéployer le frontend anon précédent. L'étape A/B reste en place sans risque.

---

## Correspondance points d'audit → étape
| Point | Étape |
|---|---|
| SEC-1 (cloisonnement) | C1 (RLS) |
| SEC-2 (mots de passe clair) | B (Auth) + C3 + drop column |
| SEC-3 (photos publiques) | B (bucket privé) + frontend signed URL |
| SEC-4 (append-only) | C2 (pas de policy update/delete) |
| M1 (horodatage serveur) | A3 (`recorded_at`) |
| M2 (scellement signature) | A4 (`seal` + trigger) |
| DATA-3/4 (photo par id) | A4 (`client_control_id`) + C4 (RPC) |
| CONC-2 (ajout photo atomique) | C4 (RPC `||` jsonb) |
| DATA-9 (doublons cloud) | A5 (index unique) |
