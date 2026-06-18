'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// Extrait le corps complet d'une fonction par équilibrage d'accolades
function corpsFonction(nom) {
  const i = SRC.indexOf('function ' + nom + '(');
  if (i < 0) return null;
  const open = SRC.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}') { depth--; if (depth === 0) return SRC.slice(open, j + 1); }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════
//  A) SIGNATURE OBLIGATOIRE — chaque contrôle légal exige une signature
// ════════════════════════════════════════════════════════════════════════
// Tous les modules de CONTRÔLE (hors onboarding établissement & avertissement
// informatif allergènes) doivent bloquer la validation sans signature.
const CONTROLES = [
  'validerReception', 'validerTemperatures', 'validerCuisson', 'validerRefroi',
  'validerHuiles', 'validerHygiene', 'validerOuverture', 'validerFermeture',
  'validerEtiquetage', 'validerNuisibles', 'validerDechets', 'validerPertes',
  'validerDocs', 'validerAffichage', 'validerNC', 'validerTracabilite',
  'validerPlatTemoin', 'validerAudit', 'validerLiaisonThermique',
  'validerRegistreConvives', 'validerAnalysesMicro'
];
CONTROLES.forEach(function (fn) {
  const body = corpsFonction(fn);
  if (!body) { ok(false, 'signature: ' + fn + ' introuvable'); return; }
  // garde signature : flag hasSig* OU objet *Sig.v, ET un return de blocage
  const aGardeSig = /hasSig/.test(body) || /Sig\.v\b/.test(body) || /sig\.v\b/.test(body);
  const aBlocage = /\breturn\b/.test(body);
  ok(aGardeSig && aBlocage, 'signature obligatoire: ' + fn + ' bloque sans signature');
});

// onboarding & avertissement allergènes : PAS un contrôle signé (légitime)
{
  const ob = corpsFonction('validerOnboarding');
  ok(ob && !/hasSig/.test(ob), 'onboarding: pas de signature requise (réglage établissement, normal)');
}

// ════════════════════════════════════════════════════════════════════════
//  B) PROPAGATION SIGNATURE -> PAYLOAD CLOUD (+ cloisonnement + date offline)
// ════════════════════════════════════════════════════════════════════════
(async function () {
  const realEnregistrer = ctx.enregistrerControleHACCP;
  let captured = null;
  ctx.fetch = function (url, opts) {
    captured = { url: url, opts: opts, body: JSON.parse((opts && opts.body) || '{}') };
    return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(''); } });
  };
  ctx.window.fetch = ctx.fetch;
  ctx.window._dedupServeurAbsent = undefined;

  // Contrôle signé, saisi hors-ligne (savedAt fixé), avec NC
  ctx.ETAB_ID = 'etab-XYZ';
  captured = null;
  const r = await realEnregistrer('temperatures', {
    signature: 'data:image/png;base64,SIGNATURE_DATA',
    uid: 'u9',
    savedAt: '2026-05-01T08:00:00.000Z',
    timestamp: 'jeudi 1 mai 2026 à 10h00', // chaîne FR non parsable : ne doit PAS être utilisée
    nc_detectee: true,
    nc_details: 'Frigo à +8°C'
  });
  ok(r && r.ok === true, 'payload: envoi accepté');
  ok(captured && captured.body.code_client === 'etab-XYZ', 'payload: code_client = ETAB_ID (cloisonnement)');
  ok(captured && captured.body.signature === 'data:image/png;base64,SIGNATURE_DATA', 'payload: signature transmise');
  ok(captured && captured.body.uid === 'u9', 'payload: uid (déduplication) transmis');
  ok(captured && captured.body.module === 'temperatures', 'payload: module correct');
  ok(captured && captured.body.date_controle === '2026-05-01T08:00:00.000Z', 'payload: date = heure de VALIDATION (savedAt), pas l\'upload');
  ok(captured && captured.body.nc_detectee === true && captured.body.nc_details === 'Frigo à +8°C', 'payload: non-conformité transmise');
  ok(captured && !('photos' in captured.body && captured.body.photos.length), 'payload: pas de photos base64 lourdes dans la ligne (URLs liées séparément)');
  ok(captured && /on_conflict=code_client,uid/.test(captured.url), 'payload: déduplication serveur activée (on_conflict)');

  // Sans signature fournie -> champ signature null (jamais "undefined" ni plantage)
  captured = null;
  await realEnregistrer('reception', { uid: 'u10', savedAt: '2026-05-02T09:00:00.000Z' });
  ok(captured && captured.body.signature === null, 'payload: pas de signature -> null (propre)');

  // date_controle : si pas de savedAt valide, retombe sur une date ISO valide (jamais NaN)
  captured = null;
  await realEnregistrer('reception', { uid: 'u11' });
  const d = captured && new Date(captured.body.date_controle);
  ok(d && !isNaN(d.getTime()), 'payload: date_controle toujours une date ISO valide (jamais invalide)');

  console.log('\n══════════════════════════════════════');
  console.log('ROUND 6 (signatures + payload) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
