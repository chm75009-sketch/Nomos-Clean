'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;

// ════════════ A) CATALOGUE DES MODULES (tableau de bord) ════════════
const M = ctx.MODULES; const COLORS = ctx.COLOR_TO;
ok(Array.isArray(M) && M.length > 0, 'modules: catalogue présent');
{
  const ids = {}; const nums = {}; let dupId = false, dupNum = false, badField = false, badColor = false;
  M.forEach(function (m) {
    if (!m || typeof m.id !== 'string' || !/\S/.test(m.id)) badField = true;
    if (typeof m.name !== 'string' || !/\S/.test(m.name)) badField = true;
    if (typeof m.ico !== 'string' || !/\S/.test(m.ico)) badField = true;
    if (m.color && !COLORS[m.color]) badColor = true;
    if (ids[m.id]) dupId = true; ids[m.id] = 1;
    if (m.num != null) { if (nums[m.num]) dupNum = true; nums[m.num] = 1; }
  });
  ok(!badField, 'modules: chaque module a id + nom + icône');
  ok(!badColor, 'modules: toutes les couleurs référencées existent (COLOR_TO)');
  ok(!dupId, 'modules: aucun id en double');
  ok(!dupNum, 'modules: aucun numéro en double');
}
// les modules clés existent
// (la traçabilité est un sous-flux de la réception, pas un module à part)
['reception', 'temperatures', 'cuisson', 'refroidissement', 'huiles', 'nc', 'allergenes', 'plat-temoin', 'liaison-thermique', 'nuisibles', 'dechets'].forEach(function (id) {
  ok(M.some(function (m) { return m.id === id; }), 'modules: "' + id + '" présent');
});
// modules réservés à un secteur bien marqués
{
  const pt = M.find(function (m) { return m.id === 'plat-temoin'; });
  ok(pt && Array.isArray(pt.secteurs) && pt.secteurs.indexOf('collective') > -1, 'modules: plat-témoin réservé à la restauration collective');
}

// ════════════ B) PDF LÉGAL RÉCEPTION — contenu remis à l'inspecteur ════════════
ctx.ETAB = { nom: 'Le Bistrot du Coin' };
ctx.SECTEUR_ACTIF = 'resto';
const data = {
  fournisseur: 'Metro', bl: 'BL-2026-789', transporteur: 'STEF Logistique',
  timestamp: '01/06/2026 a 10h00', signataire: 'Jean Dupont',
  vehicule: { hygiene: 'Conforme', hygieneAction: '', compartiments: [{ cid: '1', type: 'Frais 0-4°C', tsonde: '3', conformite: 'Conforme', nc: false }] },
  produits: [{ compartId: '1', num: '1', type: 'Poulet fermier', lot: 'LOT-789', dlc: '2026-06-05', temp: '3', conformite: 'Conforme', emballage: 'Bon état' }]
};
const created = [];
const origCreate = doc.createElement.bind(doc);
doc.createElement = function (t) { const e = origCreate(t); created.push(e); return e; };
ctx.imprimerReception(data, {});
doc.createElement = origCreate;
const contentEl = created.find(function (e) { return typeof e.innerHTML === 'string' && /Fournisseur/.test(e.innerHTML); });
const html = contentEl ? contentEl.innerHTML : '';
ok(html.length > 0, 'réception PDF: contenu généré');
ok(/Metro/.test(html), 'réception PDF: fournisseur présent');
ok(/BL-2026-789/.test(html), 'réception PDF: numéro de BL présent');
ok(/STEF Logistique/.test(html), 'réception PDF: transporteur présent');
ok(/Jean Dupont/.test(html), 'réception PDF: signataire présent');
ok(/Poulet fermier/.test(html), 'réception PDF: produit reçu présent');
ok(/LOT-789/.test(html), 'réception PDF: n° de lot (traçabilité) présent');
ok(/2026-06-05/.test(html), 'réception PDF: DLC du produit présente');
ok(/Compartiment 1/.test(html) && /Frais 0-4°C/.test(html), 'réception PDF: compartiment véhicule présent');
ok(/3°C/.test(html), 'réception PDF: température relevée présente');
ok(/Conforme/.test(html), 'réception PDF: conformité affichée');
ok(/3 ans/.test(html), 'réception PDF: mention légale de conservation 3 ans');

console.log('\n══════════════════════════════════════');
console.log('ROUND 17 (catalogue modules + PDF réception) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
