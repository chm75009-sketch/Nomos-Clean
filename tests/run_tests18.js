'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
ctx.ETAB = { nom: 'Le Bistrot du Coin' };
ctx.SECTEUR_ACTIF = 'resto';

function capture(fn) {
  const created = [];
  const oc = doc.createElement.bind(doc);
  doc.createElement = function (t) { const e = oc(t); created.push(e); return e; };
  let threw = false; try { fn(); } catch (e) { threw = true; }
  doc.createElement = oc;
  const el = created.find(function (e) { return typeof e.innerHTML === 'string' && e.innerHTML.length > 200; });
  return { html: el ? el.innerHTML : '', threw: threw };
}

// ════════════ A) PDF HUILES DE FRITURE (seuils 175°C / 25% TPM) ════════════
{
  const huiles = [
    { type: '🌻 Tournesol', temp: '170', tpm: '20', conformite: 'Conforme' },
    { type: '🥜 Arachide', temp: '185', tpm: '30', conformite: 'Non conforme', action: 'Huile changée immédiatement', isNC: true }
  ];
  const r = capture(function () { ctx.imprimerHuilesData(huiles, 'Marie Curie', '02/06/2026 a 11h00'); });
  ok(!r.threw && r.html.length > 0, 'huiles PDF: généré sans plantage');
  ok(/Le Bistrot du Coin/.test(r.html), 'huiles PDF: établissement présent');
  ok(/Marie Curie/.test(r.html), 'huiles PDF: signataire présent');
  ok(/Tournesol/.test(r.html) && /170°C/.test(r.html), 'huiles PDF: huile conforme (170°C) présente');
  ok(/Arachide/.test(r.html) && /185°C/.test(r.html), 'huiles PDF: huile NC (185°C) présente');
  ok(/175°C max/.test(r.html), 'huiles PDF: seuil réglementaire 175°C affiché');
  ok(/Huile changée/.test(r.html), 'huiles PDF: action corrective présente');
  ok(/non-conformite/.test(r.html), 'huiles PDF: compteur de non-conformités');
  ok(/3 ans/.test(r.html), 'huiles PDF: mention légale conservation 3 ans');
}

// ════════════ B) PDF REFROIDISSEMENT RAPIDE (+63 -> +10 en 2h) ════════════
{
  const prods = [
    { type: 'Soupe de légumes', t0: '70', t2: '8', conf: 'Conforme', isNC: false },
    { type: 'Riz pilaf', t0: '65', t2: '15', isNC: true, action: 'Produit jeté — non consommable' }
  ];
  const r = capture(function () { ctx.imprimerRefroidissementData(prods, 'Marie Curie', '02/06/2026 a 11h00'); });
  ok(!r.threw && r.html.length > 0, 'refroidissement PDF: généré sans plantage');
  ok(/Le Bistrot du Coin/.test(r.html), 'refroidissement PDF: établissement présent');
  ok(/Marie Curie/.test(r.html), 'refroidissement PDF: signataire présent');
  ok(/Soupe de légumes/.test(r.html) && /70°C/.test(r.html), 'refroidissement PDF: produit conforme présent');
  ok(/8°C/.test(r.html), 'refroidissement PDF: T° après 2h conforme (+8°C)');
  ok(/Riz pilaf/.test(r.html) && /15°C/.test(r.html), 'refroidissement PDF: produit NC (+15°C) présent');
  ok(/\+10°C en 2h max/.test(r.html), 'refroidissement PDF: seuil réglementaire +10°C/2h affiché');
  ok(/Produit jeté/.test(r.html), 'refroidissement PDF: action corrective présente');
  ok(/non-conformite/.test(r.html), 'refroidissement PDF: compteur de non-conformités');
  ok(/3 ans/.test(r.html), 'refroidissement PDF: mention légale conservation 3 ans');
}

// ════════════ C) ROBUSTESSE — listes vides, pas de plantage ════════════
{
  let threw = false;
  try { ctx.imprimerHuilesData([], 'X', 'now'); ctx.imprimerRefroidissementData([], 'X', 'now'); ctx.imprimerHuilesData(null, 'X', 'now'); } catch (e) { threw = true; }
  ok(!threw, 'PDF: listes vides / null -> pas de plantage');
}

console.log('\n══════════════════════════════════════');
console.log('ROUND 18 (PDF huiles + refroidissement) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
