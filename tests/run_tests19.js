'use strict';
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
function reg(id) { const e = makeEl('div'); e.id = id; doc._registry[id] = e; return e; }
function statusGrp(id) { const g = reg(id); g._qsa['.status-btn'] = [makeEl('b'), makeEl('b')]; return g; }
function clearReg() { for (const k of Object.keys(doc._registry)) delete doc._registry[k]; }

// Valeurs « hostiles » qu'un vrai utilisateur peut produire
const FUZZ = ['', '   ', 'abc', 'NaN', 'null', '++4', '4.5.6', '1e2', '4°C', '999999', '-999999', '0', '-0',
  'Infinity', '-Infinity', ' ', '\t\n', '4,5', '  -18  ', '<script>', "'; DROP TABLE", 'x'.repeat(2000), '٤', '³'];

function fuzz(label, setup, call) {
  let crashes = 0, firstErr = '';
  FUZZ.forEach(function (v) {
    clearReg();
    try { setup(v); call(); } catch (e) { crashes++; if (!firstErr) firstErr = (v.slice ? v.slice(0, 12) : v) + ' -> ' + e.message; }
  });
  ok(crashes === 0, 'fuzz ' + label + ': aucune entrée ne fait planter (' + FUZZ.length + ' cas)' + (crashes ? ' [' + firstErr + ']' : ''));
}

// ── checkTempCat (stockage froid) ──
fuzz('checkTempCat', function (v) {
  reg('tcat_sel_1').value = '4'; reg('tcat_temp_1').value = v; statusGrp('tcat_status_1');
  reg('tcat_seuilfield_1'); reg('tcat_val_1'); reg('tcat_nc_1'); reg('tcat_nc_action_1');
}, function () { ctx.checkTempCat('1'); });

// ── checkTempEnceinte ──
fuzz('checkTempEnceinte', function (v) {
  reg('enc_temp_1').value = v; reg('enc_conf_1'); reg('enc_nc_1');
}, function () { ctx.checkTempEnceinte('1', 4); });

// ── checkCuissonConf (cuisson) ──
fuzz('checkCuissonConf', function (v) {
  ctx.SECTEUR_ACTIF = 'resto'; reg('plat_type_1').value = '74'; reg('plat_temp_1').value = v;
  reg('plat_conf_1'); reg('plat_nc_1');
}, function () { ctx.checkCuissonConf('1'); });

// ── checkConformite (réception produit) ──
fuzz('checkConformite', function (v) {
  reg('cat_1').value = '4'; reg('temp_1').value = v; statusGrp('conf_status_1');
  ['conf_seuil_1', 'conf_val_1', 'nc_temp_1', 'nc_temp_action_1', 'seuil_val_1', 'seuil_lbl_1'].forEach(reg);
}, function () { ctx.checkConformite('1'); });

// ── checkComp (compartiment véhicule) ──
fuzz('checkComp', function (v) {
  reg('comp_type_1').value = '4'; reg('comp_tsonde_1').value = v; statusGrp('comp_status_1');
  ['comp_seuil_reg_1', 'comp_val_tbord_1', 'comp_val_tsonde_1', 'comp_nc_wrap_1'].forEach(reg);
}, function () { ctx.checkComp('1'); });

// ── checkHuile ──
fuzz('checkHuile', function (v) {
  reg('fr_temp_1').value = v; reg('fr_tpm_1').value = v; reg('fr_conf_1'); reg('fr_action_temp_1'); reg('fr_action_tpm_1');
}, function () { ctx.checkHuile('1'); });

// ── checkRemise ──
fuzz('checkRemise', function (v) {
  reg('remise_tf_1').value = v; reg('remise_conf_1'); reg('remise_nc_1');
}, function () { ctx.checkRemise('1'); });

// ── checkRefroi ──
fuzz('checkRefroi', function (v) {
  ctx.SECTEUR_ACTIF = 'resto'; reg('refroi_t2_1').value = v; reg('refroi_conf_1'); reg('refroi_nc_1');
}, function () { ctx.checkRefroi('1'); });

// ── parsers / formatters tolérants ──
fuzz('fmtTemp', function () {}, function () { FUZZ.forEach(function (v) { ctx.fmtTemp(v); }); });
fuzz('hvParseNumber', function () {}, function () { FUZZ.forEach(function (v) { ctx.hvParseNumber(v); }); });
fuzz('seuilEnceinteDepuisLabel', function () {}, function () { FUZZ.forEach(function (v) { ctx.seuilEnceinteDepuisLabel(v); }); });
fuzz('nettoyerNomFichier', function () {}, function () { FUZZ.forEach(function (v) { ctx.nettoyerNomFichier(v); }); });
fuzz('_nrmNC', function () {}, function () { FUZZ.forEach(function (v) { ctx._nrmNC(v); }); });

// ── aberrant guard enceinte : valeurs impossibles -> aucun verdict ──
function encVerdict(v) {
  clearReg(); reg('enc_temp_1').value = String(v); const c = reg('enc_conf_1'); reg('enc_nc_1');
  ctx.checkTempEnceinte('1', 4);
  return { ok: c.className.indexOf('ok') > -1, bad: c.className.indexOf('bad') > -1 };
}
[300, -100, 9999, -9999, 1e6].forEach(function (v) {
  const r = encVerdict(v);
  ok(!r.ok && !r.bad, 'aberrant: ' + v + '°C -> aucun verdict (alerte valeur implausible)');
});

console.log('\n══════════════════════════════════════');
console.log('ROUND 19 (robustesse / fuzzing) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
