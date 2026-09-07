# Plan — Envoi automatique hebdomadaire du Pack DDPP aux clients

> Document de préparation (à implémenter lors d'une prochaine session).
> Créé le 2026-09-07.

## 1. Le besoin
Envoyer **une fois par semaine, automatiquement**, à chaque client actif, son
suivi DDPP par e-mail (Pack Contrôle DDPP ou équivalent), sans intervention.

## 2. Contrainte technique MAJEURE (constat du code actuel)
- Le **Pack DDPP est généré DANS LE NAVIGATEUR** : un overlay HTML imprimé via
  `window.print()` (voir `lancerPackDDPPAvecPhotos`, `genererPackDDPP` dans
  `script.js`). **Ce n'est PAS un fichier PDF** téléchargeable ni un blob
  → impossible à **joindre** à un e-mail, ni à **générer côté serveur** tel quel.
- L'envoi d'e-mail actuel utilise **EmailJS**, qui part **du navigateur** et ne
  gère pas de pièce jointe PDF lourde.
- Un envoi **automatique** (sans que personne n'ouvre l'app) doit tourner
  **côté serveur** — le navigateur d'un client n'est pas ouvert au bon moment.

➡️ **Conclusion** : envoyer automatiquement le PDF stylé « tel quel » n'est pas
faisable sans travail. Il faut choisir une approche ci-dessous.

## 3. Options

### Option A — Récapitulatif hebdo par e-mail (RECOMMANDÉ pour démarrer)
- Une **Edge Function Supabase** planifiée par **pg_cron** (ex. lundi 7h).
- Elle parcourt les **clients actifs** (`comptes_clients` / `etablissements`),
  lit leurs contrôles de la semaine (`controles_haccp`, clé `code_client` =
  ID interne établissement), et envoie à chacun un **e-mail récapitulatif**
  (HTML dans le corps + éventuellement un **CSV** en pièce jointe) : nombre de
  contrôles, non-conformités, températures hors seuil, réceptions, etc.
- Envoi via un **service e-mail appelable côté serveur** (Resend / SendGrid /
  SMTP). ⚠️ **EmailJS ne convient PAS côté serveur.**
- ✅ 100 % automatique, léger, fiable, pas de génération PDF navigateur.
- ⚠️ Ce n'est pas le PDF Pack DDPP exact, mais un récap (suffisant pour un suivi
  hebdo ; le PDF complet reste disponible à la demande dans l'app).

### Option B — Génération serveur du vrai Pack DDPP PDF
- Réimplémenter la mise en page Pack DDPP dans l'Edge Function (Deno) avec une
  lib PDF serveur (pdf-lib) ou un service HTML→PDF ; joindre le PDF chaque semaine.
- ✅ Le vrai document.
- ❌ Coût **élevé** : dupliquer + maintenir la mise en page à 2 endroits, gérer
  les photos, HTML→PDF serveur (souvent un service tiers payant).

### Option C — Semi-automatique (bouton admin « Envoyer le Pack de la semaine »)
- Même blocage : le PDF est navigateur, EmailJS sans pièce jointe lourde.
- Réaliste uniquement pour un **récap** (données) → revient à l'Option A mais
  déclenchée à la main.

## 4. Recommandation
**Commencer par l'Option A** (récap hebdo automatique, Edge Function + pg_cron +
service e-mail serveur). Fiable, léger, couvre le besoin « suivi hebdo ». Le PDF
Pack DDPP complet reste disponible à la demande dans l'app et via le bouton admin.

## 5. Prérequis à réunir AVANT l'implémentation (côté Léa)
1. **Accès Supabase** : créer une **Edge Function** + activer **pg_cron** /
   **pg_net** (déjà utilisés pour la purge photos 18 mois → normalement OK).
2. **Un service e-mail serveur** : **Resend** (simple, gratuit pour démarrer)
   recommandé, sinon SendGrid / SMTP. Créer le compte + **clé API**.
   (EmailJS ne marche pas côté serveur.)
3. **Adresse expéditeur validée** sur ce service (ex. `contact@nomos-haccp.fr`).
4. **Contenu du récap** à décider : contrôles de la semaine, NC, T° hors seuil…
5. **Jour/heure d'envoi** (ex. lundi 7h) et **cible** : tous les clients actifs,
   ou seulement les payants ?
6. **Désabonnement (RGPD)** : prévoir un flag `email_hebdo_off` par compte +
   une case dans l'admin « Modifier » et/ou côté client.

## 6. Étapes d'implémentation (prochaine session)
1. Ajouter la clé API du service e-mail (Resend) dans les **secrets Supabase**
   (Vault), comme `admin_password` / `service_role_key`.
2. Écrire l'Edge Function `envoi_recap_hebdo` : requête des contrôles de la
   semaine par client → corps HTML + CSV → envoi via Resend.
3. Planifier via **pg_cron** (ex. `0 7 * * 1` = lundi 7h UTC ; ajuster fuseau).
4. Ajouter le réglage `email_hebdo_off` (colonne + case admin « Modifier »).
5. **Tester sur BLU BLU d'abord** (envoi manuel déclenché), puis activer le cron.
6. Tracer chaque envoi dans `historique_admin`.

## 7. Points à confirmer avec Léa
- [ ] Récap (Option A) suffit-il, ou faut-il vraiment le **PDF complet** (Option B) ?
- [ ] Service e-mail : **Resend** OK ?
- [ ] Cible : **tous les clients** ou seulement les **payants** ?
- [ ] **Jour/heure** d'envoi ?
- [ ] Faut-il une **pièce jointe CSV** en plus du corps HTML ?

---
*Rappel contexte : compte à garder = BLU BLU (`ESSAI-SVSQN-2026`) et Sas Pains
Factory Colmar (`ESSAI-AM39A-2026`, client potentiel) ; RTH75 = démo en dur.*
