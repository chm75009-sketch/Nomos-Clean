# 🔐 À FAIRE DEMAIN — Sécurité (note pour Léa & Claude)

_Date de la note : 24/06/2026. Session précédente : audit + corrections sécurité._

## ✅ DÉJÀ FAIT (ne pas refaire)
1. Mot de passe admin `826700` neutralisé (secret Vault `admin_password`) — **2 projets**.
2. Table `etablissements` : UPDATE limité à sa propre fiche, DELETE fermé à la clé publique.
3. Table `comptes_clients` : écritures admin passées par fonctions sécurisées
   (`admin_set_compte_actif`, `admin_creer_compte`, `admin_delete_comptes`) + policies
   d'écriture anon supprimées. **Testé OK (création + suppression).**
4. Isolation lecture confirmée (`controles_haccp` filtré par établissement).
5. RLS activé partout (2 projets). App Audit confirmée saine.
6. XSS : 3 champs libres restants échappés (NC : action, responsable, valeur).
7. Comptes de test en dur retirés (DEMO/TESTBP/TESTRAPIDE).
8. Bouton « Retour » ne couvre plus le logo + appui long sur le logo (Mode Test).
9. Tout publié en ligne (Nomos v354 / HACCP17 v343).

## 🟡 À FAIRE DEMAIN — durcissements optionnels (aucune urgence)

### 1. Empêcher la création de comptes GRATUITS par un malin
- **Problème** : `etablissements` accepte encore l'INSERT par la clé publique
  (nécessaire aujourd'hui pour l'inscription d'essai + la création admin).
  Un utilisateur technique pourrait s'auto-créer un compte gratuit (expiration 2099).
- **Fix** : créer une RPC `creer_essai(...)` SECURITY DEFINER qui fixe la date
  d'expiration côté serveur (aujourd'hui + 7 j), router l'inscription (script.js ~ligne 1932)
  et la création admin (~21661) vers des RPC, PUIS fermer l'INSERT anon sur `etablissements`.
- **Risque** : touche le parcours d'inscription client → tester soigneusement avant.

### 2. Héberger les 6 librairies externes dans le dépôt (anti-piratage CDN)
- Supabase, Chart.js, ExcelJS, EmailJS, Dexie, html-docx chargées depuis cdn.jsdelivr/unpkg.
- **Fix** : télécharger les versions exactes, les mettre dans le dépôt, remplacer les
  `<script src=CDN>` par des chemins locaux, et les ajouter au cache du service worker (CORE).
- **Risque** : moyen, mais testable hors-ligne (suite de tests).

### 3. Immutabilité des contrôles validés (argument « preuve légale »)
- `controles_haccp` autorise l'UPDATE de SES propres lignes (légitime : rattacher les photos),
  donc un client pourrait théoriquement modifier un contrôle passé.
- **Fix** : trigger qui interdit de modifier `contenu`/`signature`/`date` d'une ligne validée
  (autoriser seulement l'ajout de photos), DELETE déjà interdit.
- **Risque** : moyen — bien cadrer le trigger pour ne pas bloquer le rattachement de photos.

### 4. Verrouiller EmailJS (anti-abus)
- Les identifiants EmailJS (service/template/clé publique) sont dans le code des 2 apps
  (`HACCP_CONFIG`). La clé publique EmailJS est faite pour être publique, MAIS sans
  restriction quelqu'un peut envoyer des e-mails via ton compte (spam, épuisement quota).
- **Fix (réglage tableau de bord EmailJS, pas de code)** : limiter les domaines autorisés
  à ton seul site + activer le reCAPTCHA / anti-bot dans EmailJS.

### 5. (Mineurs) historique_admin INSERT ouvert anon (spam log, illisible) ; mot de passe
   d'essai en clair dans le localStorage ; pas de throttling sur le mot de passe admin ;
   codes locaux RTH75/RTH3 contiennent encore `826700` en clair (comptes bac-à-sable
   locaux uniquement — n'ouvre PLUS l'admin, mais à changer/retirer pour faire propre).

## 🧹 Petit nettoyage
- Un établissement bidon « Test » a pu rester du 1er essai raté (connexion créée, pas de fiche).
  Le purger si besoin (il n'apparaît peut-être pas dans la liste Clients).

## Fichiers SQL de référence
- `backend/admin_ecritures_comptes.sql` (fonctions comptes_clients + bloc de fermeture).
- `backend/admin_ecritures_etab.sql`, `backend/admin_set_etat_etab.sql`, `backend/supervision_capteurs.sql` (admin_check).
