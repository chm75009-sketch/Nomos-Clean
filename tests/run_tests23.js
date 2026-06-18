'use strict';
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const J = ctx._joursCalendaire;
// le bug : connexion hier 20h, vue ce matin 10h -> doit être "hier" (1), pas "aujourd'hui" (0)
ok(J(new Date(2026,5,9,20,0,0), new Date(2026,5,10,10,0,0)) === 1, 'dernière connexion: hier soir vue ce matin -> 1 jour ("hier")');
ok(J(new Date(2026,5,10,0,30,0), new Date(2026,5,10,23,30,0)) === 0, 'même jour (matin tôt -> soir) -> 0 ("aujourd\'hui")');
ok(J(new Date(2026,5,10,12,0,0), new Date(2026,5,10,12,0,0)) === 0, 'même instant -> 0');
ok(J(new Date(2026,5,5,12,0,0), new Date(2026,5,10,8,0,0)) === 5, '5 jours calendaires');
ok(J(new Date(2026,4,31,23,0,0), new Date(2026,5,1,1,0,0)) === 1, 'passage de mois (31 mai -> 1 juin) -> 1');
ok(J(new Date(2025,11,31,22,0,0), new Date(2026,0,1,3,0,0)) === 1, 'passage d\'année (31 déc -> 1 jan) -> 1');
// libellé cohérent
function lbl(a,b){ var j=Math.max(0,J(a,b)); return j===0?"aujourd'hui":(j===1?'hier':'il y a '+j+' jours'); }
ok(lbl(new Date(2026,5,9,20,0,0), new Date(2026,5,10,10,0,0))==='hier', 'libellé: "hier" pour connexion de la veille');
ok(lbl(new Date(2026,5,8,9,0,0), new Date(2026,5,10,10,0,0))==='il y a 2 jours', 'libellé: "il y a 2 jours"');
const fs=require('fs'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const CSS=fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
ok(/!secteurEssai && !multiSect/.test(SRC), 'admin essai: secteur facultatif si compte test (accès à tous les secteurs)');
ok(/select option[^}]*background/.test(CSS), 'UI: options des listes déroulantes lisibles (fond défini)');
const B=ctx._capBandeSeuil;
ok(B(4) && B(4).max===4 && B(4).min===0, 'capteurs: frigo +4 -> seuils 0 / +4 auto');
ok(B(-18) && B(-18).max===-18 && B(-18).min===-25, 'capteurs: congélateur -18 -> -25 / -18 auto');
ok(B(2) && B(2).min===0 && B(2).max===2, 'capteurs: chambre +2 -> 0 / +2 auto');
ok(B(0) && B(0).min===-7 && B(0).max===0, 'capteurs: seuil 0 -> -7 / 0 auto');
ok(B('abc')===null && B(null)===null, 'capteurs: seuil non numérique -> pas de remplissage');
ctx.localStorage.clear();
var R=ctx.getRelevesConfig();
ok(R.nb===2 && R.heures.length===2 && R.heures[0]==='08:00' && R.heures[1]==='18:00', 'relevés: défaut = 2/jour (08:00 + 18:00)');
ctx.setRelevesConfig(3,['07:00','13:00','19:00']);
var R2=ctx.getRelevesConfig();
ok(R2.nb===3 && R2.heures.length===3 && R2.heures[2]==='19:00', 'relevés: configuration sauvegardée (3/jour)');
ctx.localStorage.setItem('haccp_releves_config', JSON.stringify({nb:99,heures:[]}));
ok(ctx.getRelevesConfig().nb===2, 'relevés: nb hors plage (1–6) -> retombe sur 2');
ok(typeof ctx._relevesBlockHtml==='function' && /rel_nb/.test(ctx._relevesBlockHtml()) && /rel_heure_0/.test(ctx._relevesBlockHtml()), 'relevés: bloc UI généré (sélecteur + heures)');
console.log('\n══════════════════════════════════════');
console.log('ROUND 23 (admin — dernière connexion) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { failures.forEach(f => console.log('  - ' + f)); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
