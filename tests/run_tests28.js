'use strict';
// Round 28 — Non-régression des correctifs d'audit (virgule décimale, échappement XSS).
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }

// ── A) fmtTemp : la virgule décimale FR ne doit JAMAIS être tronquée (BLOCKER corrigé) ──
ok(ctx.fmtTemp('3,5') === '+3.5°C', 'fmtTemp("3,5") = +3.5°C (décimale préservée, plus de "+3°C")');
ok(ctx.fmtTemp('3.5') === '+3.5°C', 'fmtTemp("3.5") = +3.5°C');
ok(ctx.fmtTemp('-18,5') === '-18.5°C', 'fmtTemp("-18,5") = -18.5°C (congélateur)');
ok(ctx.fmtTemp('4') === '+4°C', 'fmtTemp("4") = +4°C (entier)');
ok(ctx.fmtTemp('3,5°C') === '+3.5°C', 'fmtTemp("3,5°C") gère l\'unité + virgule');
ok(ctx.fmtTemp('') === '', 'fmtTemp("") = vide');
ok(ctx.fmtTemp(null) === '', 'fmtTemp(null) = vide');

// ── B) _echap : neutralise le HTML hostile (anti-XSS) ──
ok(ctx._echap('<img src=x onerror=alert(1)>').indexOf('<') === -1, 'XSS: _echap retire les chevrons <');
ok(ctx._echap('a & b').indexOf('&amp;') > -1, 'XSS: _echap encode &');
ok(ctx._echap('"quote"').indexOf('&quot;') > -1, 'XSS: _echap encode les guillemets');
ok(ctx._echap(null) === '', '_echap(null) = vide');
ok(ctx._echap('Frigo N°1') === 'Frigo N°1', '_echap laisse passer un texte normal');

// ── C) Tableau Excel : colonnes = heures EXACTES (jamais Jour/Matin/Soir si heure connue) ──
{
  var cols = ctx._ttColonnes([
    { jour: '2026-06-14', hour: '16:45', enceinte: 'Enceinte N°1', temp: -13.4, isNC: true },
    { jour: '2026-06-14', hour: '17:00', enceinte: 'Enceinte N°1', temp: -11.3, isNC: true }
  ]);
  var labs = (cols[0] && cols[0].subs ? cols[0].subs.map(function (s) { return s.label; }) : []);
  ok(labs.indexOf('16:45') > -1 && labs.indexOf('17:00') > -1, 'Excel: 2 relevés capteur affichés à leur heure exacte (16:45 | 17:00)');
  ok(labs.indexOf('Matin') === -1 && labs.indexOf('Soir') === -1 && labs.indexOf('Jour') === -1, 'Excel: plus de libellés Jour/Matin/Soir quand l\'heure est connue');
}
// ── D) Multiplicité : 2 relevés à la même minute (capteur + manuel) → 2 colonnes ──
{
  var cols2 = ctx._ttColonnes([
    { jour: '2026-06-14', hour: '16:45', enceinte: 'Enceinte N°1', temp: -13.4, isNC: true, auto: true },
    { jour: '2026-06-14', hour: '16:45', enceinte: 'Enceinte N°1', temp: -20, isNC: false, auto: false }
  ]);
  var l2 = (cols2[0] && cols2[0].subs ? cols2[0].subs.map(function (s) { return s.label; }) : []);
  ok(l2.filter(function (x) { return x === '16:45'; }).length === 2, 'Excel: 2 relevés à la même minute → 2 colonnes (aucun relevé masqué)');
}
// ── E) VERROU : AUCUN relevé ne peut être perdu (matched + merged + orphelins == total) ──
{
  var rel = [];
  for (var d = 1; d <= 5; d++) {
    var j = '2026-06-0' + d;
    rel.push({ jour: j, hour: '08:00', enceinte: 'Enceinte N°1', temp: -19, isNC: false, auto: true, sig: 'Relevé auto. (UbiBot)' });
    rel.push({ jour: j, hour: '08:00', enceinte: 'Enceinte N°1', temp: -12, isNC: true, auto: false, sig: 'Mounir' }); // même minute → 2e colonne
    rel.push({ jour: j, hour: '14:33', enceinte: 'Enceinte N°2', temp: 3, isNC: false, auto: false, sig: 'Léa' });
    rel.push({ jour: j, hour: '19:05', enceinte: 'Enceinte N°1', temp: -20, isNC: false, auto: true, sig: 'Relevé auto. (UbiBot)' }); // hors créneau
  }
  rel.push({ jour: '2026-06-03', hour: '10:00', enceinte: '', temp: 5, isNC: false }); // sans nom → signalé orphelin
  var diag = { found: rel.length, matched: 0, merged: 0, orphans: {} };
  var cols = ctx._ttColonnes(rel);
  ctx._ttIndexer(cols, rel, diag);
  var orphTot = Object.keys(diag.orphans).reduce(function (a, k) { return a + diag.orphans[k]; }, 0);
  var compte = diag.matched + diag.merged + orphTot;
  ok(compte === rel.length, 'VERROU: tous les relevés comptabilisés (' + compte + '/' + rel.length + ') — aucun perdu');
}
// ── F) SMOKE : la génération de la feuille Excel ne doit PAS planter (erreurs runtime) ──
{
  function _mkWs() { var cs = {}; return { getCell: function (a, b) { var k = (b === undefined) ? ('' + a) : (a + '_' + b); return cs[k] || (cs[k] = {}); }, mergeCells: function () {}, getColumn: function () { return {}; }, getRow: function () { return {}; }, views: null }; }
  var relF = [
    { jour: '2026-06-14', hour: '08:00', enceinte: 'Enceinte N°1', temp: -19, isNC: false, auto: true, sig: 'Relevé auto. (UbiBot)' },
    { jour: '2026-06-14', hour: '08:00', enceinte: 'Enceinte N°1', temp: -12, isNC: true, auto: false, sig: 'Mounir' },
    { jour: '2026-06-14', hour: '12:30', enceinte: 'Enceinte N°2', temp: 3.5, isNC: false, auto: false, sig: 'Léa' }
  ];
  var colsF = ctx._ttColonnes(relF);
  var diagF = { found: relF.length, matched: 0, merged: 0, orphans: {} };
  var threw = false;
  try { ctx._ttRemplirFeuille(_mkWs(), colsF, ['2026-06-14'], relF, 'Test', 'Sous-titre', diagF); }
  catch (e) { threw = true; console.log('  (smoke erreur: ' + e.message + ')'); }
  ok(!threw, 'SMOKE: génération de la feuille Excel sans erreur d\'exécution');
  var threwD = false;
  try { ctx._ttFeuilleDetail(_mkWs(), colsF, relF, 'Test'); }
  catch (e2) { threwD = true; console.log('  (smoke détail erreur: ' + e2.message + ')'); }
  ok(!threwD, 'SMOKE: feuille « Détail des relevés » générée sans erreur');
}
// ── G) Accessibilité : aria-label posé depuis le texte visible (placeholder / .flabel) ──
{
  function _mockInput(over) { var o = { _at: (over && over._at) || {}, id: '', closest: (over && over.closest) || function () { return null; }, getAttribute: function (k) { return this._at[k] !== undefined ? this._at[k] : null; }, setAttribute: function (k, v) { this._at[k] = v; } }; return o; }
  var i1 = _mockInput(); i1.setAttribute('placeholder', 'Température relevée');
  ctx._a11yLabelsAuto({ querySelectorAll: function () { return [i1]; } });
  ok(i1.getAttribute('aria-label') === 'Température relevée', 'a11y: aria-label repris du placeholder');

  var flab = { textContent: 'Nom du capteur *' };
  var rowm = { querySelector: function (s) { return s === '.flabel' ? flab : null; } };
  var i2 = _mockInput({ closest: function (s) { return s === '.frow' ? rowm : null; } });
  ctx._a11yLabelsAuto({ querySelectorAll: function () { return [i2]; } });
  ok(i2.getAttribute('aria-label') === 'Nom du capteur', 'a11y: aria-label repris du .flabel (sans le *)');

  var i3 = _mockInput({ _at: { 'aria-label': 'Déjà là' } });
  ctx._a11yLabelsAuto({ querySelectorAll: function () { return [i3]; } });
  ok(i3.getAttribute('aria-label') === 'Déjà là', 'a11y: ne réécrit pas un aria-label existant');
}
// ── H) Confirmation avant suppression : action exécutée seulement si confirmé ──
{
  var _origSC = ctx.showConfirm;
  ctx.showConfirm = function (ico, t, m, okL, okC, cbk) { cbk(true); };   // simule clic « Supprimer »
  var n1 = 0; ctx._confirmSuppr('x', function () { n1++; });
  ok(n1 === 1, 'confirmSuppr: action exécutée si confirmé');
  ctx.showConfirm = function (ico, t, m, okL, okC, cbk) { cbk(false); };  // simule « Annuler »
  var n2 = 0; ctx._confirmSuppr('x', function () { n2++; });
  ok(n2 === 0, 'confirmSuppr: action ANNULÉE si refusé');
  ctx.showConfirm = _origSC;
}

// ── I) NAV-2 : les boutons « Fermer » en croix (✕) sont agrandis + libellés ──
{
  function _mkBtn(txt) { return { textContent: txt, style: {}, _at: {}, getAttribute: function (k) { return this._at[k] !== undefined ? this._at[k] : null; }, setAttribute: function (k, v) { this._at[k] = v; } }; }
  var bx = _mkBtn('✕');
  ctx._agrandirFermer({ querySelectorAll: function () { return [bx]; } });
  ok(bx.style.minWidth === '42px' && bx.style.minHeight === '42px', 'NAV: bouton ✕ agrandi (42px)');
  ok(bx.getAttribute('aria-label') === 'Fermer', 'NAV: bouton ✕ reçoit aria-label « Fermer »');
  var bn = _mkBtn('Valider');
  ctx._agrandirFermer({ querySelectorAll: function () { return [bn]; } });
  ok(!bn.style.minWidth, 'NAV: un bouton normal (« Valider ») n\'est PAS modifié');
  // « Fermer » pâle (gris clair en inline) → rendu net et visible
  var bf = _mkBtn('Fermer'); bf._at.style = 'background:#e2e8f0;padding:6px 12px';
  ctx._agrandirFermer({ querySelectorAll: function () { return [bf]; } });
  ok(bf.style.background === '#475569' && bf.style.color === '#ffffff', 'NAV: bouton « Fermer » pâle rendu visible');
  // « Fermer » déjà coloré (rouge) → laissé tel quel
  var bfr = _mkBtn('Fermer'); bfr._at.style = 'background:#dc2626;color:#fff';
  ctx._agrandirFermer({ querySelectorAll: function () { return [bfr]; } });
  ok(bfr.style.background !== '#475569', 'NAV: bouton « Fermer » déjà coloré laissé intact');
  // « ← Retour » → zone de tap agrandie (couleurs inchangées)
  var br = _mkBtn('← Retour'); br._at.style = 'background:rgba(255,255,255,.08);font-size:12px;color:#fff';
  ctx._agrandirFermer({ querySelectorAll: function () { return [br]; } });
  ok(br.style.minHeight === '38px' && br.style.fontSize === '13.5px', 'NAV: bouton « Retour » agrandi (tap + lisibilité)');
}

// ── J) TDB : tableau de bord « À faire aujourd'hui » ──
{
  var mTemp = { id: 'temperatures', name: 'Relevé — Températures', ico: '🌡️', cat: 'quotidien', ddpp: true };
  ok(ctx._tdbEstFait(mTemp, { 'Températures enceintes': true }) === true, 'TDB: contrôle détecté « fait » via son libellé d\'historique');
  ok(ctx._tdbEstFait(mTemp, {}) === false, 'TDB: contrôle « à faire » si absent de l\'historique du jour');
  var mNet = { id: 'nettoyage', name: 'Nettoyage', ico: '🧹', cat: 'quotidien', ddpp: true };
  ok(ctx._tdbEstFait(mNet, { 'Nettoyage fermeture': true }) === true, 'TDB: nettoyage reconnu via l\'un de ses 2 libellés (ouverture/fermeture)');
  ctx.SECTEUR_ACTIF = 'resto';
  var t = ctx._tdbTaches();
  ok(Array.isArray(t) && t.length > 0 && t.every(function (m) { return m.cat === 'quotidien' && m.ddpp; }), 'TDB: tâches du jour = modules quotidiens DDPP du secteur');
  // _tdbStatutMap : statut « fait/à faire » par module (sert à décorer les boutons, anti-doublon)
  ctx.localStorage.setItem('haccp_historique', JSON.stringify([]));
  ok(ctx._tdbStatutMap().temperatures === 'afaire', 'TDB-statut: sans historique → « à faire »');
  var auj = new Date().toISOString().split('T')[0];
  ctx.localStorage.setItem('haccp_historique', JSON.stringify([{ date: auj, module: 'Températures enceintes', secteur: 'resto' }]));
  ok(ctx._tdbStatutMap().temperatures === 'fait', 'TDB-statut: contrôle fait aujourd\'hui → « fait » (statut porté par le bouton, pas de liste en double)');
}

// ── K) TDB V2 : rappels périodiques (échéances + statut) ──
{
  ok(ctx._tdbAddDays('2026-01-01', 31) === '2026-02-01', 'TDB-périodique: calcul d\'échéance (+31 j)');
  ok(ctx._tdbPerioStatut('', 'mensuel', '2026-03-01').etat === 'jamais', 'TDB-périodique: jamais fait → « jamais »');
  ok(ctx._tdbPerioStatut('2026-01-01', 'mensuel', '2026-03-01').etat === 'retard', 'TDB-périodique: échéance dépassée → « retard »');
  ok(ctx._tdbPerioStatut('2026-02-05', 'mensuel', '2026-03-01').etat === 'bientot', 'TDB-périodique: échéance < 7 j → « bientôt »');
  ok(ctx._tdbPerioStatut('2026-03-01', 'mensuel', '2026-03-05').etat === 'ajour', 'TDB-périodique: dans les temps → « à jour »');
}

// ── L) Courbes de température : préparation des séries (tri + source + hors seuil) ──
{
  var rel = [
    { jour: '2026-06-14', hour: '08:00', enceinte: 'Frigo A', temp: 3, auto: true, isNC: false },
    { jour: '2026-06-14', hour: '12:00', enceinte: 'Frigo A', temp: 5, auto: false, isNC: true },
    { jour: '2026-06-13', hour: '09:00', enceinte: 'Frigo A', temp: 2, auto: true, isNC: false },
    { jour: '2026-06-14', hour: '08:00', enceinte: 'Congel', temp: -19, auto: true, isNC: false },
    { jour: '2026-06-14', hour: '09:00', enceinte: '', temp: null }
  ];
  var s = ctx._courbeSeries(rel);
  ok(s['Frigo A'] && s['Frigo A'].length === 3, 'Courbe: 3 points pour Frigo A (le relevé sans T° est ignoré)');
  ok(s['Frigo A'][0].x < s['Frigo A'][1].x && s['Frigo A'][1].x < s['Frigo A'][2].x, 'Courbe: points triés chronologiquement');
  ok(s['Frigo A'][2].nc === true && s['Frigo A'][2].src === 'manuel', 'Courbe: dernier point = manuel + hors seuil');
  ok(s['Congel'] && s['Congel'].length === 1, 'Courbe: enceintes séparées (Congel)');
}

// ── M) Formule « Contrôle RTH » : seuls les 3 contrôles sont autorisés ──
{
  ok(ctx._rthModuleAutorise('reception') && ctx._rthModuleAutorise('temperatures') && ctx._rthModuleAutorise('huiles'),
    'RTH: les 3 contrôles (réception / températures / huiles) sont autorisés');
  ok(!ctx._rthModuleAutorise('cuisson') && !ctx._rthModuleAutorise('nettoyage') && !ctx._rthModuleAutorise('allergenes'),
    'RTH: les autres modules sont verrouillés (→ écran « autres obligations » / upsell)');
  // détection de la formule depuis le code d'accès (essais RTH)
  ok(ctx._formuleDepuisCode('ESSAI-RTH-AB3KP-2026') === 'rth', 'RTH: code ESSAI-RTH-… → formule rth');
  ok(ctx._formuleDepuisCode('CLIENT-RTH-XY7-2026') === 'rth', 'RTH: code CLIENT-RTH-… → formule rth');
  ok(ctx._formuleDepuisCode('ESSAI-AB3KP-2026') === 'complet', 'RTH: code ESSAI-… normal → formule complète');
  ok(ctx._formuleDepuisCode('RTH75') === 'complet', 'RTH: RTH75 (compte test classique) → formule complète');
}

// ── N) Étiquettes : format d'impression mémorisé (planche A4 / rouleau / perso) ──
{
  ctx.ETAB_ID = 'ETABX';
  ctx.localStorage.removeItem('haccp_etiq_format_ETABX');
  ok(ctx._etiqFormatActif().id === 'a4_99x38', 'Étiquettes: format par défaut = planche A4 99×38 (14/feuille)');
  ctx.localStorage.setItem('haccp_etiq_format_ETABX', 'roll_62x29');
  var f = ctx._etiqFormatActif();
  ok(f.id === 'roll_62x29' && f.type === 'rouleau' && f.w === 62, 'Étiquettes: format rouleau mémorisé bien repris (62×29)');
}

console.log('\n════════════════════════════════════════');
console.log('ROUND 28 (non-régression audit) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
console.log('════════════════════════════════════════');
if (failures.length) console.log('FAILURES:\n  ' + failures.join('\n  '));
process.exit(fail ? 1 : 0);
