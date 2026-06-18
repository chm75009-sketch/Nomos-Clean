'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const PAGE = 'page-temperatures';
const KEY = 'haccp_module_data_' + PAGE + '_etabA';

function tsLocal(s) { return new Date(s).toISOString(); }            // 's' interprété en heure LOCALE
function E(localDT, secteur, uid, sig) {
  return { pageId: PAGE, timestamp: tsLocal(localDT), data: { pageId: PAGE, timestamp: tsLocal(localDT), secteur: secteur, uid: uid, signataire: sig || 'Agent' } };
}
function setup(opts) {
  opts = opts || {};
  ctx.localStorage.clear();
  ctx.ETAB_ID = 'etabA';
  ctx.SECTEUR_ACTIF = (opts.secteur !== undefined) ? opts.secteur : 'resto';
  ctx.window._cloudCache = opts.cloud ? (function () { const o = {}; o[PAGE] = opts.cloud; return o; })() : {};
  ctx.localStorage.setItem(KEY, JSON.stringify(opts.local || []));
}
function periode(from, to) { return ctx.getDonneesPeriode(PAGE, from, to); }

// ════════════════ A) BORNES DE DATE (heure locale, inclusives) ════════════════
const J = ['2026-06-15', '2026-06-15']; // période d'une journée
setup({ local: [E('2026-06-15T00:00:00', 'resto', 'a')] });
ok(periode.apply(null, J).length === 1, 'bornes: contrôle à 00:00:00 du jour -> INCLUS');
setup({ local: [E('2026-06-15T23:59:59', 'resto', 'a')] });
ok(periode.apply(null, J).length === 1, 'bornes: contrôle à 23:59:59 du jour -> INCLUS');
setup({ local: [E('2026-06-15T12:30:00', 'resto', 'a')] });
ok(periode.apply(null, J).length === 1, 'bornes: contrôle en milieu de journée -> INCLUS');
setup({ local: [E('2026-06-14T23:59:59', 'resto', 'a')] });
ok(periode.apply(null, J).length === 0, 'bornes: veille à 23:59:59 -> EXCLU');
setup({ local: [E('2026-06-16T00:00:00', 'resto', 'a')] });
ok(periode.apply(null, J).length === 0, 'bornes: lendemain à 00:00:00 -> EXCLU');

// Plage de plusieurs jours
setup({ local: [E('2026-06-01T08:00:00', 'resto', 'a'), E('2026-06-15T08:00:00', 'resto', 'b'), E('2026-06-30T20:00:00', 'resto', 'c'), E('2026-07-01T08:00:00', 'resto', 'd'), E('2026-05-31T23:00:00', 'resto', 'e')] });
ok(periode('2026-06-01', '2026-06-30').length === 3, 'plage mois: 3 contrôles dans juin (bornes incluses), hors-mois exclus');

// ════════════════ B) ISOLATION SECTEUR ════════════════
setup({ secteur: 'resto', local: [E('2026-06-15T10:00:00', 'bp', 'a')] });
ok(periode.apply(null, J).length === 0, 'secteur: actif=resto, contrôle bp -> EXCLU');
setup({ secteur: 'resto', local: [E('2026-06-15T10:00:00', 'resto', 'a')] });
ok(periode.apply(null, J).length === 1, 'secteur: actif=resto, contrôle resto -> INCLUS');
setup({ secteur: 'resto', local: [E('2026-06-15T10:00:00', undefined, 'a')] });
ok(periode.apply(null, J).length === 1, 'secteur: contrôle ancien sans secteur -> CONSERVÉ (jamais masqué)');
setup({ secteur: '', local: [E('2026-06-15T10:00:00', 'bp', 'a'), E('2026-06-15T10:00:00', 'resto', 'b')] });
ok(periode.apply(null, J).length === 2, 'secteur: aucun secteur actif -> aucun filtrage');

// ════════════════ C) FUSION CLOUD ↔ LOCAL — sans perte, sans doublon ════════════════
{
  const C1 = E('2026-06-15T09:00:00', 'resto', 'u1');
  const C2 = E('2026-06-15T10:00:00', 'resto', 'u2');
  const L2dup = E('2026-06-15T09:00:00', 'resto', 'u1'); // même signature que C1
  const L1extra = E('2026-06-15T11:00:00', 'resto', 'u3'); // absent du cloud
  setup({ cloud: [C1, C2], local: [L2dup, L1extra] });
  const r = periode.apply(null, J);
  const uids = r.map(function (e) { return e.data.uid; }).sort();
  ok(r.length === 3, 'fusion: cloud(2) + extra local(1) = 3 (doublon u1 fusionné)');
  ok(JSON.stringify(uids) === JSON.stringify(['u1', 'u2', 'u3']), 'fusion: u1,u2,u3 chacun une seule fois (pas de doublon, pas de perte)');
}
{
  // Un contrôle local NON présent au cloud et plus ANCIEN que le cloud reste visible
  const Ccloud = E('2026-06-20T09:00:00', 'resto', 'cloud1');
  const Lold = E('2026-06-05T09:00:00', 'resto', 'localOld'); // plus ancien, absent du cloud
  setup({ cloud: [Ccloud], local: [Lold] });
  const r = periode('2026-06-01', '2026-06-30');
  ok(r.length === 2 && r.some(function (e) { return e.data.uid === 'localOld'; }), 'fusion: contrôle local ancien absent du cloud -> JAMAIS perdu du rapport');
}

// ════════════════ D) ROBUSTESSE (jamais de plantage) ════════════════
setup({ local: [] });
ok(Array.isArray(periode.apply(null, J)) && periode.apply(null, J).length === 0, 'robustesse: aucune donnée -> [] (pas de plantage)');
{
  let threw = false, res = null;
  try { res = periode('pas-une-date', 'non-plus'); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(res), 'robustesse: dates invalides -> tableau (pas de plantage)');
}
{
  // localStorage corrompu -> [] sans planter
  ctx.localStorage.setItem(KEY, '{ pas du json valide');
  let threw = false, res = null;
  try { res = periode.apply(null, J); } catch (e) { threw = true; }
  ok(!threw && Array.isArray(res), 'robustesse: stockage corrompu -> [] (pas de plantage)');
}

// ════════════════ E) FILTRE HISTORIQUE (semaine / mois) — logique de date ════════════════
// Reproduit fidèlement la logique inline de chargerHistorique (today/week/month)
function histMatch(filter, dateStr, now) {
  if (filter === 'all') return true;
  const d = new Date(dateStr);
  if (filter === 'today') return dateStr === now.toISOString().split('T')[0];
  if (filter === 'week') { const wk = new Date(now); wk.setDate(wk.getDate() - 7); return d >= wk; }
  if (filter === 'month') { const mo = new Date(now); mo.setMonth(mo.getMonth() - 1); return d >= mo; }
  return true;
}
const NOW = new Date('2026-06-15T12:00:00Z');
ok(histMatch('today', '2026-06-15', NOW) === true, 'hist: today = aujourd\'hui inclus');
ok(histMatch('today', '2026-06-14', NOW) === false, 'hist: today exclut la veille');
ok(histMatch('week', '2026-06-09', NOW) === true, 'hist: week inclut J-6');
ok(histMatch('week', '2026-06-07', NOW) === false, 'hist: week exclut J-8');
ok(histMatch('month', '2026-05-16', NOW) === true, 'hist: month inclut ~J-30');
ok(histMatch('month', '2026-05-14', NOW) === false, 'hist: month exclut > 1 mois');
ok(histMatch('all', '2020-01-01', NOW) === true, 'hist: all inclut tout');

console.log('\n══════════════════════════════════════');
console.log('ROUND 7 (Pack DDPP / rapports par période) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
