# Prép. clé en main — Photos privées (bucket privé + URLs signées)

> But : rendre le bucket `haccp-photos` **privé** (aujourd'hui public) pour que les
> photos de traçabilité (BL, étiquettes, nuisibles…) ne soient plus accessibles via
> une simple URL publique, **tout en gardant l'app fonctionnelle** pour des clients
> **anonymes** (auth « maison », pas Supabase Auth).
>
> ⚠️ C'est le chantier le **plus lourd** des trois : il touche l'upload, l'affichage
> et le stockage des URLs. À valider avant de coder. Ce document décrit l'architecture
> recommandée et les étapes ; il ne contient pas encore le code final.

## Rappel du problème (déjà rencontré)
On avait tenté de passer le bucket en privé → les photos ont **disparu côté client**,
car les clients sont **anonymes** : un objet privé exige une URL **signée** ou une
authentification. On avait donc **remis le bucket en public**.

## Fait clé qui rend la solution possible
Les fichiers sont nommés avec le **code client en préfixe** :
`<clientId>_<source>_<...>.jpg` (voir `construireNomFichierPhoto`). On peut donc
**autoriser un client à ne voir que ses fichiers** (ceux qui commencent par son code).

## Architecture recommandée
1. **Bucket privé** `haccp-photos`.
2. **Upload** : garder l'upload direct anonyme, mais en **écriture seule**
   (policy storage : INSERT autorisé, SELECT interdit pour anon). Le client peut
   déposer, mais pas lister/lire librement.
3. **Affichage** : au lieu d'une URL publique, l'app demande une **URL signée** à une
   **Edge Function `photo-url`** qui :
   - reçoit `{ code_client, jeton, chemin }` (le jeton = preuve d'identité de l'app),
   - **vérifie** que `chemin` commence bien par `<code_client>_` (isolation),
   - vérifie le `code_client`/jeton via une RPC (comme le login),
   - avec la **service_role**, génère une **URL signée courte** (`createSignedUrl`,
     ~1 h) et la renvoie.
   → Un client ne peut obtenir de lien que pour **ses propres** photos.
4. **Stockage des références** : arrêter de stocker l'URL **publique** dans les
   données ; stocker seulement le **chemin** (`nom` du fichier). L'URL signée est
   recalculée à l'affichage. (Le code a déjà un embryon `createSignedUrl` aux
   lignes ~15713 / ~15738 à généraliser.)

## Étapes
1. **Décision** : valider cette architecture (URLs signées via Edge Function).
2. **Policies storage** (SQL) :
   - INSERT sur `haccp-photos` pour `anon` (write-only) ;
   - **aucune** policy SELECT pour `anon`/`public` ;
   - lecture uniquement via service_role (Edge Function).
3. **Edge Function `photo-url`** : vérif identité + vérif préfixe + `createSignedUrl`.
4. **App** :
   - upload : inchangé (mais on ne renvoie plus d'URL publique, juste le `nom`) ;
   - affichage : remplacer les `.../object/public/...` par un appel à `photo-url`
     qui renvoie l'URL signée ; mettre en cache l'URL signée le temps de sa validité.
5. **Migration douce** : gérer les anciennes photos déjà référencées par URL publique
   (soit les re-signer à la volée si le chemin est déductible, soit garder l'ancien
   affichage pour l'historique le temps de la bascule).
6. **Bascule bucket → privé** en dernier, après que l'affichage signé fonctionne.
7. **Tester** : client A ne voit que ses photos ; une URL publique d'ancien type ne
   fonctionne plus ; l'admin (compte Auth) voit tout.

## Effort estimé
Moyen à élevé (upload + affichage + migration des références + tests multi-comptes).
À planifier comme un chantier dédié, après les deux autres.

## Bénéfice
Les photos (BL, étiquettes, éventuels visages/nuisibles) ne sont plus exposées
publiquement → **meilleure conformité RGPD** et confidentialité client renforcée.
