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

// ════════════ A) RÉCEPTION PRODUIT — checkConformite ════════════
function conf(typeVal, tempVal) {
  clearReg();
  reg('cat_1').value = String(typeVal);
  reg('temp_1').value = (tempVal === '' ? '' : String(tempVal));
  const g = reg('conf_status_1'); const okB = makeEl('b'), badB = makeEl('b'); g._qsa['.status-btn'] = [okB, badB];
  ['conf_seuil_1', 'conf_val_1', 'nc_temp_1', 'nc_temp_action_1', 'seuil_val_1', 'seuil_lbl_1'].forEach(reg);
  ctx.checkConformite('1');
  return { ok: okB.classList.contains('active-ok'), bad: badB.classList.contains('active-bad'), none: !okB.classList.contains('active-ok') && !badB.classList.contains('active-bad') };
}
ok(conf('amb', 25).ok, 'réception: produit ambiant -> conforme (pas de seuil froid)');
ok(conf('', 5).none, 'réception: type non choisi -> aucun statut');
ok(conf('custom', 5).none, 'réception: type custom -> aucun statut');
ok(conf('4', 3).ok, 'réception: +3 ≤ seuil +4 -> conforme');
ok(conf('4', 4).ok, 'réception: +4 = seuil -> conforme');
ok(conf('4', 5).bad, 'réception: +5 > seuil +4 -> NON conforme');
ok(conf('-18', -18).ok, 'réception: surgelé -18 = seuil -> conforme');
ok(conf('-18', -15).bad, 'réception: surgelé -15 (trop chaud) -> NON conforme');
ok(conf('4', '').none, 'réception: pas de température -> aucun statut');

// ════════════ B) ALLERGÈNES — les 14 allergènes réglementaires (INCO 1169/2011) ════════════
const A = ctx.ALLERG_NOMS;
ok(Array.isArray(A) && A.length === 14, 'allergènes: exactement 14 (réglementation INCO)');
['Gluten', 'Crustacés', 'Oeufs', 'Poissons', 'Arachides', 'Soja', 'Lait', 'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'].forEach(function (nom) {
  ok(A.indexOf(nom) > -1, 'allergènes: "' + nom + '" présent');
});

// ════════════ C) PLAT TÉMOIN — conservation J+5 (Arrêté 29/09/1997) ════════════
{
  const c = reg('platsTemoinsContainer'); c.children = [];
  const created = [];
  const oc = doc.createElement.bind(doc);
  doc.createElement = function (t) { const e = oc(t); created.push(e); return e; };
  ctx.ajouterPlatTemoin();
  doc.createElement = oc;
  const div = created.find(function (e) { return typeof e.innerHTML === 'string' && /Plat témoin N°/.test(e.innerHTML); });
  const html = div ? div.innerHTML : '';
  ok(html.length > 0, 'plat témoin: bloc généré');
  ok(/J\+5/.test(html), 'plat témoin: conservation J+5 affichée');
  ok(/Arrêté 29\/09\/1997/.test(html), 'plat témoin: référence légale citée');
  const exp = new Date(); exp.setDate(exp.getDate() + 5);
  ok(html.indexOf(exp.toLocaleDateString('fr-FR')) > -1, 'plat témoin: date de fin de conservation = aujourd\'hui + 5 jours');
  // valeur cachée DLC = J+5 au format ISO
  ok(new RegExp('value="' + exp.toISOString().split('T')[0] + '"').test(html), 'plat témoin: DLC ISO J+5 enregistrée');
}

// ════════════ D) COHÉRENCE LÉGALE — plus de "72h" trompeur (durée = 5 jours) ════════════
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
ok(/Plat Témoin — Conservation 5 jours/.test(SRC), 'cohérence: module "Conservation 5 jours"');
ok(!/Conservation 72h/.test(SRC), 'cohérence: plus de "Conservation 72h" (sous la durée légale)');
ok(!/Conservation < 72 h/.test(SRC), 'cohérence: NC "< 72 h" corrigée en "< 5 jours"');
ok(/Plat Témoin \(5 j\)/.test(SRC), 'cohérence: menu "Plat Témoin (5 j)"');

console.log('\n══════════════════════════════════════');
console.log('ROUND 13 (réception produit + allergènes + plat témoin) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
