'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;

// ════════════ A) seuilEnceinteDepuisLabel — source de vérité des seuils ════════════
const S = ctx.seuilEnceinteDepuisLabel;
// mots-clés génériques
ok(S('Mon bac de surgelés perso') === '-18°C max', 'seuil: "surgelés" -> -18°C max');
ok(S('Grand congélateur cave') === '-18°C max', 'seuil: "congélateur" -> -18°C max');
ok(S('Maintien chaud buffet') === '+63°C min', 'seuil: "chaud" -> +63°C min');
ok(S('Cellule rapido') === '+10°C en 2h max', 'seuil: "cellule" -> +10°C en 2h max');
ok(S('Zone ultra-fraîche') === '+2°C max', 'seuil: "ultra" -> +2°C max');
ok(S('Frigo du bar') === '+4°C max', 'seuil: "frigo" -> +4°C max');
ok(S('Vitrine réfrigérée desserts') === '+4°C max', 'seuil: "réfrig" -> +4°C max');
// seuils écrits explicitement dans le libellé
ok(S('Chambre spéciale (<=+2C)') === '+2°C max', 'seuil: "(<=+2C)" -> +2°C max');
ok(S('Local technique ≤ +3 °C') === '+3°C max', 'seuil: "≤ +3 °C" -> +3°C max');
ok(S('Étuve de maintien ≥ +63C') === '+63°C min', 'seuil: "≥ +63C" -> +63°C min');
// indéterminable
ok(S('Bureau administratif') === '', 'seuil: pas de mot-clé -> "" (indéterminable)');
ok(S('') === '' && S(null) === '', 'seuil: vide/null -> ""');

// ════════════ B) SEUILS_ENCEINTE — intégrité de la table ════════════
{
  const T = ctx.SEUILS_ENCEINTE; let good = true;
  Object.keys(T).forEach(function (k) {
    const e = T[k];
    if (!(e && typeof e.label === 'string' && /\S/.test(e.label))) good = false;
    if (!(e.seuil === null || typeof e.seuil === 'number')) good = false;
  });
  ok(good, 'SEUILS_ENCEINTE: chaque entrée {seuil(num|null), label} bien formée');
  ok(T.congelateur.seuil === -18 && T.refrigerateur.seuil === 4, 'SEUILS_ENCEINTE: congélateur -18, frigo +4 (valeurs réglementaires)');
  ok(T.bain_marie.seuil === null, 'SEUILS_ENCEINTE: bain-marie en saisie manuelle (pas de seuil froid)');
}

// ════════════ C) PDF LÉGAL (Températures) — contenu remis à l'inspecteur ════════════
ctx.ETAB = { nom: 'Le Bistrot du Coin' };
ctx.SECTEUR_ACTIF = 'resto';
const dataOverride = [
  { type: 'Réfrigérateur', temp: '3', isNC: false, conf: 'Conforme', precision: 'Frigo cuisine', refNum: 'F1' },
  { type: 'Congélateur', temp: '-12', isNC: true, conf: 'Non conforme', action: 'Produit jeté', precision: 'Congel arrière', refNum: 'C1' }
];
// capture le contenu HTML généré
const created = [];
const origCreate = doc.createElement.bind(doc);
doc.createElement = function (t) { const el = origCreate(t); created.push(el); return el; };
ctx.imprimerTemperatures(dataOverride, 'Jean Dupont', '01/06/2026 a 10h00');
doc.createElement = origCreate;
const contentEl = created.find(function (e) { return typeof e.innerHTML === 'string' && /Temperatures Enceintes/.test(e.innerHTML); });
const html = contentEl ? contentEl.innerHTML : '';
ok(html.length > 0, 'PDF: contenu généré');
ok(/Le Bistrot du Coin/.test(html), 'PDF: nom de l\'établissement présent');
ok(/Jean Dupont/.test(html), 'PDF: signataire présent');
ok(/01\/06\/2026 a 10h00/.test(html), 'PDF: date/heure présente');
ok(/Restauration traditionnelle/.test(html), 'PDF: secteur présent');
ok(/3°C/.test(html), 'PDF: température conforme (+3°C) présente');
ok(/-12°C/.test(html), 'PDF: température NC (-12°C) présente');
ok(/1 non-conformite/.test(html), 'PDF: compteur de non-conformités (1)');
ok(/Produit jeté/.test(html), 'PDF: action corrective de la NC présente');
ok(/-18°C max/.test(html), 'PDF: seuil réglementaire du congélateur affiché');
ok(/3 ans/.test(html), 'PDF: mention légale de conservation 3 ans');

// PDF vide -> pas de plantage, pas d'overlay
let threw = false;
try { ctx.imprimerTemperatures([], 'X', 'now'); } catch (e) { threw = true; }
ok(!threw, 'PDF: aucune enceinte saisie -> pas de plantage');

console.log('\n══════════════════════════════════════');
console.log('ROUND 11 (seuils enceintes + PDF légal) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
