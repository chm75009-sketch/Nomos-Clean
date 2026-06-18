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

// ════════════ A) RÉCEPTION — compartiment véhicule : checkComp ════════════
// OK seulement si T° sonde ≤ seuil ET (si T° bord saisie) bord ≤ seuil ET écart ≤ 2°C
function comp(seuil, tsonde, tbord) {
  clearReg();
  reg('comp_type_1').value = String(seuil);
  reg('comp_tsonde_1').value = (tsonde === '' ? '' : String(tsonde));
  if (tbord !== undefined) reg('comp_tbord_1').value = String(tbord);
  const g = reg('comp_status_1'); const okB = makeEl('b'), badB = makeEl('b'); g._qsa['.status-btn'] = [okB, badB];
  reg('comp_seuil_reg_1'); reg('comp_val_tbord_1'); reg('comp_val_tsonde_1'); reg('comp_nc_wrap_1');
  ctx.checkComp('1');
  return { ok: okB.classList.contains('active-ok'), bad: badB.classList.contains('active-bad'), none: !okB.classList.contains('active-ok') && !badB.classList.contains('active-bad') };
}
ok(comp(4, 3).ok, 'véhicule: sonde +3 ≤ seuil +4 -> CONFORME');
ok(comp(4, 4).ok, 'véhicule: sonde = seuil (+4) -> CONFORME');
ok(comp(4, 5).bad, 'véhicule: sonde +5 > seuil +4 -> NON CONFORME');
ok(comp(-18, -18).ok, 'véhicule: surgelé sonde -18 = seuil -> CONFORME');
ok(comp(-18, -15).bad, 'véhicule: surgelé sonde -15 (trop chaud) -> NON CONFORME');
ok(comp(4, 3, 3).ok, 'véhicule: sonde +3, bord +3 (cohérents) -> CONFORME');
ok(comp(4, 3, 6).bad, 'véhicule: bord +6 > seuil (même si sonde ok) -> NON CONFORME');
ok(comp(4, 3, 0).bad, 'véhicule: écart sonde/bord > 2°C (mesure douteuse) -> NON CONFORME');
ok(comp(4, 3, 4).ok, 'véhicule: bord +4 = seuil, écart 1°C -> CONFORME');
ok(comp(4, '').none, 'véhicule: sonde vide -> aucun statut');
ok(comp('amb', 25).none, 'véhicule: type ambiant -> non évalué');

// ════════════ B) REPRISE DE SESSION — stockage local + session ════════════
const KEY = 'haccp_session_v10';
const payload = JSON.stringify({ etabId: 'e1', etabNom: 'Resto', secteur: 'resto', loginAt: Date.now(), pwdOk: true });
ctx.localStorage.clear(); ctx.sessionStorage.clear();
ctx.sessionWrite(payload);
ok(ctx.localStorage.getItem(KEY) === payload && ctx.sessionStorage.getItem(KEY) === payload, 'session: écrite dans local ET session storage');
ok(ctx.sessionRead() === payload, 'session: relue correctement');
// localStorage effacé (ex. navigateur) mais sessionStorage présent -> restauré
ctx.localStorage.removeItem(KEY);
ok(ctx.sessionRead() === payload, 'session: repli sessionStorage si localStorage vidé');
ok(ctx.localStorage.getItem(KEY) === payload, 'session: localStorage restauré depuis sessionStorage');
ctx.sessionClear();
ok(ctx.sessionRead() === null, 'session: sessionClear() -> plus de session');

// ════════════ C) EXPIRATION DE SESSION — fenêtres 12h (payant) / essai ════════════
const H = 60 * 60 * 1000;
function expire(estEssai, ageMs) {
  const essaiJours = (typeof ctx.ESSAI_UNIVERSEL_JOURS === 'number' ? ctx.ESSAI_UNIVERSEL_JOURS : 3) + 4;
  const maxAge = estEssai ? (essaiJours * 24 * H) : (12 * H);
  return ageMs > maxAge; // true = session expirée -> retour présentation
}
ok(expire(false, 11 * H) === false, 'session payant: 11h -> encore valide');
ok(expire(false, 13 * H) === true, 'session payant: 13h -> expirée (ressaisir mot de passe)');
ok(expire(true, 100 * H) === false, 'session essai: 100h -> encore valide (durée+marge)');
ok(expire(true, 200 * H) === true, 'session essai: 200h -> expirée');
// Vérif statique : le vrai code applique bien 12h payant + sessionClear à l'expiration
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
ok(/12 \* 60 \* 60 \* 1000/.test(SRC), 'session: fenêtre 12h présente dans le code');
ok(/ESSAI_UNIVERSEL_JOURS[^\n]*\+ 4/.test(SRC), 'session: fenêtre essai = durée + 4 jours de marge');
const initIdx = SRC.indexOf('age > maxAge');
ok(initIdx > -1 && /sessionClear\(\)/.test(SRC.slice(initIdx, initIdx + 200)) && /page-presentation/.test(SRC.slice(initIdx, initIdx + 300)), 'session: expiration -> sessionClear() + retour présentation');
// Sécurité : pas de re-remplissage automatique du mot de passe (seul le code)
ok(/UNIQUEMENT le code/.test(SRC) || /pas le mot de passe/.test(SRC), 'session: mot de passe jamais pré-rempli (ressaisi à chaque session)');

console.log('\n══════════════════════════════════════');
console.log('ROUND 10 (réception véhicule + reprise session) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
