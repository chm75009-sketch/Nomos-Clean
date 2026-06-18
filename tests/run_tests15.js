'use strict';
const { loadApp, makeEl } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
const KEY = 'haccp_enceintes_config';

(async function main() {
  // ════════════ A) CONFIG ENCEINTES — lecture robuste ════════════
  ctx.localStorage.clear();
  ctx.localStorage.setItem(KEY, JSON.stringify([{ nom: 'Frigo A', type: 'froid', seuil: 4 }, { nom: 'Congel', type: 'congel', seuil: -18 }]));
  ok(ctx.getEnceintesConfig().length === 2, 'enceintes: lit la config');
  ctx.localStorage.setItem(KEY, '{json cassé');
  ok(Array.isArray(ctx.getEnceintesConfig()) && ctx.getEnceintesConfig().length === 0, 'enceintes: JSON corrompu -> [] (pas de plantage)');
  ctx.localStorage.setItem(KEY, '"pas un tableau"');
  ok(ctx.getEnceintesConfig().length === 0, 'enceintes: non-tableau -> []');
  // auto-nettoyage des demi-emojis
  ctx.localStorage.setItem(KEY, JSON.stringify([{ nom: 'Frigo\uD83D', type: 'froid', seuil: 4 }]));
  ok(ctx.getEnceintesConfig()[0].nom === 'Frigo', 'enceintes: demi-emoji nettoyé à la lecture');

  // ════════════ B) PUSH CLOUD — anti-écrasement + payload cloisonné ════════════
  let captured = null;
  ctx.fetch = function (url, opts) { captured = { url: url, body: JSON.parse((opts && opts.body) || '{}') }; return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(''); } }); };
  ctx.window.fetch = ctx.fetch;
  ctx.ETAB_ID = 'etabA';

  // B1 — config vide : ne JAMAIS pousser (écraserait une config valide ailleurs)
  ctx.localStorage.setItem(KEY, JSON.stringify([]));
  captured = null;
  let r = await ctx.pushEncCfgCloud();
  ok(r && r.ok === false && captured === null, 'enceintes: config vide -> AUCUN envoi (anti-écrasement)');

  // B2 — config non vide : envoi cloisonné, module réservé
  ctx.localStorage.setItem(KEY, JSON.stringify([{ nom: 'Frigo', type: 'froid', seuil: 4 }]));
  captured = null;
  r = await ctx.pushEncCfgCloud();
  ok(r && r.ok === true, 'enceintes: config non vide -> envoi');
  ok(captured && captured.body.code_client === 'etabA', 'enceintes: payload cloisonné (code_client)');
  ok(captured && captured.body.module === ctx.ENCEINTES_CFG_MODULE, 'enceintes: module réservé __enceintes_config__');
  ok(captured && Array.isArray(captured.body.contenu.enceintes) && captured.body.contenu.enceintes.length === 1, 'enceintes: contenu = liste des enceintes');
  ok(captured && /^__.*__$/.test(captured.body.module), 'enceintes: module exclu des rapports (préfixe __)');

  // B3 — non connecté : aucun envoi
  ctx.ETAB_ID = null; captured = null;
  r = await ctx.pushEncCfgCloud();
  ok(r && r.ok === false && captured === null, 'enceintes: non connecté -> aucun envoi');

  // ════════════ C) INSCRIPTION — validation du formulaire (porte d'entrée) ════════════
  let inserted = null;
  ctx._restInsert = function (table, rows) { inserted = { table: table, rows: rows }; return Promise.resolve({ ok: true }); };
  function form(over) {
    over = over || {};
    for (const k of Object.keys(doc._registry)) delete doc._registry[k];
    function f(id, v) { const e = makeEl('input'); e.id = id; e.value = v; doc._registry[id] = e; return e; }
    const rgpd = f('insc_rgpd', ''); rgpd.checked = over.rgpd !== undefined ? over.rgpd : true;
    f('insc_etab', over.etab !== undefined ? over.etab : 'Mon Resto');
    f('insc_resp', over.resp !== undefined ? over.resp : 'Jean Chef');
    f('insc_email', over.email !== undefined ? over.email : 'jean@resto.fr');
    f('insc_secteur', 'resto_trad'); f('insc_repas', '120'); f('insc_tel', '0600000000');
    f('insc_formule', 'Standard'); f('insc_engagement', 'Annuel'); f('insc_adresse', '1 rue X');
    f('insc_siret', '12345678900011'); f('insc_message', 'Bonjour');
    f('btnSubmitInscription', ''); f('inscriptionStatus', '');
  }
  const ev = { preventDefault: function () {} };

  // C1 — RGPD non coché -> bloqué
  form({ rgpd: false }); inserted = null;
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted === null, 'inscription: RGPD non coché -> aucune demande envoyée');
  ok(/RGPD|confidentialit/i.test(doc._registry['inscriptionStatus'].textContent), 'inscription: message RGPD affiché');

  // C2 — champ essentiel manquant -> bloqué
  form({ etab: '' }); inserted = null;
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted === null, 'inscription: établissement manquant -> bloqué');

  // C3 — formulaire complet -> demande envoyée
  form({}); inserted = null;
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted && inserted.table === 'demandes_inscription', 'inscription: complète -> insertion dans demandes_inscription');
  ok(inserted && inserted.rows.etablissement === 'Mon Resto' && inserted.rows.statut === 'en_attente', 'inscription: données correctes (statut en_attente)');
  ok(inserted && inserted.rows.secteur === 'resto_trad' && inserted.rows.email === 'jean@resto.fr', 'inscription: secteur + e-mail transmis');
  ok(/envoyée/i.test(doc._registry['inscriptionStatus'].textContent), 'inscription: confirmation affichée');

  // C4 — SIRET invalide (5 chiffres) -> bloqué
  form({}); inserted = null; doc._registry['insc_siret'].value = '12345';
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted === null, 'inscription: SIRET invalide (5 chiffres) -> bloqué');
  ok(/SIRET/i.test(doc._registry['inscriptionStatus'].textContent), 'inscription: message SIRET affiché');

  // C5 — SIRET 14 chiffres avec espaces -> accepté (format toléré)
  form({}); inserted = null; doc._registry['insc_siret'].value = '123 456 789 00011';
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted && inserted.table === 'demandes_inscription', 'inscription: SIRET 14 chiffres avec espaces -> accepté');

  // C5b — SIREN 9 chiffres -> accepté
  form({}); inserted = null; doc._registry['insc_siret'].value = '123456789';
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted && inserted.table === 'demandes_inscription', 'inscription: SIREN 9 chiffres -> accepté');

  // C6 — téléphone trop court -> bloqué
  form({}); inserted = null; doc._registry['insc_tel'].value = '12345';
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted === null, 'inscription: téléphone trop court -> bloqué');
  ok(/[Tt]éléphone/.test(doc._registry['inscriptionStatus'].textContent), 'inscription: message téléphone affiché');

  // C7 — téléphone international (+33 ...) -> accepté
  form({}); inserted = null; doc._registry['insc_tel'].value = '+33 6 12 34 56 78';
  ctx.window.submitInscriptionHaccp(ev);
  await new Promise(function (res) { setImmediate(res); });
  ok(inserted && inserted.table === 'demandes_inscription', 'inscription: téléphone international toléré');


  console.log('\n══════════════════════════════════════');
  console.log('ROUND 15 (config enceintes + inscription) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
