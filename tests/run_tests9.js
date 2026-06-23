'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const OFFLINE_KEY = 'haccp_offline_cred_v1';

(async function main() {
  // ════════════ A) sbLoginLocal — comptes locaux (démo/test) ════════════
  // unknown / inactif / mauvais mdp / correct
  ok(ctx.sbLoginLocal('INCONNU', 'x').ok === false, 'login local: code inconnu -> refusé');
  {
    ctx.CODES_LOCAUX['ZTEST'] = { nom: 'Z', secteur: 'resto', actif: false, mot_de_passe: '1234' };
    ok(ctx.sbLoginLocal('ZTEST', '1234').ok === false, 'login local: compte désactivé -> refusé');
    ctx.CODES_LOCAUX['ZTEST'].actif = true;
    ok(ctx.sbLoginLocal('ZTEST', 'mauvais').ok === false, 'login local: mauvais mot de passe -> refusé');
    const r = ctx.sbLoginLocal('ZTEST', '1234');
    ok(r.ok === true && r.data.id === 'local-ZTEST' && r.local === true, 'login local: bon mdp -> accepté (id local-)');
    ok(r.data.multi_secteur === true, 'login local: compte de test reste multi-secteur');
  }
  // compte à mot de passe vide -> accepte n'importe quel mdp (par conception)
  ctx.CODES_LOCAUX['ZVIDE'] = { nom: 'Z', secteur: 'resto', actif: true, mot_de_passe: '' };
  ok(ctx.sbLoginLocal('ZVIDE', 'peu importe').ok === true, 'login local: compte (mdp vide) accepte tout');

  // ════════════ B) _sha256Hex disponible (contexte sécurisé) ════════════
  const h = await ctx._sha256Hex('abc');
  ok(typeof h === 'string' && h.length === 64, 'crypto: SHA-256 hex 64 chars disponible');
  if (!h) { console.log('  (crypto.subtle indisponible — tests hors-ligne sautés)'); }

  // ════════════ C) _tryOfflineLogin — connexion hors-ligne 7 jours ════════════
  function setOffline(d) { ctx.localStorage.clear(); return ctx._saveOfflineCred(d.code, d.pwd, d.etab); }
  const ETAB = { id: 'e1', nom: 'Resto', secteur: 'resto', code_acces: 'HACCP-AAAAA-2026', date_expiration: '2099-01-01', multi_secteur: false };

  // C0 — rien de stocké
  ctx.localStorage.clear();
  ok((await ctx._tryOfflineLogin('HACCP-AAAAA-2026', '1234')).ok === false, 'offline: aucun identifiant stocké -> refusé');

  // C1 — identifiants valides
  await setOffline({ code: 'HACCP-AAAAA-2026', pwd: '1234', etab: ETAB });
  {
    const r = await ctx._tryOfflineLogin('HACCP-AAAAA-2026', '1234');
    ok(r.ok === true && r.offline === true && r.data.id === 'e1', 'offline: bons identifiants -> accepté');
  }
  // C2 — insensible à la casse du code
  ok((await ctx._tryOfflineLogin('haccp-aaaaa-2026', '1234')).ok === true, 'offline: code insensible à la casse');
  // C3 — mauvais mot de passe (empreinte différente)
  ok((await ctx._tryOfflineLogin('HACCP-AAAAA-2026', '9999')).ok === false, 'offline: mauvais mot de passe -> refusé');
  // C4 — mauvais code
  ok((await ctx._tryOfflineLogin('HACCP-ZZZZZ-2026', '1234')).ok === false, 'offline: code différent -> refusé');
  // C5 — au-delà de 7 jours -> expiré
  {
    const c = JSON.parse(ctx.localStorage.getItem(OFFLINE_KEY));
    c.at = Date.now() - (8 * 24 * 60 * 60 * 1000);
    ctx.localStorage.setItem(OFFLINE_KEY, JSON.stringify(c));
    const r = await ctx._tryOfflineLogin('HACCP-AAAAA-2026', '1234');
    ok(r.ok === false && r.expired === true, 'offline: > 7 jours -> expiré (reconnexion réseau requise)');
  }
  // C6 — abonnement expiré (même hors-ligne)
  await setOffline({ code: 'HACCP-AAAAA-2026', pwd: '1234', etab: Object.assign({}, ETAB, { date_expiration: '2020-01-01' }) });
  {
    const r = await ctx._tryOfflineLogin('HACCP-AAAAA-2026', '1234');
    ok(r.ok === false && r.subExpired === true, 'offline: abonnement expiré -> refusé (subExpired)');
  }
  // C7 — le mot de passe n'est JAMAIS stocké en clair
  await setOffline({ code: 'HACCP-AAAAA-2026', pwd: 'motdepasse-secret', etab: ETAB });
  {
    const raw = ctx.localStorage.getItem(OFFLINE_KEY);
    ok(raw.indexOf('motdepasse-secret') === -1, 'offline: mot de passe absent du stockage (empreinte SHA-256 seulement)');
  }

  // ════════════ D) QUOTA STOCKAGE — ne JAMAIS effacer une preuve (haccp_module_data_*) ════════════
  // Statique : aucun prédicat de purge ne cible les contrôles enregistrés
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
  const li = SRC.indexOf('function lsSet(');
  const lo = SRC.indexOf('function lsGet(');
  const lsSetBody = SRC.slice(li, lo);
  const purgePreds = (lsSetBody.match(/_purger\(function[\s\S]*?\}\)/g) || []);
  ok(purgePreds.length > 0, 'quota: des purges de caches existent');
  ok(!purgePreds.some(function (p) { return /haccp_module_data/.test(p); }), 'quota: AUCUNE purge ne cible haccp_module_data_* (preuves protégées)');

  // Fonctionnel : on simule un stockage saturé
  function quotaLS(cap) {
    const m = {};
    function total() { let t = 0; for (const k in m) t += k.length + m[k].length; return t; }
    return {
      _m: m,
      getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem(k, v) { v = String(v); const prev = m[k] || ''; if (total() - prev.length + v.length > cap) { const e = new Error('QuotaExceeded'); e.name = 'QuotaExceededError'; throw e; } m[k] = v; },
      removeItem(k) { delete m[k]; },
      key(i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; },
      clear() { for (const k in m) delete m[k]; }
    };
  }
  const saved = ctx.localStorage;
  const qls = quotaLS(1000);
  // pré-remplir DIRECTEMENT (sans passer par setItem)
  qls._m['haccp_brouillon_x'] = 'D'.repeat(600);                                  // cache régénérable (gros)
  qls._m['haccp_module_data_page-temperatures_etabA'] = 'P'.repeat(300);          // PREUVE (à préserver)
  ctx.localStorage = qls;
  const okSet = ctx.lsSet('haccp_nouvelle_cle', 'N'.repeat(200));                 // dépasse le quota -> doit purger le brouillon
  ctx.localStorage = saved;
  ok(okSet === true, 'quota: écriture réussie après purge des caches');
  ok(qls._m['haccp_module_data_page-temperatures_etabA'] === 'P'.repeat(300), 'quota: la PREUVE est intacte (jamais effacée)');
  ok(!('haccp_brouillon_x' in qls._m), 'quota: le brouillon régénérable a été purgé');
  ok(qls._m['haccp_nouvelle_cle'] === 'N'.repeat(200), 'quota: la nouvelle valeur est bien enregistrée');

  // ════════════ E) getNowStr — format date FR ════════════
  ok(/^\d{2}\/\d{2}\/\d{4} a \d{2}h\d{2}$/.test(ctx.getNowStr()), 'getNowStr: format "JJ/MM/AAAA a HHhMM"');

  console.log('\n══════════════════════════════════════');
  console.log('ROUND 9 (connexion / hors-ligne / quota) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
