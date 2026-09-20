# Prép. clé en main — Retrait complet d'EmailJS (→ 100 % OVH / UE)

> But : supprimer toute dépendance à EmailJS (États-Unis) une fois qu'OVH est
> confirmé stable en production. Tant que ce n'est pas fait, EmailJS reste branché
> **en secours** (aucun e-mail perdu). Ne pas exécuter la phase 3 avant quelques
> jours de recul OVH.

## Inventaire complet des usages EmailJS (au 20/09/2026)

| Fichier | Emplacement | Rôle | État |
|---|---|---|---|
| `script.js` | config `EMAILJS_*` (~l.830) + `emailjs.init` (~l.888) | init | à retirer en phase 3 |
| `script.js` | repli dans `sendMailNomos` | secours des 6 envois | à retirer en phase 3 |
| `haccp.html` | `<script ... email.min.js>` (l.184) | chargement lib | à retirer en phase 3 |
| `haccp.html` | **devis capteurs** `emailjs.send` (l.~4150) | → r.t.h@orange.fr | **à migrer (phase 2)** |
| `accueil.html` | `<script>` + `init` (l.55-56) | init (compte séparé) | à retirer en phase 3 |
| `accueil.html` | formulaire démo | → lea@ | ✅ **déjà OVH-first** (repli EmailJS) |
| tous les `.html` | `connect-src ... https://api.emailjs.com` (CSP) | autorisation réseau | à retirer en phase 3 |

Les 6 envois de `script.js` passent déjà par `sendMailNomos` (OVH + repli). ✅

## Phase 1 — Déjà fait
- 6 envois `script.js` → OVH. ✅
- Formulaire de démo `accueil.html` → OVH (repli EmailJS conservé). ✅

## Phase 2 — Migrer le dernier envoi « métier » (devis capteurs)
Le devis capteurs part vers **r.t.h@orange.fr** (≠ lea@). Pour router correctement
sans ouvrir la fonction aux abus, déployer la **v2** de la fonction (liste blanche
interne) : `supabase/functions/envoyer-email/index.v2.ts`.

1. Déployer la v2 (onglet Code → coller `index.v2.ts` → Deploy). Aucun secret requis
   (option : secret `ADMIN_WHITELIST` = `lea@nomos-haccp.fr,r.t.h@orange.fr,mounir@nomos-haccp.fr`).
2. Dans `haccp.html`, remplacer le bloc `emailjs.send(...)` du devis (l.~4150) par :
   ```js
   if(typeof sendMailNomos==='function'){
     sendMailNomos('admin',{
       admin_to:'r.t.h@orange.fr',
       etablissement:soc, secteur:'📩 DEVIS Capteurs / Relevés automatiques',
       responsable:nom, email_client:email, telephone:tel,
       formule:'Demande de devis — capteurs', engagement:'—', nb_repas:'—', message:msg
     }).then(function(okSend){ done(!!okSend); });
   } else {
     window.location.href='mailto:'+dest+'?subject='+encodeURIComponent('Demande de devis capteurs — '+soc)+'&body='+encodeURIComponent(msg+'\n\nContact : '+nom+' · '+tel+' · '+email);
     done(true);
   }
   ```
3. Bump de version + test réel (envoyer un devis, vérifier réception sur r.t.h@orange.fr).

## Phase 3 — Suppression totale d'EmailJS (après recul OVH)
Quand OVH est confirmé fiable (quelques jours / plusieurs envois réels OK) :

1. **`script.js`** :
   - supprimer les lignes `EMAILJS_SERVICE / EMAILJS_PUBLIC_KEY / EMAILJS_TEMPLATE_*`.
   - supprimer le bloc `if (window.emailjs...) emailjs.init(...)`.
   - dans `sendMailNomos`, supprimer le bloc « 2) Repli EmailJS » (garder OVH seul).
2. **`haccp.html`** : supprimer la balise `<script ... email.min.js>` (l.184).
3. **`accueil.html`** : supprimer les 2 balises EmailJS (l.55-56) et la fonction
   `_repliEmailJS` (rendre l'envoi OVH-only).
4. **Tous les `.html`** : retirer `https://api.emailjs.com` de la directive
   `connect-src` de la CSP (9 fichiers : accueil, haccp, index, mentions, cgu, cgv,
   politique-confidentialite, registre-traitements, contrat-sous-traitance).
5. **Docs RGPD** : retirer les mentions « secours EmailJS (USA) » du registre et du
   contrat de sous-traitance → conformité **100 % UE**.
6. Bump de version (4 fichiers) + test complet des 8 envois.
7. (Optionnel) supprimer les comptes EmailJS.

## Résultat attendu
Plus aucun transit d'e-mail hors UE. La fonction OVH devient l'unique voie.
