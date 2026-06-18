'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
function reg(id) { const e = makeEl('div'); e.id = id; e.children = []; doc._registry[id] = e; return e; }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// ════════════ A) LIAISON THERMIQUE — chaîne chaud (≥63°C) / froid (≤10°C) ════════════
function ltCapture(type) {
  for (const k of Object.keys(doc._registry)) delete doc._registry[k];
  reg('ltChaudsContainer'); reg('ltFroidsContainer');
  const created = [];
  const oc = doc.createElement.bind(doc);
  doc.createElement = function (t) { const e = oc(t); created.push(e); return e; };
  ctx.ltChaudCount = 0; ctx.ltFroidCount = 0;
  ctx.ltAjouterPlat(type);
  doc.createElement = oc;
  const div = created.find(function (e) { return typeof e.innerHTML === 'string' && /Plat 1/.test(e.innerHTML); });
  return div ? div.innerHTML : '';
}
{
  const chaud = ltCapture('chaud');
  ok(/≥ \+63°C/.test(chaud), 'liaison chaude: seuil réglementaire ≥ +63°C affiché');
  ok(/🔥/.test(chaud) && /lt_tdist_chaud_1/.test(chaud), 'liaison chaude: bloc plat chaud généré');
  const froid = ltCapture('froid');
  ok(/≤ \+10°C/.test(froid), 'liaison froide: seuil réglementaire ≤ +10°C affiché');
  ok(/❄️/.test(froid) && /lt_tdist_froid_1/.test(froid), 'liaison froide: bloc plat froid généré');
}
// Logique de NC (réplique fidèle du handler change : ch ? v<s : v>s)
function ltNC(isChaud, v) { const s = isChaud ? 63 : 10; return !isNaN(v) && (isChaud ? v < s : v > s); }
ok(ltNC(true, 65) === false, 'liaison chaude: +65°C -> conforme');
ok(ltNC(true, 63) === false, 'liaison chaude: +63°C (limite) -> conforme');
ok(ltNC(true, 60) === true, 'liaison chaude: +60°C -> NC (trop froid)');
ok(ltNC(false, 8) === false, 'liaison froide: +8°C -> conforme');
ok(ltNC(false, 10) === false, 'liaison froide: +10°C (limite) -> conforme');
ok(ltNC(false, 12) === true, 'liaison froide: +12°C -> NC (trop chaud)');
// vérif statique : le vrai code utilise bien ces seuils et cette logique
ok(/seuil = isChaud \? 63 : 10/.test(SRC), 'liaison: seuils 63/10 dans le code');
ok(/ch \? v < s : v > s/.test(SRC), 'liaison: logique NC (chaud<seuil / froid>seuil) dans le code');

// ════════════ B) AUDIT DES SEUILS RÉGLEMENTAIRES (cuisson à cœur) ════════════
const TV = ctx.TYPES_VIANDE;
function seuilDe(motif) { const e = (TV || []).find(function (x) { return new RegExp(motif, 'i').test(x.label); }); return e ? e.seuil : null; }
ok(seuilDe('Volaille') === 74, 'cuisson: volailles 74°C à cœur');
ok(seuilDe('hach') === 70, 'cuisson: viande hachée 70°C à cœur');
ok(seuilDe('Porc, veau, agneau') === 70, 'cuisson: porc/veau/agneau 70°C');
ok(seuilDe('Bœuf / veau entier') === 63, 'cuisson: bœuf entier 63°C');
ok(seuilDe('Poissons') === 63, 'cuisson: poissons 63°C');
ok(seuilDe('Maintien au chaud') === 63, 'cuisson: maintien au chaud 63°C');
ok(seuilDe('Réchauffage') === 63, 'cuisson: réchauffage 63°C');
ok((TV || []).every(function (e) { return typeof e.seuil === 'number' && e.seuil >= 63 && e.seuil <= 75; }), 'cuisson: tous les seuils dans la plage réglementaire 63–75°C');

// ════════════ C) AUDIT — constantes de seuils froids inchangées ════════════
// Garde-fou anti-régression : si une modif future changeait un seuil de sécurité.
ok(/seuil:-18/.test(SRC) || /seuil: ?-18/.test(SRC) || /'-18'/.test(SRC), 'froid: seuil surgelé -18°C présent');
ok(ctx.SEUILS_ENCEINTE.refrigerateur.seuil === 4 && ctx.SEUILS_ENCEINTE.congelateur.seuil === -18, 'froid: frigo +4 / congélateur -18 (réglementaire)');
// huiles : 175°C / 25% TPM (vérifié fonctionnellement en Round 4, ici garde statique)
ok(/parseFloat\(tempEl\.value\) > 175/.test(SRC), 'huiles: seuil température 175°C présent');
ok(/parseFloat\(tpmEl\.value\)  ?> 25/.test(SRC), 'huiles: seuil TPM 25% présent');

console.log('\n══════════════════════════════════════');
console.log('ROUND 14 (liaison thermique + audit seuils réglementaires) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
