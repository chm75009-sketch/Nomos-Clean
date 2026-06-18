'use strict';
const { loadApp, makeEl } = require('./load_app.js');
const H = require('./harness.js'); // makeSupabase + makeDB (faux Supabase)
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;

(async function main() {
  // ════════════ A) _nrmNC — normalisation des libellés NC ════════════
  const N = ctx._nrmNC;
  ok(N('Réfrigérateur (≤+4°C)') === 'refrigerateur', 'nrmNC: accents + parenthèse + °C retirés');
  ok(N("Port d'une bague") === 'port d une bague', 'nrmNC: apostrophe -> espace');
  ok(N('  Multiple   Espaces  ') === 'multiple espaces', 'nrmNC: espaces multiples compactés + minuscules');
  ok(N('Tenue sale / tachée !!!') === 'tenue sale tachee', 'nrmNC: ponctuation retirée');
  ok(N('') === '' && N(null) === '', 'nrmNC: vide/null -> ""');

  // ════════════ B) getCatalogueNC — catégorisation des non-conformités ════════════
  const G = ctx.getCatalogueNC;
  {
    const d = G('Absence de bagues et bracelets');
    ok(d && Array.isArray(d.ncs) && d.ncs.some(function (x) { return /bague/i.test(x); }), 'catalogueNC: "bagues/bracelets" -> bonne fiche (cause bague)');
    ok(d && Array.isArray(d.actions) && d.actions.length > 0, 'catalogueNC: fiche fournit des actions correctives');
  }
  ok(G('Coiffe / charlotte (cheveux entièrement couverts)') !== null, 'catalogueNC: "charlotte" reconnu');
  ok(G('absence de bagues') !== null, 'catalogueNC: correspondance partielle (fuzzy)');
  ok(G('xyz totalement inexistant abracadabra') === null, 'catalogueNC: label inconnu -> null');
  ok(G('') === null, 'catalogueNC: vide -> null');

  // ════════════ C) ESSAI GRATUIT — validerEssaiUniversel (règles commerciales) ════════════
  function setupTrial(over) {
    over = over || {};
    const db = H.makeDB();
    (over.eu || []).forEach(function (r) { db.etablissements.push(r); });
    (over.cfg || []).forEach(function (r) { db.historique_admin.push(r); });
    ctx.window._supabase = H.makeSupabase(db, {});
    // formulaire
    for (const k of Object.keys(doc._registry)) delete doc._registry[k];
    function f(id, v) { const e = makeEl('input'); e.id = id; e.value = v; doc._registry[id] = e; }
    f('eu_etab', over.etab !== undefined ? over.etab : 'Mon Resto');
    f('eu_resp', 'Jean Chef'); f('eu_adresse', '1 rue X'); f('eu_tel', '0600000000');
    f('eu_email', over.email !== undefined ? over.email : 'jean@resto.fr');
    f('eu_secteur', over.secteur !== undefined ? over.secteur : 'resto');
    f('eu_err', ''); f('eu_btn', ''); f('login_code', ''); f('login_pwd', '');
    ctx.connexion = function () {}; // neutralise la connexion auto
    return db;
  }
  const alerts = []; ctx.alert = function (m) { alerts.push(String(m)); };

  // C1 — happy path
  {
    const db = setupTrial({});
    alerts.length = 0;
    await ctx.window.validerEssaiUniversel();
    const row = db.etablissements.find(function (r) { return /^EU3J-/.test(r.code_acces); });
    ok(!!row, 'essai: compte EU3J- créé');
    ok(row && /^EU3J-[A-Z2-9]{5}-\d{4}$/.test(row.code_acces), 'essai: format de code EU3J-XXXXX-AAAA');
    ok(row && /^\d{6}$/.test(row.mot_de_passe), 'essai: mot de passe 6 chiffres');
    ok(row && row.secteur === 'resto', 'essai: secteur verrouillé (non multi)');
    ok(row && (row.adresse || '').indexOf('jean@resto.fr') > -1, 'essai: e-mail tracé dans l\'adresse (anti-doublon)');
    const exp = row && new Date(row.date_expiration); const expect = new Date(Date.now() + 3 * 86400000);
    ok(exp && Math.abs(exp - expect) < 2 * 86400000, 'essai: expiration ≈ +3 jours');
    ok(alerts.some(function (a) { return /Essai activé/.test(a); }), 'essai: confirmation affichée');
  }
  // C2 — champ manquant
  {
    const db = setupTrial({ etab: '' });
    await ctx.window.validerEssaiUniversel();
    ok(db.etablissements.filter(function (r) { return /^EU3J-/.test(r.code_acces); }).length === 0, 'essai: champ manquant -> aucune création');
  }
  // C3 — e-mail invalide
  {
    const db = setupTrial({ email: 'pasunemail' });
    await ctx.window.validerEssaiUniversel();
    ok(db.etablissements.filter(function (r) { return /^EU3J-/.test(r.code_acces); }).length === 0, 'essai: e-mail invalide -> bloqué');
  }
  // C4 — campagne fermée (admin)
  {
    const db = setupTrial({ cfg: [{ action: 'CONFIG_ESSAI', motif: JSON.stringify({ active: false, max: 500 }), date_action: '2026-01-01' }] });
    await ctx.window.validerEssaiUniversel();
    ok(db.etablissements.filter(function (r) { return /^EU3J-/.test(r.code_acces); }).length === 0, 'essai: campagne fermée -> bloqué');
  }
  // C5 — plafond atteint
  {
    const db = setupTrial({
      cfg: [{ action: 'CONFIG_ESSAI', motif: JSON.stringify({ active: true, max: 2 }), date_action: '2026-01-01' }],
      eu: [{ code_acces: 'EU3J-AAAAA-2026', adresse: 'x | a@a.fr' }, { code_acces: 'EU3J-BBBBB-2026', adresse: 'y | b@b.fr' }]
    });
    await ctx.window.validerEssaiUniversel();
    ok(db.etablissements.filter(function (r) { return /^EU3J-/.test(r.code_acces); }).length === 2, 'essai: plafond atteint (2/2) -> aucune nouvelle activation');
  }
  // C6 — 1 essai par e-mail
  {
    const db = setupTrial({ email: 'jean@resto.fr', eu: [{ code_acces: 'EU3J-ZZZZZ-2026', adresse: 'déjà | jean@resto.fr | ...' }] });
    await ctx.window.validerEssaiUniversel();
    ok(db.etablissements.filter(function (r) { return /^EU3J-/.test(r.code_acces); }).length === 1, 'essai: e-mail déjà utilisé -> pas de 2e essai');
  }

  console.log('\n══════════════════════════════════════');
  console.log('ROUND 12 (registre NC + essais gratuits) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
