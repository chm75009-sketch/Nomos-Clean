'use strict';
const H = require('./harness.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }
function flush() { return new Promise(function (res) { let n = 0; (function t() { if (++n > 40) return res(); setImmediate(t); })(); }); }

function env(opts) {
  opts = opts || {};
  const db = H.makeDB();
  (opts.demandes || []).forEach(function (r) { db.demandes_inscription.push(r); });
  (opts.historique || []).forEach(function (r) { db.historique_admin.push(r); });
  (opts.clients || []).forEach(function (r) { db.comptes_clients.push(r); });
  const doc = H.makeDocument(); const alerts = [];
  const win = { _supabase: H.makeSupabase(db, { adminPwd: opts.adminPwd || 'secret' }), HACCP_CONFIG: {}, emailjs: null };
  const e = {
    window: win, document: doc,
    alert: function (m) { alerts.push(String(m)); }, confirm: function () { return opts.confirm !== undefined ? opts.confirm : true; },
    prompt: function () { return opts.prompt !== undefined ? opts.prompt : null; },
    lsSet: function () {}, lsGet: function () { return null; }, lsRemove: function () {},
    _scrollHaut: function () {}, showPage: function () { e._showed = true; }, APP_BUILD: 'v194', renderEuCampagne: function () {},
    console: { log: function () {}, warn: function () {}, error: function () {}, info: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (_) {} return 0; }
  };
  const m = H.buildModule(e);
  return { db: db, doc: doc, alerts: alerts, win: win, mod: m, env: e };
}
function dom(doc) {
  ['adminPwd', 'adminLoginBox', 'adminDashboard', 'adminLoginErr', 'adminVersion', 'adminContent',
   'cntDemandes', 'cntClients', 'tabDemandes', 'tabClients', 'tabHistorique', 'tabEssais'].forEach(function (id) {
    const el = H.makeEl('div'); el.id = id; el.style = {}; doc._registry[id] = el;
  });
}

(async function () {
  // ════════════ A) CONNEXION ADMIN ════════════
  { // mauvais mot de passe -> refusé
    const t = env({ adminPwd: 'secret123' }); dom(t.doc);
    t.doc._registry['adminPwd'].value = 'mauvais';
    t.mod.loginAdmin(); await flush();
    ok(t.doc._registry['adminLoginErr'].style.display === 'block', 'admin login: mauvais mot de passe -> erreur affichée');
    ok(t.doc._registry['adminDashboard'].style.display !== 'block', 'admin login: tableau de bord NON affiché');
  }
  { // bon mot de passe -> tableau de bord
    const t = env({ adminPwd: 'secret123', demandes: [] }); dom(t.doc);
    t.doc._registry['adminPwd'].value = 'secret123';
    t.mod.loginAdmin(); await flush();
    ok(t.doc._registry['adminDashboard'].style.display === 'block', 'admin login: bon mot de passe -> tableau de bord affiché');
    ok(t.doc._registry['adminLoginBox'].style.display === 'none', 'admin login: écran de saisie masqué');
    ok(t.doc._registry['adminVersion'].textContent === 'v194', 'admin login: version affichée');
  }
  // ════════════ B) DÉCONNEXION ADMIN ════════════
  {
    const t = env(); dom(t.doc);
    t.mod.logoutAdmin();
    ok(t.doc._registry['adminDashboard'].style.display === 'none', 'admin logout: tableau de bord masqué');
    ok(t.doc._registry['adminLoginBox'].style.display === 'block', 'admin logout: écran de saisie réaffiché');
    ok(t.env._showed === true, 'admin logout: retour à une page (présentation)');
  }
  // ════════════ C) ONGLETS ADMIN ════════════
  {
    const t = env({ demandes: [], clients: [], historique: [] }); dom(t.doc);
    let threw = false;
    for (const tab of ['demandes', 'clients', 'historique', 'essais']) {
      try { t.mod.adminTab(tab); await flush(); } catch (e) { threw = true; }
    }
    ok(!threw, 'admin onglets: les 4 onglets se chargent sans erreur');
  }
  // ════════════ D) DEMANDES D'INSCRIPTION ════════════
  {
    const t = env({
      demandes: [
        { id: 'd1', etablissement: 'Resto A', responsable: 'Bob', email: 'a@a.fr', telephone: '06', secteur: 'resto_trad', formule: 'Std', engagement: 'Annuel', statut: 'en_attente', date_demande: '2026-06-01' },
        { id: 'd2', etablissement: 'Resto B', responsable: 'Alice', email: 'b@b.fr', telephone: '07', secteur: 'boulangerie', formule: 'Std', engagement: 'Mensuel', statut: 'validee', code_genere: 'HACCP-XXXXX-2026', date_demande: '2026-05-01' },
        { id: 'd3', etablissement: 'Resto C', responsable: 'Carl', email: 'c@c.fr', telephone: '08', secteur: 'resto_trad', formule: 'Std', engagement: 'Annuel', statut: 'refusee', date_demande: '2026-04-01' }
      ]
    });
    dom(t.doc);
    t.mod.loadAdminDemandes(); await flush();
    const h = t.doc._registry['adminContent'].innerHTML;
    ok(/Resto A/.test(h) && /Resto B/.test(h) && /Resto C/.test(h), 'demandes: les 3 demandes affichées');
    ok(t.doc._registry['cntDemandes'].textContent === 1, 'demandes: compteur = 1 en attente');
    ok(/validerDemande\('d1'\)/.test(h) && /refuserDemande\('d1'\)/.test(h), 'demandes: boutons Valider/Refuser sur la demande en attente');
    ok(!/validerDemande\('d2'\)/.test(h), 'demandes: pas de bouton Valider sur une demande déjà validée');
    ok(/EN ATTENTE/.test(h) && /VALIDÉE/.test(h) && /REFUSÉE/.test(h), 'demandes: les 3 statuts affichés');
  }
  // ════════════ E) REFUSER UNE DEMANDE ════════════
  {
    const t = env({ prompt: 'Hors zone', demandes: [{ id: 'd1', etablissement: 'X', statut: 'en_attente', date_demande: '2026-06-01' }] });
    dom(t.doc);
    t.mod.refuserDemande('d1'); await flush();
    ok(t.db.demandes_inscription[0].statut === 'refusee', 'refuser: statut passé à refusée');
    ok(t.db.historique_admin.some(function (x) { return /Refus/.test(x.action); }), 'refuser: tracé dans l\'historique');
  }
  { // refus annulé (prompt null) -> pas de changement
    const t = env({ prompt: null, demandes: [{ id: 'd1', etablissement: 'X', statut: 'en_attente', date_demande: '2026-06-01' }] });
    dom(t.doc);
    t.mod.refuserDemande('d1'); await flush();
    ok(t.db.demandes_inscription[0].statut === 'en_attente', 'refuser: annulation (prompt vide) -> aucun changement');
  }
  // ════════════ F) HISTORIQUE ADMIN ════════════
  {
    const t = env({ historique: [
      { id: 'h1', action: 'Validation demande', code_concerne: 'HACCP-AAAAA-2026', motif: 'Resto A', date_action: '2026-06-01T10:00:00Z' },
      { id: 'h2', action: 'Désactivation client', code_concerne: 'HACCP-BBBBB-2026', motif: 'Non paiement', date_action: '2026-06-02T11:00:00Z' }
    ] });
    dom(t.doc);
    t.mod.loadAdminHistorique(); await flush();
    const h = t.doc._registry['adminContent'].innerHTML;
    ok(/Validation demande/.test(h) && /Désactivation client/.test(h), 'historique: actions affichées');
    ok(/HACCP-AAAAA-2026/.test(h) && /Non paiement/.test(h), 'historique: codes et motifs affichés');
  }
  { // historique vide
    const t = env({ historique: [] }); dom(t.doc);
    t.mod.loadAdminHistorique(); await flush();
    ok(/Aucune action/.test(t.doc._registry['adminContent'].innerHTML), 'historique: vide -> message adapté');
  }

  console.log('\n══════════════════════════════════════');
  console.log('ROUND 25 (panneau admin complet) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('CRASH:', e); process.exit(2); });
