# Prép. — Durcissement de la CSP (retrait de `unsafe-inline`)

> But : renforcer la `Content-Security-Policy` en retirant `'unsafe-inline'` du
> `script-src`, ce qui bloque l'exécution de scripts injectés (défense anti-XSS).
> Chantier **moyen/lourd** : l'app contient beaucoup de code **inline** (attributs
> `onclick=...`, balises `<script>` internes) qui deviendrait bloqué. À planifier
> après les chantiers e-mail / rappel / photos.

## État actuel
Toutes les pages ont une CSP en `<meta>` avec `script-src 'self' 'unsafe-inline' …`.
`unsafe-inline` est nécessaire tant qu'il reste des `onclick=` et scripts inline.

## Deux approches possibles
1. **Nonces / hash** (idéal mais lourd sur ce code) : impossible à faire proprement
   avec une CSP en `<meta>` (les nonces exigent un en-tête HTTP dynamique). Nécessite
   de servir la CSP via **Cloudflare** (voir guide Cloudflare) et de hasher chaque
   script inline — très verbeux vu le volume.
2. **Externalisation progressive** (recommandée, incrémentale) :
   - déplacer le JS inline (`<script>…</script>`) vers des fichiers `.js` externes ;
   - remplacer les `onclick="fn()"` par des `addEventListener` en JS externe ;
   - une fois le inline éliminé page par page, retirer `'unsafe-inline'`.

## Étapes réalistes
1. Commencer par les **pages légères** (mentions, cgu, cgv, registre, DPA…) : peu de
   JS inline → externalisation rapide → CSP durcie sur ces pages d'abord.
2. `accueil.html` : externaliser le petit script du formulaire de démo.
3. `haccp.html` : le gros morceau (énormément d'`onclick`) → **en dernier**, par lots.
4. Servir la CSP en **en-tête HTTP via Cloudflare** (plus robuste que `<meta>`), ce
   qui permettra aussi `frame-ancestors` (anti-clickjacking propre) et, à terme, des
   nonces.

## Gain
Réduction forte de la surface XSS. Mais **risque de régression** élevé si on retire
`unsafe-inline` avant d'avoir tout externalisé → procéder **page par page, testé**.

## Recommandation
Chantier à faire **progressivement**, sans urgence, après les priorités actuelles.
Ne pas retirer `'unsafe-inline'` de `haccp.html` tant que les `onclick` n'ont pas été
externalisés (sinon l'app se bloque).
