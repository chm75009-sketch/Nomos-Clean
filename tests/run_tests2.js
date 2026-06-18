'use strict';
const { loadApp, makeEl } = require('./load_app.js');

let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
function reg(id) { const e = makeEl('div'); e.id = id; doc._registry[id] = e; return e; }
function clearReg() { for (const k of Object.keys(doc._registry)) delete doc._registry[k]; }

// ═══════════ SECTORS ═══════════
const SECTS = ['resto', 'bp', 'rapide', 'boucherie', 'collective'];
SECTS.forEach(function (s) {
  ok(ctx.SECTEURS_CONFIG[s] && /\S/.test(ctx.SECTEURS_CONFIG[s].label), 'sector ' + s + ': config label non-empty');
  ok(typeof ctx.SECTEURS_SPECIFIQUE[s] === 'string' && ctx.SECTEURS_SPECIFIQUE[s].length > 20, 'sector ' + s + ': onboarding HTML present');
  ok(ctx.CATALOGUES_SECTEUR[s] != null, 'sector ' + s + ': catalogue present');
  ok(Array.isArray(ctx.VEH_CATEGORIES[s]) && ctx.VEH_CATEGORIES[s].length > 0, 'sector ' + s + ': vehicle categories present');
});
// getCatalogueActif maps correctly
SECTS.forEach(function (s) {
  ctx.SECTEUR_ACTIF = s;
  const expected = ctx.CATALOGUES_SECTEUR[s] || ctx.CATALOGUES_SECTEUR.resto;
  ok(ctx.getCatalogueActif() === expected, 'getCatalogueActif: ' + s);
});
ctx.SECTEUR_ACTIF = 'zzz_unknown';
ok(ctx.getCatalogueActif() === ctx.CATALOGUES_SECTEUR.resto, 'getCatalogueActif: unknown -> resto default');
// getBySection
ctx.SECTEUR_ACTIF = 'bp'; ok(ctx.getBySection('R', 'B', 'F', 'C', 'L') === 'B', 'getBySection bp');
ctx.SECTEUR_ACTIF = 'collective'; ok(ctx.getBySection('R', 'B', 'F', 'C', 'L') === 'L', 'getBySection collective');
ctx.SECTEUR_ACTIF = 'boucherie'; ok(ctx.getBySection('R', undefined, undefined, undefined, undefined) === 'R', 'getBySection fallback to resto when undefined');
ctx.SECTEUR_ACTIF = 'resto'; ok(ctx.getBySection('R', 'B', 'F', 'C', 'L') === 'R', 'getBySection resto');

// ═══════════ COLD STORAGE: checkTempCat ═══════════
function tempCat(seuilVal, tempVal) {
  clearReg();
  reg('tcat_sel_1').value = String(seuilVal);
  reg('tcat_temp_1').value = (tempVal === '' ? '' : String(tempVal));
  const g = reg('tcat_status_1'); const okB = makeEl('button'), badB = makeEl('button'); g._qsa['.status-btn'] = [okB, badB];
  reg('tcat_seuilfield_1'); reg('tcat_val_1'); reg('tcat_nc_1'); reg('tcat_nc_action_1');
  ctx.checkTempCat('1');
  return { ok: okB.classList.contains('active-ok'), bad: badB.classList.contains('active-bad'), none: !okB.classList.contains('active-ok') && !badB.classList.contains('active-bad') };
}
ok(tempCat(4, 3).ok, 'cold: +4 seuil, +3 -> OK');
ok(tempCat(4, 4).ok, 'cold: +4 seuil, +4 (boundary) -> OK');
ok(tempCat(4, 4.1).bad, 'cold: +4 seuil, +4.1 -> NC');
ok(tempCat(-18, -18).ok, 'cold: -18 seuil, -18 -> OK');
ok(tempCat(-18, -17).bad, 'cold: -18 seuil, -17 (warmer) -> NC');
ok(tempCat(-18, -20).ok, 'cold: -18 seuil, -20 (colder) -> OK');
ok(tempCat(0, 0).ok, 'cold: 0 seuil, 0 -> OK');
ok(tempCat(0, 0.5).bad, 'cold: 0 seuil, +0.5 -> NC');
ok(tempCat(4, '').none, 'cold: empty temp -> no status');
ok(tempCat('amb', 25).none, 'cold: ambient -> skipped');
ok(tempCat('', 5).none, 'cold: empty seuil -> skipped');

// ═══════════ ENCEINTE: checkTempEnceinte ═══════════
function enceinte(seuil, tempVal) {
  clearReg();
  reg('enc_temp_1').value = (tempVal === '' ? '' : String(tempVal));
  const conf = reg('enc_conf_1'); const nc = reg('enc_nc_1');
  ctx.checkTempEnceinte('1', seuil);
  return { ok: conf.className.indexOf('ok') > -1, bad: conf.className.indexOf('bad') > -1, pending: conf.className.indexOf('pending') > -1 };
}
ok(enceinte(4, 3).ok, 'enceinte: seuil 4, 3 -> OK');
ok(enceinte(4, 4).ok, 'enceinte: seuil 4, 4 (boundary) -> OK');
ok(enceinte(4, 5).bad, 'enceinte: seuil 4, 5 -> NC');
ok(enceinte(-18, -18).ok, 'enceinte: seuil -18, -18 -> OK');
ok(enceinte(-18, -10).bad, 'enceinte: seuil -18, -10 -> NC');
ok(enceinte(4, '').pending, 'enceinte: empty -> pending');
{ // aberrant guard: no OK/NC verdict
  const r1 = enceinte(4, 250); ok(!r1.ok && !r1.bad, 'enceinte: +250 aberrant -> no verdict');
  const r2 = enceinte(4, -99); ok(!r2.ok && !r2.bad, 'enceinte: -99 aberrant -> no verdict');
}

// ═══════════ COOKING (core temp): checkCuissonConf non-bp ═══════════
function cuisson(sect, typeVal, tempVal) {
  clearReg(); ctx.SECTEUR_ACTIF = sect;
  reg('plat_type_1').value = String(typeVal);
  reg('plat_temp_1').value = (tempVal === '' ? '' : String(tempVal));
  const conf = reg('plat_conf_1'); reg('plat_nc_1');
  ctx.checkCuissonConf('1');
  return { ok: conf.className.indexOf('ok') > -1, bad: conf.className.indexOf('bad') > -1, pending: conf.className.indexOf('pending') > -1, txt: conf.textContent };
}
ok(cuisson('resto', 74, 75).ok, 'cuisson resto: 74 min, 75 -> OK');
ok(cuisson('resto', 74, 74).ok, 'cuisson resto: 74 min, 74 (boundary) -> OK');
ok(cuisson('resto', 74, 73).bad, 'cuisson resto: 74 min, 73 -> NC (undercooked)');
ok(cuisson('rapide', 63, 63).ok, 'cuisson rapide: 63 min, 63 -> OK');
ok(cuisson('rapide', 63, 62.9).bad, 'cuisson rapide: 63 min, 62.9 -> NC');
ok(cuisson('resto', 70, '').pending, 'cuisson: empty temp -> pending');
ok(cuisson('resto', 'custom', 80).pending, 'cuisson: custom type -> pending');

// ═══════════ COOKING BP (four range) ═══════════
{
  const t0 = ctx.TYPES_CUISSON_BP[0]; // seuil 220 max 250
  ok(cuisson('bp', t0.seuil, t0.seuil + 5).ok, 'cuisson bp: in range -> OK');
  ok(cuisson('bp', t0.seuil, t0.seuil - 5).bad, 'cuisson bp: below min -> NC');
  ok(cuisson('bp', t0.seuil, t0.seuilMax + 5).bad, 'cuisson bp: above max -> NC');
}

// ═══════════ REMISE EN TEMPÉRATURE: checkRemise ═══════════
function remise(tf) {
  clearReg();
  reg('remise_tf_1').value = (tf === '' ? '' : String(tf));
  const conf = reg('remise_conf_1'); reg('remise_nc_1');
  ctx.checkRemise('1');
  return { ok: conf.className.indexOf('ok') > -1, bad: conf.className.indexOf('bad') > -1, pending: conf.className.indexOf('pending') > -1 };
}
ok(remise(63).ok, 'remise: 63 -> OK');
ok(remise(70).ok, 'remise: 70 -> OK');
ok(remise(62.9).bad, 'remise: 62.9 -> NC');
ok(remise('').pending, 'remise: empty -> pending');

// ═══════════ PRODUCT RISK: estProduitARisque ═══════════
[['Steak haché', true], ['STEAK HACHÉ', true], ['saumon fumé', true], ['Tartare de bœuf', true],
 ['Huîtres n°3', true], ["blanc d'oeuf", true], ['salade verte', false], ['pain de campagne', false],
 ['carotte râpée', false], ['eau plate', false], ['poulet rôti', false], ['gambas crues', true]].forEach(function (p) {
  ok(ctx.estProduitARisque(p[0]) === p[1], 'risque: ' + JSON.stringify(p[0]) + ' -> ' + p[1]);
});

// ═══════════ PHOTOS: nettoyerNomFichier ═══════════
ok(ctx.nettoyerNomFichier("Chez L'Ami") === 'Chez_L_Ami', 'sanitize: apostrophe/space');
ok(ctx.nettoyerNomFichier('Café Élan') === 'Cafe_Elan', 'sanitize: accents removed');
ok(!/[\/.]/.test(ctx.nettoyerNomFichier('../../etc/passwd')), 'sanitize: no path traversal chars');
ok(ctx.nettoyerNomFichier('') === 'x', 'sanitize: empty -> x');
ok(/^[a-zA-Z0-9_-]+$/.test(ctx.nettoyerNomFichier('🍔 Burger! @#')), 'sanitize: only safe charset');
ok(ctx.nettoyerNomFichier('a___b') === 'a_b', 'sanitize: collapse underscores');

// ═══════════ PHOTOS: construireNomFichierPhoto ═══════════
ctx.ETAB_ID = 'etab-uuid-123';
{
  const n1 = ctx.construireNomFichierPhoto({ source: 'etiquette_reception', controleId: '2', base64: 'data:image/png;base64,AAAA' });
  ok(n1.indexOf('etab-uuid-123') === 0, 'photo name: starts with client id (isolation)');
  ok(/_p2_/.test(n1), 'photo name: product marker _p2');
  ok(/\.png$/.test(n1), 'photo name: png extension detected');
  ok(!/[\/]/.test(n1), 'photo name: no slash');
  const n2 = ctx.construireNomFichierPhoto({ source: 'document', controleId: 'BL', base64: 'data:application/pdf;base64,AAAA' });
  ok(/\.pdf$/.test(n2), 'photo name: pdf extension detected');
  ok(!/_p/.test(n2), 'photo name: no product marker for non-numeric controleId');
  const a = ctx.construireNomFichierPhoto({ source: 'x', controleId: '1', base64: 'data:image/jpeg;base64,AAAA' });
  const b = ctx.construireNomFichierPhoto({ source: 'x', controleId: '1', base64: 'data:image/jpeg;base64,AAAA' });
  ok(a !== b, 'photo name: two calls unique (random suffix)');
  const n3 = ctx.construireNomFichierPhoto({ source: 'photo générale é', controleId: 'x', base64: 'data:image/jpeg;base64,AAAA' });
  ok(/^[a-zA-Z0-9_.-]+$/.test(n3), 'photo name: fully URL-safe even with accents/space in source');
}
// without ETAB_ID -> 'inconnu' prefix (never blank / never collides across clients undefined)
ctx.ETAB_ID = null;
ok(ctx.construireNomFichierPhoto({ source: 'x', controleId: '1', base64: 'data:image/jpeg;base64,AAAA' }).indexOf('inconnu') === 0, 'photo name: no ETAB_ID -> inconnu prefix');
ctx.ETAB_ID = 'etab-uuid-123';

// ═══════════ PHOTOS: base64VersBlob ═══════════
ok(ctx.base64VersBlob('data:image/jpeg;base64,' + Buffer.from('hello').toString('base64')) != null, 'blob: valid data URL -> Blob');
ok(ctx.base64VersBlob('data:image/png;base64,' + Buffer.from('x').toString('base64')).type === 'image/png', 'blob: mime type extracted');
ok(ctx.base64VersBlob('not a data url') === null, 'blob: malformed -> null (no crash)');
ok(ctx.base64VersBlob('') === null, 'blob: empty -> null');

// ═══════════ MICRO: hvVoiceSupported + hvParseNumber ═══════════
delete ctx.window.SpeechRecognition; delete ctx.window.webkitSpeechRecognition;
ok(ctx.hvVoiceSupported() === false, 'voice: unsupported when no API');
ctx.window.webkitSpeechRecognition = function () {};
ok(ctx.hvVoiceSupported() === true, 'voice: supported when API present');
[['18', 18], ['-18', -18], ['-4', -4], ['6,5', 6.5], ['3.5', 3.5], ['moins quinze', -15], ['moins dix-huit', -18],
 ['sept', 7], ['quatre-vingt-dix', 90], ['soixante-dix', 70], ['vingt-deux virgule cinq', 22.5],
 ['trois virgule cinq', 3.5], ['cent', 100], ['deux cents', 200], ['quarante-cinq', 45],
 ['moins quatre degrés', -4], ['zéro', 0], ['quatre-vingts', 80]].forEach(function (p) {
  const r = ctx.hvParseNumber(p[0]);
  ok(r !== null && approx(r, p[1]), 'voice parse: ' + JSON.stringify(p[0]) + ' -> ' + p[1] + ' (got ' + r + ')');
});
ok(ctx.hvParseNumber('bonjour') === null, 'voice parse: noise -> null (no false fill)');
ok(ctx.hvParseNumber('') === null, 'voice parse: empty -> null');
ok(ctx.hvParseNumber(null) === null, 'voice parse: null -> null');

console.log('\n══════════════════════════════════════');
console.log('ROUND 2 RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
