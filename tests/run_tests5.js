'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
function flush() { return new Promise(function (res) { let n = 0; (function t() { if (++n > 60) return res(); setImmediate(t); })(); }); }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const realEnregistrer = ctx.enregistrerControleHACCP; // capturé avant les stubs

(async function main() {
// ════════════════════════════════════════════════════════════════════════
//  A) ÉVICTION 200 — ne JAMAIS supprimer un contrôle non synchronisé
//     (on extrait et exécute le VRAI bloc d'éviction de sauvegarderDonnesModule)
// ════════════════════════════════════════════════════════════════════════
const EV_START = SRC.indexOf('if (stored.length > 200) {');
const EV_END = SRC.indexOf('lsSet(key, JSON.stringify(stored));');
ok(EV_START > -1 && EV_END > EV_START, 'éviction: bloc localisé dans le code source');
const evBlock = SRC.slice(EV_START, EV_END);
// garde-fou statique : le bloc préserve bien les non-synchronisés
ok(/_nonSync/.test(evBlock) && /!e\.cloudOk/.test(evBlock), 'éviction: le code filtre explicitement les non-synchronisés');
const evict = new Function('stored', evBlock + '\n return stored;');

function entry(i, cloudOk, tsMs) { return { pageId: 'page-x', timestamp: new Date(tsMs).toISOString(), cloudOk: cloudOk, data: { uid: 'u' + i } }; }
{
  // 5 non-synchronisés (les plus récents) + 200 synchronisés (plus anciens)
  const arr = [];
  for (let i = 0; i < 5; i++) arr.push(entry('N' + i, false, Date.now() - i * 1000));           // récents, non sync
  for (let i = 0; i < 200; i++) arr.push(entry('S' + i, true, Date.now() - (100000 + i * 1000))); // anciens, sync
  const out = evict(arr.slice());
  ok(out.length === 200, 'éviction: ramené à 200');
  const nonSyncSurvivants = out.filter(function (e) { return !e.cloudOk; }).length;
  ok(nonSyncSurvivants === 5, 'éviction: les 5 non-synchronisés sont TOUS conservés');
}
{
  // 250 non-synchronisés : on garde les 200 plus récents (impossible de garder plus)
  const arr = [];
  for (let i = 0; i < 250; i++) arr.push(entry('N' + i, false, Date.now() - i * 1000));
  const out = evict(arr.slice());
  ok(out.length === 200 && out.every(function (e) { return !e.cloudOk; }), 'éviction: 250 non-sync -> garde 200 (aucun synchro à sacrifier)');
}
{
  // < 200 : rien n'est touché
  const arr = []; for (let i = 0; i < 50; i++) arr.push(entry(i, i % 2 === 0, Date.now() - i * 1000));
  const out = evict(arr.slice());
  ok(out.length === 50, 'éviction: < 200 -> inchangé');
}

// ════════════════════════════════════════════════════════════════════════
//  B) _compterNonSync — comptage exact des contrôles pas encore au cloud
// ════════════════════════════════════════════════════════════════════════
function seedLS(etab, module, entries) {
  ctx.localStorage.setItem('haccp_module_data_page-' + module + '_' + etab, JSON.stringify(entries));
}
{
  ctx.localStorage.clear(); ctx.ETAB_ID = 'etabA';
  seedLS('etabA', 'temperatures', [{ cloudOk: false, data: {} }, { cloudOk: true, data: {} }, { cloudOk: false, data: {} }]);
  seedLS('etabA', 'reception', [{ cloudOk: true, data: {} }]);
  seedLS('etabB', 'temperatures', [{ cloudOk: false, data: {} }]); // autre client -> ignoré
  ok(ctx._compterNonSync() === 2, '_compterNonSync: 2 non-sync du bon client (ignore les autres)');
  ctx.localStorage.clear();
  ok(ctx._compterNonSync() === 0, '_compterNonSync: rien -> 0');
}

// ════════════════════════════════════════════════════════════════════════
//  C) RÉCONCILIATION — renvoyer les contrôles manquants, sans doublon, sans perte
// ════════════════════════════════════════════════════════════════════════
function freshSync() { ctx._reconcileEnCours = false; ctx.window._lastSyncError = ''; ctx.window._syncErrorShown = false; ctx.localStorage.clear(); }
function getEntry(etab, module) { return JSON.parse(ctx.localStorage.getItem('haccp_module_data_page-' + module + '_' + etab))[0]; }

// C1 — un contrôle non synchronisé (vieux de 60s) est poussé puis marqué cloudOk
{
  freshSync(); ctx.ETAB_ID = 'etabA';
  const ts = new Date(Date.now() - 60000).toISOString();
  seedLS('etabA', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1', module: 'temperatures' } }]);
  const calls = [];
  ctx.chargerControlesCloudCache = async function () { return []; };
  ctx.window._histoCloudRows = {};
  ctx.enregistrerControleHACCP = async function (mod, data) { calls.push({ mod: mod, uid: data && data.uid }); return { ok: true }; };
  await ctx.synchroniserControlesManquants(); await flush();
  ok(calls.length === 1 && calls[0].uid === 'u1', 'réconcil C1: contrôle non-sync poussé une fois');
  ok(getEntry('etabA', 'temperatures').cloudOk === true, 'réconcil C1: marqué cloudOk après succès');
}
// C2 — déjà présent au cloud (même signature) -> marqué cloudOk SANS re-push
{
  freshSync(); ctx.ETAB_ID = 'etabA';
  const ts = '2026-06-01T10:00:00.000Z';
  seedLS('etabA', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1', module: 'temperatures' } }]);
  const calls = [];
  ctx.chargerControlesCloudCache = async function () { return [{}]; };
  ctx.window._histoCloudRows = { r1: { module: 'temperatures', contenu: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1' } } };
  ctx.enregistrerControleHACCP = async function () { calls.push(1); return { ok: true }; };
  await ctx.synchroniserControlesManquants(true); await flush();
  ok(calls.length === 0, 'réconcil C2: présent au cloud -> AUCUN re-push (pas de doublon)');
  ok(getEntry('etabA', 'temperatures').cloudOk === true, 'réconcil C2: marqué cloudOk');
}
// C3 — cloud illisible (null) -> on n'envoie RIEN (anti-doublons massifs)
{
  freshSync(); ctx.ETAB_ID = 'etabA';
  const ts = new Date(Date.now() - 60000).toISOString();
  seedLS('etabA', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1', module: 'temperatures' } }]);
  const calls = [];
  ctx.chargerControlesCloudCache = async function () { return null; };
  ctx.window._histoCloudRows = {};
  ctx.enregistrerControleHACCP = async function () { calls.push(1); return { ok: true }; };
  await ctx.synchroniserControlesManquants(true); await flush();
  ok(calls.length === 0, 'réconcil C3: cloud illisible -> aucun envoi');
  ok(getEntry('etabA', 'temperatures').cloudOk === false, 'réconcil C3: reste non-sync (réessai plus tard)');
}
// C4 — contrôle TRÈS récent (<30s) laissé à l'espion 3s (pas de double course) en mode non forcé
{
  freshSync(); ctx.ETAB_ID = 'etabA';
  const ts = new Date(Date.now() - 5000).toISOString();
  seedLS('etabA', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1', module: 'temperatures' } }]);
  const calls = [];
  ctx.chargerControlesCloudCache = async function () { return []; };
  ctx.window._histoCloudRows = {};
  ctx.enregistrerControleHACCP = async function () { calls.push(1); return { ok: true }; };
  await ctx.synchroniserControlesManquants(); await flush();
  ok(calls.length === 0, 'réconcil C4: contrôle <30s non re-poussé (anti double-course)');
  ok(getEntry('etabA', 'temperatures').cloudOk === false, 'réconcil C4: reste à traiter');
}
// C5 — échec d'envoi -> reste non-sync (sera réessayé)
{
  freshSync(); ctx.ETAB_ID = 'etabA';
  const ts = new Date(Date.now() - 60000).toISOString();
  seedLS('etabA', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1', module: 'temperatures' } }]);
  ctx.chargerControlesCloudCache = async function () { return []; };
  ctx.window._histoCloudRows = {};
  ctx.enregistrerControleHACCP = async function () { return { ok: false, msg: 'réseau' }; };
  await ctx.synchroniserControlesManquants(true); await flush();
  ok(getEntry('etabA', 'temperatures').cloudOk === false, 'réconcil C5: échec envoi -> reste non-sync (jamais perdu)');
}
// C6 — mode test 'local-test' : jamais d'envoi cloud
{
  freshSync(); ctx.ETAB_ID = 'local-test';
  const ts = new Date(Date.now() - 60000).toISOString();
  seedLS('local-test', 'temperatures', [{ pageId: 'page-temperatures', timestamp: ts, cloudOk: false, data: { pageId: 'page-temperatures', timestamp: ts, uid: 'u1' } }]);
  const calls = [];
  ctx.enregistrerControleHACCP = async function () { calls.push(1); return { ok: true }; };
  await ctx.synchroniserControlesManquants(true); await flush();
  ok(calls.length === 0, 'réconcil C6: compte de test -> aucun envoi cloud (pas de pollution)');
}

// ════════════════════════════════════════════════════════════════════════
//  D) enregistrerControleHACCP — cloisonnement + garde mode local/test
// ════════════════════════════════════════════════════════════════════════
{
  ctx.ETAB_ID = null;
  const r = await realEnregistrer('temperatures', { uid: 'x' });
  ok(r && r.ok === false, 'enregistrer: pas connecté -> {ok:false} (jamais d\'envoi anonyme)');
  ctx.ETAB_ID = 'local-test';
  const r2 = await realEnregistrer('temperatures', { uid: 'x' });
  ok(r2 && r2.ok === false, 'enregistrer: mode test -> {ok:false} (pas de cloud)');
}

console.log('\n══════════════════════════════════════');
console.log('ROUND 5 (hors-ligne / anti-perte) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
