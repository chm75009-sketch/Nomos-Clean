# Suivi des corrections — HACCP17-FACILE

> Source : `DIAGNOSTIC_COMPLET.md` + `DIAGNOSTIC_SECURITE.md`.
> Légende : ✅ fait · 🟡 partiel/à confirmer · ❌ à faire.
> **Objectif : tout traiter.** Mise à jour à chaque commit. Dernière MAJ : 2026-06-07.

---

## 🔴 CRITIQUE

| Code | Point | Statut |
|---|---|---|
| SEC-1 (C1) | Cloisonnement serveur (clé anon partagée) | ✅ RLS active (chemin B : requêtes routées sur le JWT établissement, policy `code_client = establishment_id`) |
| SEC-2 (C2) | Mots de passe en clair, vérifiés client | ✅ comptes Auth (mdp haché) + JWT `establishment_id` |
| SEC-3 (C3) | Photos traçabilité en URL publiques | 🟡 ATTÉNUÉ : noms de fichiers aléatoires non-devinables (UUID) → pas d'énumération. Code de signature + filet prêts. Bucket REMIS public (la bascule privée cassait l'affichage faute de session Auth fiable — voir note Auth). Reprise du « tout privé » après fiabilisation de la session Auth. |
| SEC-4 (C4) | Contrôles signés modifiables/supprimables | ✅ RLS : pas de DELETE/UPDATE sur contrôles signés |
| DATA-1 | Purge quota efface contrôles non synchro | ✅ |
| DATA-2 | Alerte si IndexedDB indispo (photo perdue silencieuse) | ✅ |
| DATA-3 / CONC-1 | Photo rattachée par id explicite (pas heuristique) | 🟡 |
| DATA-4 | Photo orpheline après kill/délai > 2 h | 🟡 |
| DATA-5 | Login hors-ligne (session valide) | ✅ |
| DATA-6 | Flag `cloudOk` durable par contrôle | ✅ |
| CONC-2 | Ajout de photo atomique (multi-appareils) | ❌ |
| PDF-1 | Pagination/lazy des photos (crash iPhone) | ✅ |
| PDF-2 | Échappement HTML des champs libres | ✅ |
| SW-1 | PWA bloquée sur sous-chemin | ✅ |
| SW-2 | Dexie `@latest` à figer + cacher | ✅ |
| SW-3 | CDN critiques cachés (offline) | ✅ |
| BIZ-1 | Seuil cellule refroidissement cohérent | ✅ |
| BIZ-2 | Expiration abonnement UTC→Paris | ✅ |
| BIZ-3 | Contrôles vides validés conformes | ✅ |

## 🟠 MAJEUR

| Code | Point | Statut |
|---|---|---|
| CONC-3 | Backoff + jitter liaison photo | ✅ |
| CONC-4 | Réconciliation allégée (champs + fenêtre 7j) | ✅ |
| CONC-5 | Lignes `__diag__` hors prod | ✅ |
| CONC-6 | `local-test` hors prod / ETAB_ID non réassignable | ✅ |
| CONC-7 | UUID nom fichier photo (anti-écrasement) | ✅ |
| CONC-8 | Onglet leader + pause `document.hidden` | ✅ |
| DATA-7 | Cap 200/module évince contrôle non synchro | ✅ |
| DATA-8 | Faux doublon à la minute → perte | ✅ |
| DATA-9 | Doublons cloud (pas d'unicité serveur) | 🟡 uid client posé — index unique serveur dans backend/ |
| DATA-10 | `seen` pollué par entrées locales | ✅ |
| DATA-11 | `_pushedSigs` posé avant confirmation | ✅ |
| DATA-12 | `date_controle` = heure upload, pas saisie | ✅ |
| DATA-13 | Badge « N non synchronisés » persistant | ✅ |
| PDF-3 | `limit=1000` masque contrôles anciens | ✅ |
| PDF-4 | Bornes de dates UTC vs locale | ✅ |
| PDF-5 | Fusion local/cloud par « plus récent » | ✅ |
| PDF-6 | try/catch par module dans le Pack | ✅ |
| PDF-7 | Signataire absent des sections conformes | ✅ |
| SW-4 | `?v=` empreinte de build sur assets | ⏳ infra/CI (mitigé par APP_BUILD/SW-7) |
| SW-5 | `CACHE` SW généré en CI | ⏳ infra/CI |
| SW-6 | DataCloneError iOS (généraliser REST) | 🟡 inscription client (REST) — admin SDK conservé |
| SW-7 | Numéros de version désynchronisés | ✅ |
| SW-8 | Double init Supabase (2 clés) | ✅ |
| BIZ-4 | Garde température aberrante enceintes | ✅ |
| BIZ-5 | Synchro Équipe (demi-caractères) | ✅ |
| BIZ-6 | Synchro Équipe par horloge (→ created_at) | ✅ |
| BIZ-7 | ID dupliqué `tcat_seuil` | ✅ |
| BIZ-8 | Virgule décimale champs number | ✅ |
| CONC-9 / DATA-14 | Équipe & enceintes « dernier écrit gagne » | ➖ par choix (déterministe via created_at, BIZ-6) |

## 🟡 MINEUR

| Code | Point | Statut |
|---|---|---|
| MIN-1 | Helpers seuils dupliqués ×4 + code mort | ➖ par choix (cosmétique, risque>valeur) |
| MIN-2 | Borne haute `23:59:59` sans `.999` | ✅ |
| MIN-3 | Photos modules non mappés non injectées | ✅ |
| MIN-4 | Injection photos sur setTimeout fixes | ✅ |
| MIN-5 | `_secteurActifMatch` laisse passer legacy | ➖ par choix (préserve l'historique) |
| MIN-6 | Affichage `+-20°C` seuil négatif | ✅ |
| MIN-7 | Voix : négatif dicté sans « moins » | ✅ |
| MIN-8 | `hideNCAction` hors garde `if(ncEl)` | ✅ |
| MIN-9 | Pull enceintes sans re-sanitisation | ✅ |
| MIN-10 | Session essai 16j vs 3j réel | ✅ |
| MIN-11 | `ETAB_ID`/`MODE_LOCAL` déclarés en double | ✅ |
| MIN-12 | Table `enregistrements` écrite jamais relue | ✅ |
| MIN-13 | Pas de pull périodique PC→iPhone | ✅ |
| MIN-14 | `navigator.storage.persist()` jamais appelé | ✅ |
| MIN-15 | Boucle de reload si shell HTML cassé en 200 | ✅ |

## 📋 RGPD / charte (livrable à produire)

| Élément | Statut |
|---|---|
| Politique de confidentialité | ✅ (doc + page in-app) |
| Registre des traitements (complet) | ✅ doc |
| Durées de conservation + purge programmée | ✅ purge `pg_cron` active (`purge_controles_3ans`, mensuelle, 3 ans) |
| Procédure droit à l'oubli / résiliation | ✅ doc |
| Mentions légales / CGU | ✅ (doc + page in-app) |
| Confirmation région UE (Supabase) | ✅ West EU (Ireland) — confirmé 2026-06-07 |

## 🔐 Fondation Auth / cloisonnement (2026-06-07)

| Étape | Statut |
|---|---|
| Comptes Supabase Auth par établissement (mdp **haché**, `establishment_id` dans le JWT) | ✅ fonction `ensure_etab_auth_user` + trigger `etab_auth_sync` (présent + futur) |
| Réparation jetons GoTrue (NULL→'') | ✅ |
| Session Auth ouverte au login (toast « Session sécurisée active ») | ✅ vérifié vert |
| SEC-1 RLS cloisonnement (bascule des requêtes sur le JWT + policies) | ✅ chemin B en place : `_sbBearer()` route sur le JWT établissement, policy `auth.role()='anon' OR code_client = establishment_id` — chaque établissement ne voit que ses données |
| SEC-4 immutabilité contrôles signés (RLS UPDATE/DELETE ciblé) | ✅ pas de DELETE/UPDATE autorisé sur les contrôles |
| SEC-3 photos privées (bucket privé + URLs signées) | 🟡 ATTÉNUÉ : code de signature + filet `_installerFiletSignaturePhotos` en place, mais bucket REMIS public (la bascule privée cassait l'affichage tant que la session Auth n'est pas fiable). Protection effective via noms de fichiers UUID non-devinables. À rebasculer en privé une fois `_ouvrirSessionAuth` fiabilisée. |

## 🛡️ Protection anti-perte de données (2026-06-07)

| Correctif | Statut |
|---|---|
| Restaurer équipe/enceintes du cloud si la copie locale a été purgée (déconnexion) | ✅ |
| Interdire l'envoi cloud d'une équipe/enceintes VIDE (anti-écrasement « le plus récent gagne ») | ✅ |
| Retour arrière / multi-fenêtres / bfcache ne réaffichent plus de page connectée | ✅ |
| Bouton de mise à jour fiable (numéro de version tappable) | ✅ |

---

## Ordre d'exécution retenu
1. **Lot 0 — anti-perte (frontend)** : ✅ TERMINÉ (DATA-1,2,5,6,7,11)
2. **Lot 1 — intégrité preuves** : DATA-3/4, CONC-2, PDF-2(✅), BIZ logique(✅)
3. **Lot 2 — build & charge** : SW-2/3/4/5/7, CONC-4/5/6/8, DATA-7→13
4. **Lot 3 — backend + RGPD** : SEC-1→4, M1/M2, charte RGPD complète
5. **Lot 4 — mineurs** : MIN-1→15
