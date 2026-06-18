'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }

function objBienForme(o) {
  if (!o || typeof o !== 'object') return false;
  const keys = Object.keys(o);
  if (!keys.length) return false;
  return keys.every(function (k) {
    return Array.isArray(o[k]) && o[k].length > 0 && o[k].every(function (x) { return typeof x === 'string' && /\S/.test(x); });
  });
}

// ════════════ A) AFFICHAGE OBLIGATOIRE (cuisine + salle) ════════════
[['AFF_CUISINE_ITEMS', ctx.AFF_CUISINE_ITEMS], ['AFF_SALLE_ITEMS', ctx.AFF_SALLE_ITEMS], ['DOCS_SPECIFIQUES', ctx.DOCS_SPECIFIQUES]].forEach(function (p) {
  ok(objBienForme(p[1]), p[0] + ': listes par secteur bien formées');
  ['bp', 'rapide', 'boucherie', 'collective'].forEach(function (s) {
    ok(p[1] && Array.isArray(p[1][s]) && p[1][s].length > 0, p[0] + ': secteur ' + s + ' renseigné');
  });
});

// 14 allergènes mentionnés dans l'affichage salle (obligation INCO)
['bp', 'rapide', 'boucherie', 'collective'].forEach(function (s) {
  const items = (ctx.AFF_SALLE_ITEMS && ctx.AFF_SALLE_ITEMS[s]) || [];
  ok(items.some(function (x) { return /14 allerg|allerg/i.test(x); }), 'affichage salle ' + s + ': mention allergènes présente');
});
// interdiction de fumer/vapoter (obligation d'affichage)
['bp', 'rapide', 'boucherie', 'collective'].forEach(function (s) {
  const items = (ctx.AFF_SALLE_ITEMS && ctx.AFF_SALLE_ITEMS[s]) || [];
  ok(items.some(function (x) { return /fumer|vapoter/i.test(x); }), 'affichage salle ' + s + ': interdiction fumer/vapoter présente');
});
// origine viande bovine obligatoire en boucherie
{
  const b = (ctx.AFF_SALLE_ITEMS && ctx.AFF_SALLE_ITEMS.boucherie) || [];
  ok(b.some(function (x) { return /origine.*viande|viande.*bovine/i.test(x); }), 'affichage boucherie: origine viande bovine obligatoire');
}

// ════════════ B) LISTE DES MODULES NC ════════════
const NC = ctx.MODULES_NC;
ok(Array.isArray(NC) && NC.length > 0 && NC.every(function (x) { return typeof x === 'string' && /\S/.test(x); }), 'MODULES_NC: liste bien formée');
['Réception & Traçabilité', 'Hygiène Personnel', 'Huiles Friture', 'Nuisibles'].forEach(function (m) {
  ok(NC.indexOf(m) > -1, 'MODULES_NC: "' + m + '" présent');
});
ok(NC.indexOf('Autre') > -1, 'MODULES_NC: catégorie "Autre" présente (catch-all)');
{
  const seen = {}; let dup = false;
  NC.forEach(function (x) { if (seen[x]) dup = true; seen[x] = 1; });
  ok(!dup, 'MODULES_NC: aucun doublon');
}

// ════════════ C) ONBOARDING SECTEUR — fiche spécifique par secteur ════════════
['resto', 'bp', 'rapide', 'boucherie', 'collective'].forEach(function (s) {
  ok(typeof ctx.SECTEURS_SPECIFIQUE[s] === 'string' && ctx.SECTEURS_SPECIFIQUE[s].length > 30, 'onboarding ' + s + ': fiche spécifique présente');
});

console.log('\n══════════════════════════════════════');
console.log('ROUND 21 (affichage réglementaire + modules NC) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
