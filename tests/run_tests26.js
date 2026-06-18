'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness.js');
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
function flush() { return new Promise(function (res) { let n = 0; (function t() { if (++n > 50) return res(); setImmediate(t); })(); }); }

// ════════════ A) VALIDATION DEMANDE — flux complet, les 5 secteurs ════════════
function adminEnv(demande) {
  const db = H.makeDB(); db.demandes_inscription.push(demande);
  const doc = H.makeDocument(); const alerts = [];
  const win = { _supabase: H.makeSupabase(db, {}), HACCP_CONFIG: { EMAILJS_PUBLIC_KEY: '', EMAILJS_TEMPLATE_CLIENT: '' }, emailjs: null };
  const e = {
    window: win, document: doc, alert: function (m) { alerts.push(String(m)); }, confirm: function () { return true; }, prompt: function () { return null; },
    lsSet: function () {}, lsGet: function () { return null; }, lsRemove: function () {}, _scrollHaut: function () {}, showPage: function () {},
    APP_BUILD: 'v194', renderEuCampagne: function () {}, console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (_) {} return 0; }
  };
  doc._registry['adminContent'] = H.makeEl('div'); doc._registry['cntDemandes'] = H.makeEl('div');
  return { db: db, mod: H.buildModule(e), alerts: alerts };
}
const SECT = [['resto_trad', 'resto'], ['boulangerie', 'bp'], ['fast_food', 'rapide'], ['boucherie', 'boucherie'], ['collective', 'collective']];
for (const [src, interne] of SECT) {
  (async function () {
    const t = adminEnv({ id: 'd1', etablissement: 'Etab ' + src, responsable: 'Bob', email: 'b@b.fr', telephone: '06', secteur: src, formule: 'Std', engagement: 'Annuel', adresse: '1 rue', siret: '123', statut: 'en_attente', date_demande: '2026-06-01' });
    t.mod.validerDemande('d1'); await flush();
    ok(t.db.comptes_clients.length === 1, 'valider ' + src + ': compte client créé');
    ok(t.db.etablissements.length === 1, 'valider ' + src + ': établissement (accès) créé');
    ok(t.db.etablissements[0] && t.db.etablissements[0].secteur === interne, 'valider ' + src + ' -> secteur interne "' + interne + '"');
    ok(t.db.etablissements[0] && t.db.etablissements[0].responsable === 'Bob' && t.db.etablissements[0].telephone === '06' && t.db.etablissements[0].email === 'b@b.fr', 'valider ' + src + ': coordonnées d\'inscription (responsable/tél/email) reprises dans l\'établissement');
    ok(t.db.etablissements[0] && /^HACCP-[A-Z2-9]{5}-\d{4}$/.test(t.db.etablissements[0].code_acces), 'valider ' + src + ': code HACCP- valide');
    ok(t.db.etablissements[0] && t.db.comptes_clients[0] && t.db.etablissements[0].code_acces === t.db.comptes_clients[0].code_acces, 'valider ' + src + ': même code dans les 2 tables');
    ok(t.db.demandes_inscription[0].statut === 'validee' && t.db.demandes_inscription[0].code_genere, 'valider ' + src + ': demande passée à validée + code');
    ok(t.db.historique_admin.some(function (x) { return /Validation demande/.test(x.action); }), 'valider ' + src + ': tracé historique');
  })();
}

// ════════════ B) GARDE STATIQUE — secteurs du formulaire == clés du mapping ════════════
setTimeout(function () {
  const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  // valeurs du select insc_secteur
  const seg = HTML.slice(HTML.indexOf('id="insc_secteur"'), HTML.indexOf('id="insc_secteur"') + 1200);
  const formVals = (seg.match(/value="([a-z_]+)"/g) || []).map(function (s) { return s.replace(/value="|"/g, ''); }).filter(Boolean);
  // clés du secteurMap
  const mapSeg = SRC.slice(SRC.indexOf('var secteurMap = {'), SRC.indexOf('var secteurMap = {') + 250);
  const mapKeys = (mapSeg.match(/'([a-z_]+)':/g) || []).map(function (s) { return s.replace(/'|:/g, ''); });
  formVals.forEach(function (v) {
    ok(mapKeys.indexOf(v) > -1, 'cohérence: secteur formulaire "' + v + '" présent dans le mapping de validation');
  });
  ok(mapKeys.length === 5 && formVals.length === 5, 'cohérence: 5 secteurs des deux côtés (' + formVals.length + '/' + mapKeys.length + ')');

  // ════════════ C) CAMPAGNE ESSAI — config plafond / activation (via app complète) ════════════
  (async function () {
    const ctx = loadApp();
    if (ctx._loadErrors.length) { ok(false, 'campagne: app chargée'); finish(); return; }
    const db = H.makeDB();
    ctx.window._supabase = H.makeSupabase(db, {});
    // défaut : pas de config -> active, max 500
    let cfg = await ctx.getEssaiConfig();
    ok(cfg.active === true && cfg.max === 500, 'campagne: config par défaut (active, plafond 500)');
    // setEssaiConfig écrit, getEssaiConfig relit
    await ctx.setEssaiConfig(false, 120);
    cfg = await ctx.getEssaiConfig();
    ok(cfg.active === false && cfg.max === 120, 'campagne: config enregistrée puis relue (suspendue, 120)');
    // euCampagne('reactiver') — on vérifie la DERNIÈRE config écrite (le faux Supabase ne trie pas)
    function lastCfg() { var rows = db.historique_admin.filter(function (r) { return r.action === 'CONFIG_ESSAI'; }); var l = rows[rows.length - 1]; try { return l ? JSON.parse(l.motif) : null; } catch (e) { return null; } }
    const alerts = []; ctx.alert = function (m) { alerts.push(String(m)); };
    ctx.confirm = function () { return true; };
    await ctx.window.euCampagne('reactiver'); await flush();
    ok(lastCfg() && lastCfg().active === true, 'campagne: réactivation de l\'offre');
    // euCampagne('suspendre')
    await ctx.window.euCampagne('suspendre'); await flush();
    ok(lastCfg() && lastCfg().active === false, 'campagne: suspension de l\'offre');
    // euCampagne('plafond') valide
    ctx.prompt = function () { return '250'; };
    await ctx.window.euCampagne('plafond'); await flush();
    ok(lastCfg() && lastCfg().max === 250, 'campagne: plafond modifié à 250');
    // euCampagne('plafond') invalide -> aucun nouvel enregistrement + alerte
    const avant = db.historique_admin.filter(function (r) { return r.action === 'CONFIG_ESSAI'; }).length;
    alerts.length = 0;
    ctx.prompt = function () { return 'abc'; };
    await ctx.window.euCampagne('plafond'); await flush();
    const apres = db.historique_admin.filter(function (r) { return r.action === 'CONFIG_ESSAI'; }).length;
    ok(apres === avant && alerts.some(function (a) { return /invalide/i.test(a); }), 'campagne: plafond invalide -> refusé, rien d\'enregistré');

    finish();
  })();
}, 60);

function finish() {
  console.log('\n══════════════════════════════════════');
  console.log('ROUND 26 (admin — validation demande + campagne essais) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
}
