# Hébergement unique + UNE seule application installable (iOS / Android)

Ce dépôt regroupe **deux outils** dans **une seule application** PWA, servie par
**un seul hébergement** (plus de double facture, et **une seule installation /
une seule icône** sur le téléphone) :

| Outil | Rôle | URL (dans l'app) |
|---|---|---|
| **HACCP Pro** | Gestion quotidienne du PMS (relevés, traçabilité, NC, Pack DDPP…) | `/` (racine) |
| **Module Audit (ExpertAudit — Clean Food)** | Audit hygiène multi-secteurs (grilles GBPH, score, rapport, documents, sanctions, tarifs) | `/audit/` |

Les deux outils gardent leur logique interne (et leur base Supabase respective),
mais forment **une seule PWA** : **un seul `manifest.webmanifest`** et **un seul
service worker** (`sw.js`) à la racine, avec un **scope unique `/`** qui englobe
`/audit/`. L'utilisateur installe **une seule fois** ; à l'intérieur, il passe
d'un outil à l'autre :

- Dans **HACCP Pro** : écran « Que voulez-vous faire ? » → section
  **« Audit & conformité »** → carte *« Je réalise un audit hygiène complet »*
  qui ouvre le module d'audit (`/audit/`).
- Dans le **module Audit** : lien **« ⟵ HACCP Pro »** en haut de la navigation.

## Arborescence

```
/            → PWA unique : index.html, script.js, style.css,
               sw.js (UNIQUE), manifest.webmanifest (UNIQUE), icônes, slides…
/audit/      → Module d'audit : index.html, audit.html, controles.html,
               documents.html, sanctions.html, tarifs.html, shared.js, icônes
               (pas de manifest ni de sw propres : géré par la racine)
```

Les pages du dossier `/audit/` pointent vers le **manifeste racine**
(`../manifest.webmanifest`) et enregistrent le **service worker racine**
(`../sw.js`). Résultat : **une seule application installable** ; aucune
invite « installer une 2ᵉ appli » n'apparaît dans le module d'audit.

---

## 1) Le plus simple et gratuit : installation PWA (« Ajouter à l'écran d'accueil »)

Aucun store, aucun frais. C'est **une seule PWA hors-ligne** (une icône) qui
contient les deux outils.

- **Android (Chrome)** : ouvrir l'URL racine → menu ⋮ → *Installer l'application* /
  *Ajouter à l'écran d'accueil*.
- **iPhone/iPad (Safari)** : ouvrir l'URL racine → bouton Partager → *Sur l'écran d'accueil*.

Une seule installation suffit : le module d'audit est accessible **dans** l'appli.

> Prérequis : le site doit être servi en **HTTPS** (GitHub Pages, Netlify,
> Cloudflare Pages… le font automatiquement).

---

## 2) Publier sur le Play Store (Android)

Méthode recommandée : **TWA (Trusted Web Activity)** via
[PWABuilder](https://www.pwabuilder.com) ou
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

1. Déployer le site en HTTPS (URL publique stable).
2. Sur **pwabuilder.com**, coller l'**URL racine** (`https://…/`) — une seule
   appli, le module d'audit est inclus → *Package for stores* → **Android**.
3. Télécharger le `.aab` généré + le fichier **`assetlinks.json`**.
4. Déposer `assetlinks.json` à la racine du site sous
   **`/.well-known/assetlinks.json`** (vérification Digital Asset Links — supprime
   la barre d'URL dans l'appli).
5. Publier le `.aab` sur la **Google Play Console** (compte développeur : 25 $ une fois).

Gabarit de `/.well-known/assetlinks.json` (remplacer le package et l'empreinte
SHA-256 fournis par PWABuilder) :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.cleanfood.haccppro",
    "sha256_cert_fingerprints": ["VOTRE_EMPREINTE_SHA256"]
  }
}]
```

---

## 3) Publier sur l'App Store (iOS)

1. Sur **pwabuilder.com**, choisir **iOS** → télécharger le projet Xcode généré
   (enveloppe `WKWebView` autour de la PWA).
2. Ouvrir le projet dans **Xcode** (Mac requis), renseigner Bundle ID, icônes,
   nom, écran de lancement.
3. Archiver et envoyer via **App Store Connect** (compte
   **Apple Developer**, 99 $/an).

> Alternative équivalente : empaqueter avec **Capacitor**
> (`@capacitor/core`) si vous voulez ajouter des fonctions natives plus tard.

---

## Migration depuis l'ancien hébergement de l'audit

L'application d'audit était hébergée séparément (dépôt `audit-haccp3bis`). Pour
**supprimer le second hébergement** :

1. Déployer ce dépôt (HACCP Pro + `/audit/`) sur l'hébergeur unique.
2. Mettre une **redirection** de l'ancienne URL d'audit vers `https://…/audit/`
   (ou désactiver l'ancien site une fois les utilisateurs prévenus).
3. Les anciennes PWA installées depuis l'ancien domaine continueront de pointer
   vers l'ancien domaine : prévenir les utilisateurs de réinstaller depuis la
   nouvelle URL.
