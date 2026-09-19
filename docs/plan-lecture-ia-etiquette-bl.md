# Plan — Lecture IA de l'étiquette / BL (DLC + n° de lot en automatique)

> Objectif : faire comme Traqfood / eEAT / Octopus — l'utilisateur prend une photo,
> l'IA lit et **remplit automatiquement la DLC et le n° de lot**, sans rien taper.
> Document de préparation. Créé le 2026-09-19.

## 1. Ce qui existe déjà dans Nomos (la moitié du travail)
- Capture + compression de la **photo de l'étiquette produit** (source `etiquette_reception` / `etiquette_tracabilite`).
- Champs déjà présents : **DLC/DDM**, **n° de lot**, type de produit, date de fabrication.
- Il ne manque QUE la couche « lire la photo et pré-remplir ».

## 2. Principe (identique aux concurrents)
**Photo de l'étiquette → bouton « Scanner » → l'IA extrait { DLC, lot } → les champs se
remplissent tout seuls → l'utilisateur vérifie et valide.**
On garde TOUJOURS une validation humaine (un contrôle HACCP doit rester fiable ; une
étiquette thermique pâle peut être mal lue). Mais 90 % de la saisie disparaît.

## 3. Architecture technique
1. **Front (script.js)** : bouton « 🔍 Scanner l'étiquette » à côté de la photo.
   Il envoie l'image (déjà compressée) à une fonction serveur.
2. **Edge Function Supabase `lire_etiquette`** (garde la clé API secrète, côté serveur) :
   - reçoit l'image,
   - appelle le modèle de vision IA avec une consigne stricte (« renvoie UNIQUEMENT un JSON
     {\"dlc\":\"AAAA-MM-JJ\"|null, \"lot\":\"...\"|null, \"ddm\":\"...\"|null} »),
   - renvoie le JSON au front.
3. **Front** : pré-remplit les champs DLC + lot, surligne « à vérifier », l'utilisateur valide.

## 4. Choix du modèle IA
- **Reco pour démarrer : un modèle de vision généraliste économique** (ex. GPT-4o-mini,
  Claude Haiku…) → très bon pour extraire une **date** + un **n° de lot**, ~fraction de
  centime par image, intégration simple (une requête HTTP depuis l'Edge Function).
- **Alternative « spécialisé documents »** : Google Document AI ou Mindee (parseurs de
  documents) — plus robustes sur des BL complexes, mais plus lourds à intégrer et souvent
  plus chers. À réserver si le vision LLM ne suffit pas.

## 5. Coût
- Ordre de grandeur : **~0,1 à 0,5 centime par scan** avec un vision LLM économique.
- 1000 scans/mois ≈ **quelques euros/mois**. Négligeable, et argument commercial fort.

## 6. RGPD (à respecter)
- La photo part chez un **prestataire IA** → choisir un fournisseur avec **accord de
  traitement (DPA)** et **hébergement UE si possible**.
- **Traitement à la volée** : ne PAS laisser le prestataire stocker/entraîner sur les images
  (désactiver la rétention / l'entraînement dans les réglages API).
- **Minimisation** : n'envoyer QUE l'étiquette (pas de données inutiles).
- Ajouter une ligne dans la **politique de confidentialité** + le **registre des traitements**
  (« lecture automatisée d'étiquettes via prestataire IA »).

## 7. Prérequis à réunir (côté Léa) avant l'implémentation
1. **Un compte + une clé API** chez le fournisseur IA choisi (à mettre dans les secrets
   Supabase / Vault, jamais dans le code client).
2. **Accès Supabase** pour déployer l'**Edge Function** (déjà utilisé pour la purge photos).
3. Décider du **fournisseur IA** (vision LLM éco recommandé) et valider le **budget** (~qq €/mois).
4. Accepter/configurer le **DPA** et la **non-rétention** des images côté prestataire.

## 8. Étapes d'implémentation (prochaine session)
1. Créer l'Edge Function `lire_etiquette` (clé API en secret) + consigne d'extraction stricte.
2. Ajouter le bouton « Scanner l'étiquette » côté front + le pré-remplissage des champs
   DLC / lot, avec surlignage « à vérifier ».
3. Gérer les cas : illisible → message clair « saisie manuelle », date ambiguë → proposer.
4. Tester sur de vraies étiquettes (thermique pâle, manuscrit, différents fournisseurs).
5. Ajouter la trace RGPD (politique de confidentialité + registre).
6. Déploiement progressif (d'abord un compte test, ex. BLU BLU / RTH75).

## 9. Points à confirmer avec Léa
- [ ] On lit surtout **l'étiquette produit** (DLC + lot) — confirmez-vous ? (le BL complet
      fournisseur/produits est un cran au-dessus, faisable ensuite)
- [ ] Fournisseur IA : vision LLM économique OK, ou préférence pour un service « documents » ?
- [ ] Budget mensuel acceptable (~quelques €/mois) ?
- [ ] Faut-il aussi lire la **DDM** et la **quantité**, ou seulement **DLC + lot** pour commencer ?

---
*Rappel : la partie « photo » existe déjà — ce chantier n'ajoute que la « lecture ».*
