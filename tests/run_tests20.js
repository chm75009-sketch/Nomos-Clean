'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
function corps(nom) {
  const i = SRC.indexOf('function ' + nom + '('); if (i < 0) return '';
  const o = SRC.indexOf('{', i); let d = 0;
  for (let j = o; j < SRC.length; j++) { if (SRC[j] === '{') d++; else if (SRC[j] === '}') { d--; if (!d) return SRC.slice(o, j + 1); } }
  return '';
}

// ════════════ A) CLÉ PUBLIQUE — doit être 'anon', JAMAIS 'service_role' ════════════
const mAnon = SRC.match(/SUPABASE_ANON\s*=\s*'([^']+)'/);
ok(!!mAnon, 'sécurité: clé Supabase présente');
if (mAnon) {
  let payload = {};
  try { payload = JSON.parse(Buffer.from(mAnon[1].split('.')[1], 'base64').toString('utf8')); } catch (e) {}
  ok(payload.role === 'anon', 'sécurité: la clé embarquée est "anon" (publique), role=' + payload.role);
  ok(payload.role !== 'service_role', 'sécurité: AUCUNE clé service_role dans le code client (catastrophe évitée)');
}
// aucun JWT service_role ailleurs
const jwts = SRC.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
let roleServiceFound = false;
jwts.forEach(function (j) { try { const p = JSON.parse(Buffer.from(j.split('.')[1], 'base64').toString('utf8')); if (p.role === 'service_role') roleServiceFound = true; } catch (e) {} });
ok(!roleServiceFound, 'sécurité: aucun jeton service_role embarqué (' + jwts.length + ' JWT vérifié(s))');

// ════════════ B) CONNEXION — mot de passe vérifié CÔTÉ SERVEUR (RPC) ════════════
const login = corps('sbLoginTentative');
ok(/rpc\/login_etab/.test(login), 'sécurité: connexion via fonction serveur login_etab (RPC)');
ok(!/select.*mot_de_passe/i.test(login) && !/etablissements\?code_acces=eq[^\n]*select/i.test(login), 'sécurité: la connexion ne lit jamais la colonne mot de passe');

// ════════════ C) ADMIN — ne lit JAMAIS les mots de passe ════════════
ok(!/\.select\('\*'\)[^\n]*etablissements/.test(SRC) && !/from\('etablissements'\)\.select\('\*'\)/.test(SRC), 'sécurité: aucun select(*) sur etablissements (exposerait les mots de passe)');
// les lectures admin d'etablissements listent des colonnes explicites sans mot_de_passe
const lecturesEtab = SRC.match(/from\('etablissements'\)\.select\('[^']+'\)/g) || [];
ok(lecturesEtab.length > 0 && lecturesEtab.every(function (q) { return !/mot_de_passe/.test(q); }), 'sécurité: toutes les lectures etablissements excluent mot_de_passe (' + lecturesEtab.length + ')');
const selectsEtab = SRC.match(/select=([a-z_,]+)/g) || [];
ok(!selectsEtab.some(function (q) { return /mot_de_passe/.test(q); }), 'sécurité: aucune requête REST ne sélectionne mot_de_passe');

// ════════════ D) HORS-LIGNE — mot de passe jamais en clair (empreinte SHA-256) ════════════
const saveOff = corps('_saveOfflineCred');
ok(/_sha256Hex/.test(saveOff), 'sécurité: identifiants hors-ligne hachés (SHA-256)');
ok(!/code:[^\n]*pwd|pwd:[^\n]*pwd|mot_de_passe:\s*pwd/.test(saveOff), 'sécurité: le mot de passe en clair n\'est pas stocké hors-ligne');
// re-preuve fonctionnelle
(async function () {
  ctx.localStorage.clear();
  await ctx._saveOfflineCred('HACCP-AAAAA-2026', 'secret-en-clair-123', { id: 'e1', nom: 'X', date_expiration: '2099-01-01' });
  const raw = ctx.localStorage.getItem('haccp_offline_cred_v1') || '';
  ok(raw.indexOf('secret-en-clair-123') === -1, 'sécurité: vérif réelle — mot de passe absent du stockage');

  // ════════════ E) RGPD + cloisonnement (rappels de garde) ════════════
  ok(/insc_rgpd/.test(SRC) && /RGPD/.test(SRC), 'sécurité: consentement RGPD requis à l\'inscription');
  const ccVals = (SRC.match(/code_client\s*:\s*([^,\n}]+)/g) || []);
  ok(ccVals.length > 0 && ccVals.every(function (v) { return /ETAB_ID/.test(v) || /etab/.test(v) || /_eid/.test(v); }), 'sécurité: toute écriture de contrôle est cloisonnée (code_client = ETAB_ID)');

  // photos isolées par client
  ctx.ETAB_ID = 'client-A-uuid';
  const nomA = ctx.construireNomFichierPhoto({ source: 'x', controleId: '1', base64: 'data:image/jpeg;base64,AAAA' });
  ctx.ETAB_ID = 'client-B-uuid';
  const nomB = ctx.construireNomFichierPhoto({ source: 'x', controleId: '1', base64: 'data:image/jpeg;base64,AAAA' });
  ok(nomA.indexOf('client-A-uuid') === 0 && nomB.indexOf('client-B-uuid') === 0, 'sécurité: photos préfixées par l\'identité du client (cloisonnement storage)');

  // ════════════ F) SESSION ADMIN — non persistante (re-auth après fermeture) ════════════
ok(!/lsSet\('haccp_admin_ok'/.test(SRC), 'sécurité: la session admin n\'est PAS stockée en permanence (localStorage)');
ok(/sessionStorage.setItem\('haccp_admin_ok'/.test(SRC), 'sécurité: session admin en sessionStorage (vidée à la fermeture)');
ok(/sessionStorage.getItem\('haccp_admin_ok'\)/.test(SRC), 'sécurité: restauration admin lue depuis sessionStorage uniquement');
ok(/lsRemove\('haccp_admin_ok'\)/.test(SRC), 'sécurité: nettoyage de l\'ancien flag admin persistant (migration)');

console.log('\n══════════════════════════════════════');
  console.log('ROUND 20 (audit de sécurité) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
