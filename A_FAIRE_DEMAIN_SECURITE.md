# 🔐 Suivi Sécurité (note pour Léa & Claude)

_Mise à jour : 25/06/2026._

## ✅ DÉJÀ FAIT (ne pas refaire)

### Sessions précédentes
1. Mot de passe admin `826700` neutralisé (secret Vault `admin_password`) — **2 projets**.
2. Table `etablissements` : UPDATE limité à sa propre fiche, DELETE fermé à la clé publique.
3. Table `comptes_clients` : écritures admin via fonctions sécurisées + policies anon supprimées. **Testé OK.**
4. Isolation lecture confirmée (`controles_haccp` filtré par établissement).
5. RLS activé partout (2 projets). App Audit confirmée saine.
6. XSS : champs libres restants échappés (`_echap` / `escapeHtml`).
7. Comptes de test en dur retirés (DEMO/TESTBP/TESTRAPIDE).

### Session 25/06/2026
8. **Création de comptes verrouillée** : règle RLS `etab_insert` ouverte (`with_check = true`)
   remplacée par une règle restreinte (essais ≤ 10 j, non multi-secteur). Les clients payants
   passent par `admin_creer_etab` (SECURITY DEFINER). **Testé : essai 7 j ✅, client 1 an ✅.**
9. **Immutabilité des contrôles validés** : trigger `controles_haccp_immutable` (interdit de modifier
   contenu/signature/module/date/code d'une ligne signée ; seules les photos restent rattachables). **Exécuté ✅.**
10. **Anti-brute-force admin** : `admin_check` ré-écrit avec ralentissement escaladant (0,3 s → 4 s max)
    + table compteur `admin_login_attempts` (RLS, illisible). Pas de verrouillage dur (pas de DoS). **Exécuté ✅.**
11. **Mot de passe admin renforcé** (Léa l'a défini elle-même dans le Vault). ⚠️ Ne JAMAIS le changer sans son accord explicite.
12. **RLS revérifié table par table** (les 9 tables) : aucune fuite inter-clients (pas d'IDOR).
    Seuls INSERT ouverts = `demandes_inscription` + `historique_admin` (voulu ; au pire du spam, pas de fuite).
13. **Mise à jour 1 clic** : bandeau « Nouvelle version disponible » + bouton (plus de galère de cache). Déployé.
14. Audit externe (rapport pentest) **analysé point par point → globalement neutralisé** (la plupart des alertes
    étaient conditionnées à « si RLS insuffisant », ce qui n'est pas le cas).

### Session 28/06/2026
15. **CSP ACTIVÉE** (mode appliqué, plus seulement observation) via `netlify.toml` : bloque tout script/ressource
    non autorisé. Liste blanche auditée sur Nomos **+ app Audit** : jsdelivr, **cdnjs.cloudflare** (docx), unpkg,
    Google Fonts, Supabase ×2, EmailJS, Ubibot. **Anti-XSS renforcé.**
16. **`826700` retiré du code** (comptes démo RTH75 / RTH3) → remplacé par `demo-rth-2026`. L'ancien mot de passe
    admin n'apparaît plus dans le code des 2 apps.

## ⏸️ DÉCISIONS / EN ATTENTE (choix de Léa)
- **E-mails** : Léa choisit la **communication manuelle** des codes (zéro dépendance). EmailJS non verrouillé (offre payante).
- **CSP (anti-XSS)** : **à poser au moment du vrai hébergement** (pas GitHub Pages) — là on pourra la tester en
  **mode observation** (report-only) sans rien casser. Liste blanche des domaines déjà auditée (voir ci-dessous).
- **826700 sur RTH75/RTH3** (codes démo locaux) : **plus tard** (risque faible, n'ouvre plus l'admin).

## 🟡 À FAIRE LE JOUR DE L'HÉBERGEMENT DÉFINITIF
1. **CSP** via en-tête (ou meta), en report-only d'abord. Liste blanche auditée le 25/06 :
   - script-src : `cdn.jsdelivr.net`, `unpkg.com` + `'unsafe-inline'` (onclick partout)
   - connect-src : `kiknaxuzpovvivkjqzss.supabase.co` (+ wss), `zdwdeavcwivvdtrjqwme.supabase.co` (audit),
     `api.ubibot.com`, `api.emailjs.com`
   - style/font : `fonts.googleapis.com`, `fonts.gstatic.com`, `data:`
   - img-src : `'self' data: blob: https:`
2. **En-têtes HTTP** : HSTS, X-Content-Type-Options, X-Frame-Options (impossibles sur GitHub Pages).
3. **Héberger les 6 librairies en local** + SRI (anti-piratage CDN) — testable hors-ligne.

## 🧹 Mineurs (sans urgence)
- `historique_admin` / `demandes_inscription` : INSERT anon ouvert → resserrer si spam constaté.
- 826700 en clair dans `CODES_LOCAUX` (RTH75/RTH3).

## Fichiers SQL de référence (dossier backend/)
- `admin_creer_etab.sql`, `immutabilite_controles.sql` (créés cette session).
- `admin_ecritures_comptes.sql`, `admin_ecritures_etab.sql`, `admin_set_etat_etab.sql`, `supervision_capteurs.sql`.
- Anti-brute-force `admin_check` : exécuté directement dans le SQL Editor (table `admin_login_attempts` + fonction).
