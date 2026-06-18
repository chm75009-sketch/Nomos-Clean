# Rapport d'audit qualité — HACCP Pro (2026-06-14)

Audit scientifique de l'application : **5 agents en parallèle**, tous secteurs
(resto, boulangerie, rapide, boucherie, collective), tous modules, scénarios
déterministes (conforme / non conforme / valeurs limites / champs vides /
entrées hostiles / concurrence multi-clients). Vérification des 4 sorties :
PDF par contrôle, Mes Rapports, Pack DDPP, tableau Excel.

**Base de tests : 1148 + 12 (round 28) = 1160 tests, 0 échec.**

## ✅ Corrigé (v227) — sûr, validé sans régression

| # | Sévérité | Correctif |
|---|----------|-----------|
| 1 | 🔴 Bloquant | `fmtTemp()` : la virgule décimale FR « 3,5 » n'est plus tronquée en « 3 » dans les PDF (Réception / Refroidissement). |
| 2 | 🟠 Majeur | Huiles `estNC()` : « 175,5 » / « 25,1 » correctement interprétés → une huile hors seuil n'est plus marquée « conforme ». |
| 3 | 🔴 Bloquant | Déduplication cloud (cache rapports) : clé enrichie **uid + canal** → plus de perte silencieuse (2 contrôles même module/minute/opérateur ; 2 enceintes au même créneau). |
| 4 | 🟠 Majeur | Export Excel : limite 20 000 → 100 000 + **avertissement de troncature** (plus de données manquantes silencieuses). |
| 5 | 🟡 Sécurité | Anti‑XSS : échappement des données utilisateur (nom établissement, signataire, libellés/valeurs de champs, observations, actions, popup secteur). |
| 6 | ⚪ Cosmétique | « Operateur » → « Opérateur ». |

## 🟡 Consigné, NON corrigé (risque de casser / décision produit)

| Sujet | Pourquoi non corrigé maintenant |
|-------|----------------------------------|
| Fuseau horaire codé en dur `Europe/Paris` (backend) | Sans impact pour un client français. Pour l'international : nécessite une migration de schéma + déploiement coordonné (risque de casser les clients FR). |
| Dates Excel selon le fuseau du navigateur | Idem : correct sur un appareil réglé sur Paris ; correctif fragile, à faire avec le n° précédent. |
| Contrôles « legacy » sans secteur visibles dans tous les secteurs | Choix volontaire (ne pas masquer d'anciennes preuves) ; changer = risque de cacher des données réelles. |
| Mot de passe admin en clair (démo) | Le retirer casserait l'accès admin ; à traiter avec une vraie authentification. |
| Section « produits orphelins » Réception (libellé) | Les produits s'affichent déjà (aucune perte) ; ajout d'un libellé = confort, module en production. |
| Détection visibilité `pt_action` (fermeture) | Le correctif proposé (offsetParent) risque des faux positifs. |
| Doublons des fonctions `_seuil*` dans `lancerPackDDPP` | Sans impact fonctionnel (JS garde la dernière définition) ; nettoyage cosmétique. |

## Conclusion
Cœur applicatif **sain et cohérent** sur les 5 secteurs. Les correctifs livrés
renforcent l'intégrité des données (décimales, anti‑perte) et la sécurité
(anti‑XSS), sans aucune régression. Les points consignés sont soit sans impact
pour un usage français, soit des décisions produit à trancher.
