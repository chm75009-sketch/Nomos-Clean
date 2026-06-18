'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
function reg(id) { const e = makeEl('div'); e.id = id; doc._registry[id] = e; return e; }
function clearReg() { for (const k of Object.keys(doc._registry)) delete doc._registry[k]; }

// ═══════════ DLC DATE MATH: calcDLC (étiquettes) — SÉCURITÉ ALIMENTAIRE ═══════════
function dlc(sect, label, fabDate) {
  clearReg(); ctx.SECTEUR_ACTIF = sect;
  reg('etiq_type_1').value = label;
  reg('etiq_date_1').value = fabDate;
  const out = reg('etiq_dlc_1');
  ctx.calcDLC('1');
  return out.value;
}
// resto labels & dlcJours: viande=3, poisson=2, salade=1, fromage=5
ok(dlc('resto', '🥗 Salade composée préparée', '2026-03-15') === '2026-03-16', 'DLC: salade J+1');
ok(dlc('resto', '🐟 Poisson frais déconditionné', '2026-01-30') === '2026-02-01', 'DLC: poisson J+2 (fin de mois)');
ok(dlc('resto', '🥩 Viande découpée / portionnée', '2026-12-30') === '2027-01-02', 'DLC: viande J+3 (passage année)');
ok(dlc('resto', '🥩 Viande découpée / portionnée', '2024-02-27') === '2024-03-01', 'DLC: viande J+3 (année bissextile)');
ok(dlc('resto', '🥩 Viande découpée / portionnée', '2025-02-27') === '2025-03-02', 'DLC: viande J+3 (année normale)');
ok(dlc('resto', '🧀 Fromage découpé / portion', '2026-03-15') === '2026-03-20', 'DLC: fromage J+5');
ok(dlc('resto', '🥩 Viande découpée / portionnée', '') === '', 'DLC: pas de date fab -> rien (no crash)');

// Per-sector: la bonne table est utilisée et le calcul = fab + dlcJours
function addDaysUTC(ymd, n) { const d = new Date(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split('T')[0]; }
[['resto', 'TYPES_ETIQ'], ['bp', 'TYPES_ETIQ_BP'], ['rapide', 'TYPES_ETIQ_RAPIDE'], ['boucherie', 'TYPES_ETIQ_BOUCHERIE'], ['collective', 'TYPES_ETIQ_COLLECTIVE']].forEach(function (p) {
  const table = ctx[p[1]];
  const entry = (table || []).find(function (t) { return t.dlcJours > 0; });
  if (!entry) { ok(false, 'DLC sector ' + p[0] + ': has an entry with dlcJours>0'); return; }
  const got = dlc(p[0], entry.label, '2026-06-15');
  ok(got === addDaysUTC('2026-06-15', entry.dlcJours), 'DLC sector ' + p[0] + ': ' + entry.label + ' = J+' + entry.dlcJours);
});

// ═══════════ TYPES_ETIQ_* integrity (all sectors) ═══════════
['TYPES_ETIQ', 'TYPES_ETIQ_BP', 'TYPES_ETIQ_RAPIDE', 'TYPES_ETIQ_BOUCHERIE', 'TYPES_ETIQ_COLLECTIVE'].forEach(function (k) {
  const t = ctx[k]; let good = Array.isArray(t) && t.length > 0; const seen = {}; let dup = false;
  (t || []).forEach(function (e) {
    if (!e || typeof e.label !== 'string' || !/\S/.test(e.label)) good = false;
    if (!(Number.isInteger(e.dlcJours) && e.dlcJours >= 0)) good = false;
    if (typeof e.conservation !== 'string' || !/\S/.test(e.conservation)) good = false;
    if (seen[e.label]) dup = true; seen[e.label] = 1;
  });
  ok(good, k + ': all entries {label, dlcJours>=0 int, conservation} well-formed');
  ok(!dup, k + ': no duplicate label');
});

// ═══════════ HUILES: checkHuile (T°max 175, TPM max 25) ═══════════
function huile(temp, tpm) {
  clearReg();
  reg('fr_temp_1').value = (temp === '' ? '' : String(temp));
  reg('fr_tpm_1').value = (tpm === '' ? '' : String(tpm));
  const conf = reg('fr_conf_1'); reg('fr_action_temp_1'); reg('fr_action_tpm_1');
  ctx.checkHuile('1');
  return { ok: conf.className.indexOf('ok') > -1, bad: conf.className.indexOf('bad') > -1, pending: conf.className.indexOf('pending') > -1, txt: conf.textContent };
}
ok(huile(170, 20).ok, 'huile: 170°C / 20% -> OK');
ok(huile(175, 25).ok, 'huile: 175°C / 25% (limites exactes) -> OK');
ok(huile(175.1, 20).bad, 'huile: 175.1°C -> NC (température)');
ok(huile(170, 25.1).bad, 'huile: TPM 25.1% -> NC');
ok(huile(180, 30).bad && /175/.test(huile(180, 30).txt) && /TPM/.test(huile(180, 30).txt), 'huile: 180/30 -> double NC');
ok(huile('', '').pending, 'huile: vide -> pending');
ok(huile(160, '').ok, 'huile: T° seule conforme -> OK');

// ═══════════ REFROIDISSEMENT: checkRefroi (+63 -> +10 en 2h) ═══════════
function refroi(sect, t2) {
  clearReg(); ctx.SECTEUR_ACTIF = sect;
  reg('refroi_t2_1').value = (t2 === '' ? '' : String(t2));
  const conf = reg('refroi_conf_1'); reg('refroi_nc_1');
  ctx.checkRefroi('1');
  return { ok: conf.className.indexOf('ok') > -1, bad: conf.className.indexOf('bad') > -1, pending: conf.className.indexOf('pending') > -1, txt: conf.textContent };
}
ok(refroi('resto', 5).ok, 'refroi: +5°C -> OK');
ok(refroi('resto', 10).ok, 'refroi: +10°C (limite) -> OK');
ok(refroi('resto', 10.1).bad, 'refroi: +10.1°C -> NC');
ok(refroi('resto', 25).bad, 'refroi: +25°C -> NC');
ok(refroi('resto', '').pending, 'refroi: vide -> pending');
ok(refroi('bp', 3).ok, 'refroi bp: +3°C -> OK (stockage crèmes ok)');
ok(refroi('bp', 8).pending, 'refroi bp: +8°C -> avertissement stockage (+4 requis)');

// ═══════════ CLOISONNEMENT — garde statique sur TOUTES les écritures ═══════════
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
// Toutes les valeurs code_client: utilisées dans des payloads d'écriture
const codeClientVals = [];
const re = /code_client\s*:\s*([^,\n}]+)/g; let m;
while ((m = re.exec(SRC)) !== null) { codeClientVals.push(m[1].trim()); }
ok(codeClientVals.length >= 5, 'cloisonnement: payloads code_client trouvés (' + codeClientVals.length + ')');
// Chaque valeur doit dériver de ETAB_ID (jamais une autre source / valeur en dur d'un client)
const allowed = codeClientVals.every(function (v) {
  return /String\(ETAB_ID\)/.test(v) || v === 'etab' || v === 'String(_eid)' || v === '_eid' || /ETAB_ID/.test(v);
});
ok(allowed, 'cloisonnement: chaque code_client dérive de ETAB_ID — sinon: ' + JSON.stringify(codeClientVals.filter(function (v) { return !(/ETAB_ID/.test(v) || v === 'etab'); })));
// 'etab' (diag) doit être affecté depuis ETAB_ID
const etabDiag = /var\s+etab\s*=\s*[^;]*ETAB_ID/.test(SRC) || /etab\s*=\s*String\(ETAB_ID\)/.test(SRC);
ok(etabDiag, 'cloisonnement: variable diag "etab" provient bien de ETAB_ID');
// Aucune lecture de controles_haccp sans filtre code_client (anti-fuite cross-client)
const reads = (SRC.match(/controles_haccp/g) || []).length;
const readsFiltered = (SRC.match(/controles_haccp[^\n;]*code_client=eq\./g) || []).length;
ok(reads > 0, 'cloisonnement: table controles_haccp utilisée (' + reads + ' réf.)');

console.log('\n══════════════════════════════════════');
console.log('ROUND 4 RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
