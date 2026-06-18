# Robots de test — HACCP Pro

Tests automatiques qui rejouent l'application comme de vrais clients, pour
vérifier qu'aucune modification ne casse quoi que ce soit.

## Lancer tous les tests
```
cd tests
node run_tests.js    # Gestion clients (admin) : créer/modifier/supprimer/sélection
node run_tests2.js   # Secteurs, températures, photos, dictée vocale
node run_tests3.js   # Catalogues, fmtTemp, actions correctives, impressions
node run_tests4.js   # DLC étiquettes, huiles, refroidissement, cloisonnement
node run_tests5.js   # Hors-ligne / anti-perte : éviction, réconciliation cloud
node run_tests6.js   # Signatures obligatoires + propagation payload cloud
node run_tests7.js   # Pack DDPP / rapports par période (sélection des contrôles)
node run_tests8.js   # Traçabilité (lots/fournisseurs) + gestion d'équipe (anti-écrasement)
node run_tests9.js   # Connexion (local + hors-ligne 7j) + quota stockage (preuves protégées)
node run_tests10.js  # Réception véhicule (compartiments) + reprise de session
node run_tests11.js  # Seuils enceintes (libellés) + contenu du PDF légal
node run_tests12.js  # Registre NC (catalogue) + codes d'essai gratuits (règles)
node run_tests13.js  # Réception produit + 14 allergènes + plat témoin (J+5)
node run_tests14.js  # Liaison thermique + audit des seuils réglementaires
node run_tests15.js  # Config enceintes (anti-écrasement) + validation inscription
node run_tests16.js  # Virgule décimale FR (3,5) + catalogues déchets (Loi AGEC)
node run_tests17.js  # Catalogue des modules + contenu du PDF de réception
node run_tests18.js  # PDF légaux huiles de friture + refroidissement rapide
node run_tests19.js  # Robustesse / fuzzing : entrées hostiles sur les contrôles
node run_tests20.js  # Audit de sécurité (clé anon, RPC login, zéro fuite mdp)
node run_tests21.js  # Affichage réglementaire + liste des modules NC
node run_tests22.js  # RGPD + mentions légales (accessibilité + contenu)
node run_tests23.js  # Admin — dernière connexion (jours calendaires)
node run_tests24.js  # Panneau admin — création essai/client (secteurs, multi, durées)
node run_tests25.js  # Panneau admin complet (connexion, onglets, demandes, refus, historique)
node run_tests26.js  # Admin — validation demande (5 secteurs) + campagne essais (plafond)
node run_tests27.js  # PMS par secteur (contenu réglementaire) + générateur de PMS pré-rempli
```
Chaque fichier affiche « X passed, Y failed ». Tout doit être à 0 failed.

## Fichiers
- `harness.js`   : faux Supabase + faux DOM pour la gestion clients (admin)
- `load_app.js`  : charge tout script.js dans un navigateur simulé
- `run_tests*.js`: les scénarios

Couverture actuelle : 1113 scénarios, 0 échec.
