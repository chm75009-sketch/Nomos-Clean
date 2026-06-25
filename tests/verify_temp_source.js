'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
ctx.ETAB = { nom: 'Test Capteur' };
ctx.SECTEUR_ACTIF = 'resto';

function render(data, sig) {
  const created = [];
  const orig = doc.createElement.bind(doc);
  doc.createElement = function (t) { const el = orig(t); created.push(el); return el; };
  ctx.imprimerTemperatures(data, sig, '01/06/2026 a 10h00');
  doc.createElement = orig;
  const el = created.find(e => typeof e.innerHTML === 'string' && /Temperatures Enceintes/.test(e.innerHTML));
  return el ? el.innerHTML : '';
}

// CAS 1 — tout capteur (auto), signataire écran = Léa
const auto = [{ type: 'Enceinte N°1', temp: '29.2', isNC: true, conf: 'Non conforme', action: 'Vérifier', source: 'Capteur UbiBot (automatique)', _quand: 'Programmé 25/06/2026 12:24' }];
const h1 = render(auto, 'Léa CHIKHAOUI');
ok(h1.length > 0, 'AUTO: contenu généré');
ok(/Relevé automatique \(capteur UbiBot\)/.test(h1), 'AUTO: émargement = Relevé automatique (capteur UbiBot)');
ok(!/Léa CHIKHAOUI/.test(h1), 'AUTO: le nom Léa N\'apparaît PAS');
ok(/25\/06\/2026 12:24/.test(h1), 'AUTO: heure du relevé présente');

// CAS 2 — manuel
const manuel = [{ type: 'Frigo', temp: '3', isNC: false, conf: 'Conforme' }];
const h2 = render(manuel, 'Jean Dupont');
ok(/Jean Dupont/.test(h2), 'MANUEL: émargement = nom Jean Dupont');
ok(!/Relevé automatique/.test(h2), 'MANUEL: pas de mention auto');

// CAS 3 — mixte (1 capteur + 1 manuel)
const mixte = [auto[0], manuel[0]];
const h3 = render(mixte, 'Jean Dupont');
ok(/Mixte \(capteur \+ manuel\)/.test(h3), 'MIXTE: en-tête = Mixte (capteur + manuel)');
ok(/Relevé automatique \(capteur UbiBot\)/.test(h3), 'MIXTE: ligne capteur présente');
ok(/Jean Dupont/.test(h3), 'MIXTE: ligne manuel avec le nom');

console.log('\nVERIF SOURCE TEMP: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
