#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
 * FILET AUTOMATIQUE — Vérification des rapports HACCP (script.js)
 *
 * Analyse statique SANS dépendance. Détecte les classes de bugs récurrentes
 * (fuite inter-secteurs, lecture DOM dans le Pack, bandeau parasite, matching
 * par position non fiabilisé, [object Object], double déclaration, etc.).
 *
 * Usage :  node outils/verif-rapports.js
 * Sortie :  liste des anomalies + code de sortie 1 si au moins une trouvée.
 * ════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const FICHIER = path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(FICHIER, 'utf8');
const lignes = src.split('\n');

const problemes = []; // { niveau, ligne, msg }
function signaler(niveau, ligne, msg) { problemes.push({ niveau, ligne, msg }); }

// ── Découpe le fichier en fonctions de premier niveau (function NAME( ... )
//    en se basant sur les `function` en début de ligne (colonne 0/2). ──────
function fonctions() {
  const res = [];
  const re = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/;
  let courante = null;
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(re);
    if (m) {
      if (courante) { courante.fin = i; res.push(courante); }
      courante = { nom: m[1], debut: i + 1, fin: lignes.length };
    }
  }
  if (courante) res.push(courante);
  return res;
}
function corps(fn) { return lignes.slice(fn.debut - 1, fn.fin).join('\n'); }
const FNS = fonctions();
function trouverFn(nom) { return FNS.find(f => f.nom === nom); }

// Fonctions qui AFFICHENT des contrôles → doivent isoler par secteur
const FN_AFFICHAGE = /dashboard|imprimer|rapport|pack|historique|mesRapports|NCGlobales|controlesCloud/i;
// Fonctions liées aux étiquettes → seules autorisées à contenir le bandeau Avery
const FN_ETIQUETTE = /etiquet/i;

// ════════════════════════════════════════════════════════════════════════
// CHECK 1 — Bandeau "Format Avery" hors d'une fonction étiquettes
// ════════════════════════════════════════════════════════════════════════
FNS.forEach(fn => {
  if (FN_ETIQUETTE.test(fn.nom)) return;
  const c = corps(fn);
  if (/Format Avery/i.test(c)) {
    const idx = lignes.findIndex((l, i) => i >= fn.debut - 1 && i < fn.fin && /Format Avery/i.test(l));
    signaler('ERREUR', idx + 1, `Bandeau "Format Avery" (étiquettes) présent dans ${fn.nom}() — copier-coller parasite ?`);
  }
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 2 — Lecture du DOM (collecterDonnees*) DANS la génération du Pack
//           → contourne les filtres période + secteur (fuite inter-secteurs)
// ════════════════════════════════════════════════════════════════════════
['lancerPackDDPP'].forEach(nom => {
  const fn = trouverFn(nom);
  if (!fn) return;
  const c = corps(fn);
  const m = c.match(/collecterDonnees(Temperatures|Cuisson|Refroidissement|Huiles)\s*\(/g);
  if (m) signaler('ERREUR', fn.debut, `${nom}() lit le DOM via ${[...new Set(m)].join(', ')} — doit lire getDonneesPeriode (filtré secteur/période)`);
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 3 — Fonctions d'affichage qui lisent localStorage des contrôles
//           sans appeler _secteurActifMatch (= fuite inter-secteurs)
// ════════════════════════════════════════════════════════════════════════
FNS.forEach(fn => {
  if (!FN_AFFICHAGE.test(fn.nom)) return;
  if (/^(sauvegarder|enregistrer|effacer|supprimer)/i.test(fn.nom)) return; // écrivains, pas d'affichage
  const c = corps(fn);
  const litControles = /haccp_module_data|haccp_historique/.test(c);
  const litCloud = /_histoCloudRows|_cloudCache/.test(c);
  if ((litControles || litCloud)) {
    const passeParGetDonnees = /getDonneesPeriode/.test(c);   // déjà filtré en amont
    // Preuve d'un filtrage secteur : helper dédié OU comparaison directe .secteur
    const filtreSecteur = /_secteurActifMatch|\.secteur\s*!==|\.secteur\s*===|secteur\s*!==\s*_curSecteur/.test(c);
    if (litControles && !filtreSecteur && !passeParGetDonnees) {
      signaler('ERREUR', fn.debut, `${fn.nom}() lit les contrôles (localStorage) sans filtre secteur — fuite inter-secteurs possible`);
    }
  }
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 4 — Double déclaration consécutive `var X = ...; var X = ...`
// ════════════════════════════════════════════════════════════════════════
for (let i = 1; i < lignes.length; i++) {
  const a = lignes[i - 1].match(/^\s*var\s+([A-Za-z0-9_$]+)\s*=/);
  const b = lignes[i].match(/^\s*var\s+([A-Za-z0-9_$]+)\s*=/);
  if (a && b && a[1] === b[1]) {
    signaler('ALERTE', i + 1, `Double déclaration consécutive de "${a[1]}" (code mort / copier-coller)`);
  }
}

// ════════════════════════════════════════════════════════════════════════
// CHECK 5 — "[object Object]" littéral dans le source (ne devrait jamais
//           être écrit en dur, mais on vérifie son absence par sécurité)
// ════════════════════════════════════════════════════════════════════════
lignes.forEach((l, i) => {
  if (l.indexOf('[object Object]') > -1) signaler('ERREUR', i + 1, 'Chaîne "[object Object]" présente dans le source');
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 6 — Matching action↔NC par position (.shift()/.splice consommation)
//           sans priorité au lien fiable s.action dans la même fonction
// ════════════════════════════════════════════════════════════════════════
FNS.forEach(fn => {
  const c = corps(fn);
  const positionnel = /\b(actsPourStatut|actIdx2|actionsList)\b\s*\.\s*shift\s*\(/.test(c);
  if (positionnel) {
    const fiable = /s\.action|\.action\s*&&\s*typeof/.test(c);
    if (!fiable) {
      signaler('ALERTE', fn.debut, `${fn.nom}() apparie action↔NC par position (.shift) sans priorité à s.action — risque d'action attribuée à la mauvaise NC`);
    }
  }
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 7 — Titres d'overlay codés en dur (à vérifier à l'œil : mismatch ?)
//           On liste pour info ceux dont le texte ne ressemble pas au module.
// ════════════════════════════════════════════════════════════════════════
FNS.forEach(fn => {
  const c = corps(fn);
  const m = c.match(/_tbTitle\.textContent\s*=\s*'([^']+)'/);
  if (m) {
    const titre = m[1];
    // heuristique : si le nom de fonction évoque un module précis mais que le
    // titre parle d'un AUTRE module connu, on alerte.
    const modulesConnus = ['Etiquetage','Réception','Reception','Températures','Temperatures','Cuisson','Huiles','Refroidissement','Tableau de Bord','Hygiène','Nettoyage'];
    const autre = modulesConnus.find(mm => titre.indexOf(mm) > -1);
    // (info seulement — pas d'erreur automatique car trop de faux positifs)
  }
});

// ════════════════════════════════════════════════════════════════════════
// CHECK 8 — Syntaxe JS valide (compilation rapide)
// ════════════════════════════════════════════════════════════════════════
try {
  new Function(src);
} catch (e) {
  signaler('ERREUR', 0, 'Erreur de syntaxe JS : ' + (e.message || e));
}

// ════════════════════════════════════════════════════════════════════════
// RÉSULTAT
// ════════════════════════════════════════════════════════════════════════
const erreurs = problemes.filter(p => p.niveau === 'ERREUR');
const alertes = problemes.filter(p => p.niveau === 'ALERTE');

console.log('═══════════════════════════════════════════════════════════');
console.log(' FILET HACCP — Vérification des rapports');
console.log('═══════════════════════════════════════════════════════════');
console.log(` Fonctions analysées : ${FNS.length}`);
console.log(` Lignes              : ${lignes.length}`);
console.log('───────────────────────────────────────────────────────────');

if (problemes.length === 0) {
  console.log(' ✅ Aucune anomalie détectée. Rapports cohérents.');
} else {
  problemes.sort((a, b) => a.ligne - b.ligne);
  erreurs.forEach(p => console.log(` ❌ [L${p.ligne}] ${p.msg}`));
  alertes.forEach(p => console.log(` ⚠️  [L${p.ligne}] ${p.msg}`));
  console.log('───────────────────────────────────────────────────────────');
  console.log(` ${erreurs.length} erreur(s), ${alertes.length} alerte(s).`);
}
console.log('═══════════════════════════════════════════════════════════');

process.exit(erreurs.length > 0 ? 1 : 0);
