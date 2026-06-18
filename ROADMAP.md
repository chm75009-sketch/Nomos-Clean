# HACCP Pro — À faire (notes)

## ⚠️ PRIORITÉ avant commercialisation — Sécurité RLS (À FAIRE)
Activer le **RLS (Row Level Security)** sur Supabase pour que le cloisonnement par
établissement soit **imposé par la base** (et pas seulement par l'app). Point soulevé
par l'audit (« audit final des règles RLS »).

**Déjà fait (fondations, non-cassant) :**
- ✅ Étape A : `establishment_id`, `recorded_at` (horodatage serveur), `seal` (scellement SHA-256).
- ✅ Fonction `current_establishment_id()` + table `memberships`.
- ✅ Trigger `haccp_seal()` corrigé (`search_path = public, extensions` pour `digest()`).
- ✅ Auto-remplissage de `establishment_id` à l'insert.
- ✅ Testé : connexion d'un compte (`ESSAI-SKAFN-2026`) en **session sécurisée** → le JWT
  porte bien l'`establishment_id` (« Session sécurisée active »).

**Reste à faire (le RLS n'est PAS encore activé) :**
1. Provisionner un **compte Auth** (avec `establishment_id`) pour **chaque** établissement
   (l'app ne les crée pas encore automatiquement → à ajouter dans la création de client admin).
2. Adapter **la connexion** et **le panneau Admin** pour qu'ils ne dépendent plus de lectures
   en clé anon (sinon le RLS les casse) — ou router via RPC `security definer`.
3. Vérifier que l'**auto-capture capteurs** pose bien l'`establishment_id` (semble OK).
4. **Activer le RLS** (étape C de `backend/migration_securite.sql`) — CASSANT tant que 1-2
   pas faits → à faire en fenêtre de bascule, avec rollback prêt.
5. Tester : un compte ne voit QUE ses données ; un 2e compte ne voit pas celles du 1er.

> Contexte : aucun client payant aujourd'hui → c'est le bon moment pour le faire proprement.

## En cours
- **Simplification de la navigation** (sans rien casser) :
  1. Bouton « ← Retour » toujours visible (ne plus avoir à remonter). ← *en cours*
  2. Bouton « ↑ Haut » flottant sur les longues pages.
  3. Vérifier/renforcer le bouton « précédent » du téléphone (popstate).

## Tableau de bord « Ce qu'il y a à faire »
- ✅ **V1 — Quotidien (fait)** : panneau « 📋 À faire aujourd'hui » sur l'accueil, sous le
  baromètre. Liste les contrôles quotidiens DDPP du secteur, ✅ fait / ⬜ à faire détecté
  automatiquement via `haccp_historique` (hors-ligne). Les contrôles à faire restent en
  évidence (rouge) tant qu'ils ne sont pas réalisés. Clic → ouvre le module.
- ⏳ **V2 — à venir** : tâches **périodiques** (hebdo/mensuel/trimestriel) avec **dates
  d'échéance**, **cases à cocher manuelles** (pour les tâches sans contrôle dédié, ex.
  vérif contrat dératisation), et **alerte persistante** tant que non cochée.
  ⚠️ Vérifier les fréquences réglementaires par secteur AVANT de les coder (cf. ci-dessous).

### Détails V2 — Tableau de bord « Ce qu'il y a à faire »
À l'ouverture de l'app, afficher un **tableau de bord** qui dit ce qu'il faut faire,
basé sur le **PMS**, la **réglementation** et l'**HACCP** :
- Tâches **quotidiennes** et **périodiques** (hebdo / mensuel / trimestriel…), avec **dates**.
- **Planning** clair par secteur (ex. boulangerie : tester le **refroidissement de 2–3 articles
  une fois par trimestre** — *À VÉRIFIER dans la réglementation avant de coder*).
- **Alerte** affichée tant que la tâche n'est pas faite : **case à cocher « fait »** ;
  si non cochée, l'alerte **reste affichée** (rappel persistant).

> Vérifier les obligations exactes par secteur (resto trad, rapide, boulangerie/pâtisserie…)
> avant d'inscrire des fréquences en dur. Sourcer (PMS / guides de bonnes pratiques / arrêtés).
