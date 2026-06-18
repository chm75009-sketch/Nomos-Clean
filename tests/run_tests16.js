'use strict';
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
function reg(id) { const e = makeEl('div'); e.id = id; doc._registry[id] = e; return e; }
function clearReg() { for (const k of Object.keys(doc._registry)) delete doc._registry[k]; }

// ════════════ A) VIRGULE DÉCIMALE FR (BIZ-8) — « 3,5 » accepté partout ════════════
function tapeVirgule(val, inputmode) {
  const el = makeEl('input');
  if (inputmode) el.setAttribute('inputmode', inputmode);
  el.value = val;
  doc._dispatch('input', { target: el });
  return el.value;
}
ok((doc._handlers['input'] || []).length >= 1, 'virgule: écouteur global installé');
ok(tapeVirgule('3,5', 'decimal') === '3.5', 'virgule: "3,5" -> "3.5"');
ok(tapeVirgule('12,75', 'decimal') === '12.75', 'virgule: "12,75" -> "12.75"');
ok(tapeVirgule('-18,5', 'decimal') === '-18.5', 'virgule: "-18,5" -> "-18.5"');
ok(tapeVirgule('100', 'decimal') === '100', 'virgule: entier inchangé');
ok(tapeVirgule('3,5', null) === '3,5', 'virgule: champ non-décimal non touché (sécurité)');
// _activerVirguleDecimale : bascule number -> text + clavier décimal
{
  const root = makeEl('div'); const num = makeEl('input'); num.setAttribute('type', 'number');
  root._qsa['input[type="number"]'] = [num];
  ctx._activerVirguleDecimale(root);
  ok(num.getAttribute('type') === 'text' && num.getAttribute('inputmode') === 'decimal', 'virgule: input number -> text + inputmode decimal');
}

// ════════════ A2) BOUT EN BOUT — un Français tape "3,5" et la NC est juste ════════════
function tempCatVirgule(seuil, valeurTapee) {
  clearReg();
  const sel = reg('tcat_sel_1'); sel.value = String(seuil);
  const temp = makeEl('input'); temp.id = 'tcat_temp_1'; temp.setAttribute('inputmode', 'decimal'); temp.value = valeurTapee;
  doc._registry['tcat_temp_1'] = temp;
  doc._dispatch('input', { target: temp }); // normalisation virgule -> point (comme à la frappe)
  const g = reg('tcat_status_1'); const okB = makeEl('b'), badB = makeEl('b'); g._qsa['.status-btn'] = [okB, badB];
  reg('tcat_seuilfield_1'); reg('tcat_val_1'); reg('tcat_nc_1'); reg('tcat_nc_action_1');
  ctx.checkTempCat('1');
  return { ok: okB.classList.contains('active-ok'), bad: badB.classList.contains('active-bad') };
}
ok(tempCatVirgule(4, '3,5').ok, 'bout-en-bout: seuil +4, saisie "3,5" -> conforme (décimale préservée)');
ok(tempCatVirgule(4, '4,5').bad, 'bout-en-bout: seuil +4, saisie "4,5" -> NC (décimale préservée)');
ok(tempCatVirgule(-18, '-18,2').ok, 'bout-en-bout: surgelé, saisie "-18,2" -> conforme');

// ════════════ B) DÉCHETS — catalogues par secteur (Loi AGEC) ════════════
const SECTS = ['resto', 'bp', 'rapide', 'boucherie', 'collective'];
const map = { bp: ctx.TYPES_DECHETS_BP, rapide: ctx.TYPES_DECHETS_RAPIDE, boucherie: ctx.TYPES_DECHETS_BOUCHERIE, collective: ctx.TYPES_DECHETS_COLLECTIVE, resto: ctx.TYPES_DECHETS_BASE };
SECTS.forEach(function (s) {
  const t = map[s];
  let good = Array.isArray(t) && t.length > 0;
  (t || []).forEach(function (e) { if (!e || typeof e.label !== 'string' || !/\S/.test(e.label) || typeof e.val !== 'string') good = false; });
  ok(good, 'déchets ' + s + ': catalogue {val,label} bien formé');
  ctx.SECTEUR_ACTIF = s;
  ok(ctx.getTypesDechets() === t, 'déchets ' + s + ': getTypesDechets() renvoie la bonne table');
});
// biodéchets présents partout (obligation Loi AGEC janvier 2024)
SECTS.forEach(function (s) {
  ok((map[s] || []).some(function (e) { return /biod[ée]chet/i.test(e.label); }), 'déchets ' + s + ': biodéchets présents (Loi AGEC)');
});

// ════════════ C) AUTRES CATALOGUES — intégrité ════════════
ok(Array.isArray(ctx.TYPES_HUILE) && ctx.TYPES_HUILE.length >= 5 && ctx.TYPES_HUILE.every(function (x) { return typeof x === 'string' && /\S/.test(x); }), 'huiles: liste de types bien formée');
ok(Array.isArray(ctx.CATEGORIES_PLATS_COLLECTIF) && ctx.CATEGORIES_PLATS_COLLECTIF.length > 0, 'plats collectif: catégories présentes');

console.log('\n══════════════════════════════════════');
console.log('ROUND 16 (virgule décimale FR + déchets) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
