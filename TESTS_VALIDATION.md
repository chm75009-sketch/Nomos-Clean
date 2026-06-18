# Plan de validation — HACCP Pro (v56)

> À dérouler point par point. Coche ✅ / ❌ et note ce que tu observes.
> Astuce : en bas de la page **Mes enceintes**, vérifie « · maj v56 » pour
> confirmer que l'appareil a bien la dernière version.

---

## A. Anti-perte de données (Lot 0) — le plus important

| # | Test | Attendu |
|---|---|---|
| A1 | Crée un contrôle (ex. Températures), valide. | Toast OK + il apparaît dans l'historique. |
| A2 | Coupe le réseau (mode avion), crée un contrôle, valide. | Sauvé en local ; badge orange « ☁️ N à synchroniser » en bas à gauche. |
| A3 | Réactive le réseau, attends ~1 min (ou tape le badge). | Le badge se vide tout seul → contrôle dans le cloud. |
| A4 | Mode avion, ferme/rouvre l'app, reconnecte-toi. | Connexion hors-ligne OK (jusqu'à 7 jours), tes contrôles sont là. |
| A5 | Crée 2 contrôles **dans la même minute**, même opérateur. | Les DEUX sont conservés (plus de « doublon » qui en efface un). |

## B. Synchro multi-appareils (PC ↔ iPhone)

| # | Test | Attendu |
|---|---|---|
| B1 | Crée un contrôle sur PC. Sur iPhone, ouvre l'historique/tableau de bord. | Il apparaît sous ~90 s, ou en revenant l'app au premier plan, **sans recharger**. |
| B2 | Modifie tes enceintes sur un appareil. | L'autre les récupère (toast « enceintes récupérées »). |

## C. Rapports & Pack DDPP

| # | Test | Attendu |
|---|---|---|
| C1 | Génère un rapport sur une période large (ex. année). | Tous les contrôles présents (plus de troncature à 1000). |
| C2 | Choisis une période d'un seul jour incluant un contrôle de fin de journée (23h). | Le contrôle est bien inclus (bornes locales + .999). |
| C3 | Un contrôle non synchronisé mais **plus ancien** que d'autres. | Il apparaît quand même dans le rapport (fusion par signature). |
| C4 | Horodatage des contrôles dans l'historique. | Date/heure réelles de validation, cohérentes (ISO corrigé). |
| C5 | Photo « étiquette de traçabilité » sur un contrôle Traçabilité. | La photo est bien rattachée au bon contrôle. |

## D. RGPD

| # | Test | Attendu |
|---|---|---|
| D1 | Pied de page d'accueil → « Confidentialité ». | Ouvre la politique de confidentialité. |
| D2 | Pied de page → « Mentions légales ». | Ouvre les mentions (champs entreprise à compléter). |
| D3 | Documents dans le dossier `RGPD/`. | 5 fichiers présents et complets. |

## E. Robustesse / régressions

| # | Test | Attendu |
|---|---|---|
| E1 | Utilise le **mode test** (code TEST). | Ses contrôles ne polluent PAS le cloud (pas de badge « à synchroniser »). |
| E2 | Dictée vocale d'une température négative (« moins dix-huit »). | Affiche −18. |
| E3 | Saisie d'un seuil enceinte négatif. | Affichage correct (ex. −18 °C, pas « +-18 »). |
| E4 | Laisse l'app ouverte longtemps, plusieurs onglets. | Pas de rechargement en boucle ; synchro normale. |

---

## Volet backend (à valider après l'Étape A du runbook `backend/`)
- Cloisonnement par établissement (un client ne voit que ses données).
- Mots de passe hachés côté serveur.
- Photos en URL signées (non publiques).
- Contrôles signés non modifiables.
