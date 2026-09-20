# Guide clé en main — Cloudflare (gratuit) pour les en-têtes de sécurité manquants

> Objectif : ajouter les en-têtes HTTP de sécurité que **GitHub Pages ne sait pas
> envoyer** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
> `Permissions-Policy`). On place **Cloudflare gratuit** devant le site. Aucun
> changement de code. Le domaine reste chez OVH (on ne fait que déléguer les DNS).
> Durée : ~20 min + propagation DNS (jusqu'à quelques heures).

## Où on en est
- Domaine : **nomos-haccp.fr** (registrar **OVH**).
- Site : **GitHub Pages** (via l'enregistrement CNAME + fichier `CNAME`).
- En-têtes actuels : seulement **HSTS**. Les 4 ci-dessus manquent.

## Étape 1 — Créer le compte Cloudflare et ajouter le site
1. Aller sur **dash.cloudflare.com** → créer un compte gratuit.
2. **Add a site** → saisir **nomos-haccp.fr** → plan **Free**.
3. Cloudflare **scanne les DNS existants** : vérifier qu'il récupère bien
   l'enregistrement du site (le CNAME/A vers GitHub Pages, l'e-mail OVH, etc.).
   ⚠️ **Important** : vérifier que les entrées **e-mail OVH** (MX, SPF, l'entrée
   `mx.ovh.com`, éventuel autodiscover) sont bien présentes — sinon les e-mails
   `@nomos-haccp.fr` cesseraient de fonctionner. Les ajouter si manquantes.

## Étape 2 — Déléguer les DNS à Cloudflare (côté OVH)
Cloudflare affiche **2 serveurs de noms** (ex. `xxx.ns.cloudflare.com`).
1. Aller dans **OVH → Domaines → nomos-haccp.fr → Serveurs DNS**.
2. Remplacer les serveurs DNS OVH par les **2 de Cloudflare**.
3. Valider. La propagation prend de quelques minutes à quelques heures.
4. Quand Cloudflare affiche **« Active »**, le site passe par Cloudflare.

> Les enregistrements du site doivent être **proxifiés** (nuage **orange**) pour
> que Cloudflare puisse ajouter les en-têtes. Les entrées **e-mail (MX)** restent
> en **DNS only** (nuage gris) — on ne proxifie jamais le mail.

## Étape 3 — Vérifier HTTPS
Cloudflare → **SSL/TLS** → mode **Full** (ou **Full (strict)**). GitHub Pages sert
déjà du HTTPS valide, donc « Full » convient.

## Étape 4 — Ajouter les en-têtes de sécurité (Transform Rules)
Cloudflare → **Rules → Transform Rules → Modify Response Header** → **Create rule**.
Nom : `En-têtes sécurité`. Condition : **All incoming requests**.
Puis **Set static** pour chacun :

| Header name | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(self)` |

⚠️ **`camera=(self)` est important** : l'application utilise la caméra pour le
**scan des codes produits**. Ne pas mettre `camera=()` sinon le scanner ne marchera
plus. `geolocation` et `microphone` sont désactivés (l'app n'en a pas besoin).

Enregistrer (**Deploy**).

## Étape 5 — Vérifier
Après déploiement, tester (remplacer par un vrai test en ligne ou l'inspecteur du
navigateur → onglet Réseau → en-têtes de réponse). On doit voir les 4 en-têtes
ci-dessus **en plus** de `strict-transport-security`.

## Points d'attention
- **Ne pas casser l'e-mail** : bien reporter MX + SPF (`mx.ovh.com`) chez Cloudflare
  (étape 1). C'est le seul vrai risque de cette manip.
- **HSTS** : déjà servi par GitHub Pages ; Cloudflare peut aussi le gérer (SSL/TLS →
  Edge Certificates → HSTS), inutile de le doubler.
- **CSP** : déjà présente en `<meta>` dans les pages. On pourra plus tard la
  renforcer (retrait de `unsafe-inline`) — chantier séparé.
- Tout est **gratuit** (plan Free Cloudflare).

---
*Rien à coder : cette mise en place est 100 % côté Cloudflare/OVH. Me prévenir quand
le domaine est « Active » sur Cloudflare, je vérifie les en-têtes avec vous.*
