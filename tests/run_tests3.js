'use strict';
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;

// ═══════════ CATALOGUE STRUCTURAL INTEGRITY (all sectors) ═══════════
const SECTS = ['resto', 'bp', 'rapide', 'boucherie', 'collective'];
SECTS.forEach(function (s) {
  const cat = ctx.CATALOGUES_SECTEUR[s];
  ok(Array.isArray(cat) && cat.length > 0, 'catalogue ' + s + ': non-empty array');
  let allGood = true, badDetail = '';
  (cat || []).forEach(function (grp, gi) {
    if (!grp || typeof grp.cat !== 'string' || !/\S/.test(grp.cat)) { allGood = false; badDetail = 'cat label @' + gi; }
    const seuilOK = grp && (grp.seuil === 'amb' || grp.seuil === undefined || !isNaN(parseFloat(grp.seuil)));
    if (!seuilOK) { allGood = false; badDetail = 'seuil @' + gi + '=' + (grp && grp.seuil); }
    if (!grp || !Array.isArray(grp.items) || grp.items.length === 0) { allGood = false; badDetail = 'items @' + gi; }
    (grp && grp.items || []).forEach(function (it) {
      if (typeof it !== 'string' || !/\S/.test(it)) { allGood = false; badDetail = 'empty item @' + gi; }
    });
  });
  ok(allGood, 'catalogue ' + s + ': every category {cat, seuil, items[]} well-formed' + (allGood ? '' : ' [' + badDetail + ']'));
});
// total products per sector are reasonable + no exact-duplicate items inside a category
SECTS.forEach(function (s) {
  let dupInCat = false;
  (ctx.CATALOGUES_SECTEUR[s] || []).forEach(function (grp) {
    const seen = {};
    (grp.items || []).forEach(function (it) { const k = it.toLowerCase(); if (seen[k]) dupInCat = true; seen[k] = 1; });
  });
  ok(!dupInCat, 'catalogue ' + s + ': no duplicate item within a category');
});

// ═══════════ PRODUITS_DISPLAY_* structural soundness ═══════════
['PRODUITS_DISPLAY', 'PRODUITS_DISPLAY_BP', 'PRODUITS_DISPLAY_RAPIDE', 'PRODUITS_DISPLAY_BOUCHERIE', 'PRODUITS_DISPLAY_COLLECTIVE'].forEach(function (k) {
  const arr = ctx[k];
  ok(Array.isArray(arr) && arr.length > 0, k + ': non-empty array');
});

// ═══════════ fmtTemp ═══════════
[[3, '+3°C'], [-18, '-18°C'], [0, '+0°C'], ['', ''], [null, ''], [undefined, ''],
 ['4°C', '+4°C'], ['+3.5', '+3.5°C'], ['-2 °c', '-2°C'], ['abc', 'abc']].forEach(function (p) {
  const r = ctx.fmtTemp(p[0]);
  ok(r === p[1], 'fmtTemp(' + JSON.stringify(p[0]) + ') -> ' + JSON.stringify(p[1]) + ' (got ' + JSON.stringify(r) + ')');
});

// ═══════════ buildNCAction: no crash, contains id + actions ═══════════
['5', '12', 'cfg1', 'p2', "x'1"].forEach(function (id) {
  let s = null, threw = false;
  try { s = ctx.buildNCAction(id); } catch (e) { threw = true; }
  ok(!threw && typeof s === 'string' && s.indexOf('nc_action_' + id) > -1, 'buildNCAction(' + JSON.stringify(id) + '): ok, has id');
  ok(!threw && s.indexOf('Action corrective') > -1, 'buildNCAction(' + JSON.stringify(id) + '): has corrective actions');
});
ok(ctx.ACTIONS_CORRECTIVES.length >= 10, 'ACTIONS_CORRECTIVES: >=10 actions');

// ═══════════ PRINT COLLECTORS on EMPTY data (client prints with nothing filled) ═══════════
ctx.SECTEUR_ACTIF = 'resto';
ctx.ETAB = { nom: 'Test', secteur: 'resto' };
ctx.ETAB_ID = 'etab-uuid-123';
function noThrow(name, fn) {
  let threw = false, err = '';
  try { fn(); } catch (e) { threw = true; err = e.message; }
  ok(!threw, 'collector empty: ' + name + ' does not crash' + (threw ? ' [' + err + ']' : ''));
}
noThrow('collecterDonneesTemperatures', function () { ctx.collecterDonneesTemperatures(); });
noThrow('collecterDonneesCuisson', function () { ctx.collecterDonneesCuisson(); });
noThrow('collecterDonneesRefroidissement', function () { ctx.collecterDonneesRefroidissement(); });
noThrow('collecterDonnees(reception)', function () { ctx.collecterDonnees(); });

// ═══════════ Cross-sector: switching SECTEUR_ACTIF keeps catalogue access stable ═══════════
SECTS.forEach(function (s) {
  ctx.SECTEUR_ACTIF = s;
  let threw = false;
  try { ctx.getCatalogueActif(); ctx.getTypesEnceintesActif(); } catch (e) { threw = true; }
  ok(!threw, 'sector-switch ' + s + ': getCatalogueActif + getTypesEnceintesActif stable');
});

// ═══════════ TYPES_ENCEINTES integrity per sector ═══════════
SECTS.forEach(function (s) {
  ctx.SECTEUR_ACTIF = s;
  const t = ctx.getTypesEnceintesActif();
  ok(Array.isArray(t) && t.length > 0, 'enceintes types ' + s + ': non-empty');
});

console.log('\n══════════════════════════════════════');
console.log('ROUND 3 RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
