'use strict';
const H = require('./harness.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
function flush() { return new Promise(function (res) { let n = 0; (function t() { if (++n > 40) return res(); setImmediate(t); })(); }); }

function env(opts) {
  opts = opts || {};
  const db = H.makeDB(); const doc = H.makeDocument(); const alerts = [];
  const win = { _supabase: H.makeSupabase(db, opts.config || {}), HACCP_CONFIG: {}, emailjs: null };
  const e = {
    window: win, document: doc,
    alert: function (m) { alerts.push(String(m)); }, confirm: function () { return true; }, prompt: function () { return null; },
    lsSet: function () {}, lsGet: function () { return null; }, lsRemove: function () {},
    _scrollHaut: function () {}, showPage: function () {}, APP_BUILD: 'v171', renderEuCampagne: function () {},
    console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; }
  };
  return { db: db, doc: doc, alerts: alerts, win: win, mod: H.buildModule(e) };
}
function field(doc, id, val, checked) { const el = H.makeEl('input'); el.id = id; if (val !== undefined) el.value = val; if (checked !== undefined) el.checked = checked; doc._registry[id] = el; return el; }
function setupEssai(t, o) {
  o = o || {};
  field(t.doc, 'essai_etab', o.etab !== undefined ? o.etab : 'Cuisine Kabyle');
  field(t.doc, 'essai_resp', o.resp !== undefined ? o.resp : 'Mohand Cheurfa');
  field(t.doc, 'essai_tel', o.tel !== undefined ? o.tel : '0650028005');
  field(t.doc, 'essai_email', o.mail !== undefined ? o.mail : 'r.t.h@orange.fr');
  field(t.doc, 'essai_adresse', o.adr !== undefined ? o.adr : '12 rue des Plantes 75004 Paris');
  field(t.doc, 'essai_secteur', o.secteur !== undefined ? o.secteur : 'resto');
  field(t.doc, 'essai_duree', o.duree !== undefined ? o.duree : '10');
  field(t.doc, 'essai_client', '', o.client !== undefined ? o.client : false);
  field(t.doc, 'essai_multi', '', o.multi !== undefined ? o.multi : false);
  field(t.doc, 'btnCreerEssai', '');
  t.doc._add('adminContent');
}
function etabRow(t) { return t.db.etablissements[0]; }

(async function () {
  // ════════ genererCodeEssai ════════
  { const t = env(); ok(/^ESSAI-[A-Z2-9]{5}-\d{4}$/.test(t.mod.genererCodeEssai()), 'genererCodeEssai: format ESSAI-XXXXX-AAAA'); }

  // ════════ E1 — essai normal (secteur verrouillé) ════════
  { const t = env(); setupEssai(t); t.mod.creerEssai(); await flush();
    const r = etabRow(t);
    ok(t.db.etablissements.length === 1, 'essai: 1 établissement créé');
    ok(r && /^ESSAI-/.test(r.code_acces), 'essai: code ESSAI-');
    ok(r && r.secteur === 'resto', 'essai: secteur verrouillé sur le choix');
    ok(r && r.multi_secteur === false, 'essai: multi_secteur false (verrouillé)');
    ok(r && /^\d{6}$/.test(r.mot_de_passe), 'essai: mot de passe 6 chiffres');
    ok(r && r.actif === true, 'essai: actif');
    const dj = Math.round((new Date(r.date_expiration) - Date.now()) / 86400000);
    ok(dj >= 9 && dj <= 11, 'essai: expiration ≈ +10 jours');
    ok(t.db.historique_admin.length >= 1, 'essai: tracé dans l’historique');
    ok(t.alerts.some(function (a) { return /Essai créé/.test(a); }), 'essai: confirmation affichée');
  }

  // ════════ E2 — champ manquant ════════
  { const t = env(); setupEssai(t, { etab: '' }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 0 && t.alerts.some(function (a) { return /remplir TOUS/.test(a); }), 'essai: champ manquant -> bloqué'); }

  // ════════ E3 — pas de secteur ET pas multi -> bloqué ════════
  { const t = env(); setupEssai(t, { secteur: '', multi: false }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 0 && t.alerts.some(function (a) { return /SECTEUR/.test(a); }), 'essai: sans secteur et sans multi -> bloqué'); }

  // ════════ E4 — LE FIX : pas de secteur MAIS « accès à tous les secteurs » coché ════════
  { const t = env(); setupEssai(t, { secteur: '', multi: true }); t.mod.creerEssai(); await flush();
    const r = etabRow(t);
    ok(t.db.etablissements.length === 1, 'essai multi: création SANS secteur autorisée quand « tous les secteurs » coché');
    ok(r && r.multi_secteur === true, 'essai multi: multi_secteur = true (accès à tous)');
    ok(r && r.secteur === 'resto', 'essai multi: secteur par défaut "resto" (sans incidence car multi)'); }

  // ════════ E5 — secteur choisi + multi coché ════════
  { const t = env(); setupEssai(t, { secteur: 'bp', multi: true }); t.mod.creerEssai(); await flush();
    const r = etabRow(t);
    ok(r && r.secteur === 'bp' && r.multi_secteur === true, 'essai multi: secteur choisi conservé + accès à tous'); }

  // ════════ E6 — compte CLIENT payant (1 an) ════════
  { const t = env(); setupEssai(t, { client: true }); t.mod.creerEssai(); await flush();
    const r = etabRow(t);
    ok(r && /^CLIENT-/.test(r.code_acces), 'client payant: code CLIENT-');
    const an = new Date(r.date_expiration).getFullYear();
    ok(an === new Date().getFullYear() + 1, 'client payant: expiration ≈ +1 an'); }

  // ════════ E7 — durée hors plage (essai) ════════
  { const t = env(); setupEssai(t, { duree: '20' }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 0 && t.alerts.some(function (a) { return /durée/i.test(a); }), 'essai: durée 20 j -> bloqué (1–15)'); }
  { const t = env(); setupEssai(t, { duree: '0' }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 0, 'essai: durée 0 -> bloqué'); }

  // ════════ E8 — bornes de durée valides ════════
  { const t = env(); setupEssai(t, { duree: '1' }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 1, 'essai: durée 1 jour -> OK'); }
  { const t = env(); setupEssai(t, { duree: '15' }); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 1, 'essai: durée 15 jours -> OK'); }

  // ════════ E9 — schéma sans colonnes contact -> repli (jamais d'échec) ════════
  { const t = env({ config: { rejectEtabContactCols: true } }); setupEssai(t); t.mod.creerEssai(); await flush();
    ok(t.db.etablissements.length === 1, 'essai: repli si colonnes contact absentes (création maintenue)');
    ok(!('responsable' in t.db.etablissements[0]), 'essai: repli -> insert sans colonnes contact'); }

  console.log('\n══════════════════════════════════════');
  console.log('ROUND 24 (panneau admin — création essai/client) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
