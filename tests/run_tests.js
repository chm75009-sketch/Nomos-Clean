'use strict';
const H = require('./harness.js');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name) { if (cond) { pass++; } else { fail++; failures.push(name); console.log('  ✗ FAIL: ' + name); } }
function flush() { return new Promise(function (res) { let n = 0; (function tick() { if (++n > 50) return res(); setImmediate(tick); })(); }); }

// Build a fresh environment for each scenario
function env(opts) {
  opts = opts || {};
  const db = H.makeDB();
  const doc = H.makeDocument();
  const alerts = [], confirms = (opts.confirms || []).slice(), prompts = (opts.prompts || []).slice();
  const win = {
    _supabase: H.makeSupabase(db, opts.config || {}),
    HACCP_CONFIG: { ADMIN_PASSWORD: 'x', EMAILJS_PUBLIC_KEY: '', EMAILJS_TEMPLATE_CLIENT: '', EMAILJS_SERVICE: '' },
    emailjs: null
  };
  const e = {
    window: win, document: doc,
    alert: function (m) { alerts.push(String(m)); },
    confirm: function () { return confirms.length ? confirms.shift() : false; },
    prompt: function () { return prompts.length ? prompts.shift() : null; },
    lsSet: function () {}, lsGet: function () { return null; }, lsRemove: function () {},
    _scrollHaut: function () {}, showPage: function () {},
    APP_BUILD: 'v147', renderEuCampagne: function () {}, console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; }
  };
  const mod = H.buildModule(e);
  return { db, doc, alerts, win, e, mod };
}

function setInputs(doc, map) { Object.keys(map).forEach(function (id) { (doc._registry[id] || doc._add(id)).value = map[id]; }); }
function seedClient(db, over) {
  const c = Object.assign({ id: H.uid(), code_acces: 'HACCP-AAAAA-2026', etablissement: 'Resto A', email: 'a@a.fr', formule: 'Standard', engagement: 'Annuel', date_debut: '2026-01-01', actif: true }, over || {});
  db.comptes_clients.push(c);
  db.etablissements.push({ id: H.uid(), code_acces: c.code_acces, mot_de_passe: '123456', nom: c.etablissement, secteur: 'resto', adresse: '', actif: true, date_debut: c.date_debut, date_expiration: '2027-01-01' });
  return c;
}

(async function main() {
  // ═══════════════ CREATE ═══════════════
  {
    const t = env();
    t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: 'Le Bistrot', nc_resp: 'Jean', nc_tel: '0600', nc_email: 'j@b.fr', nc_adresse: '1 rue', nc_secteur: 'resto', nc_duree: '12' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 1, 'create: 1 etablissement');
    ok(t.db.comptes_clients.length === 1, 'create: 1 compte_client');
    const et = t.db.etablissements[0];
    ok(/^HACCP-[A-Z2-9]{5}-\d{4}$/.test(et.code_acces), 'create: code format HACCP');
    ok(et.secteur === 'resto', 'create: secteur stored');
    ok(et.responsable === 'Jean' && et.telephone === '0600', 'create: contact stored on etab');
    ok(/^\d{6}$/.test(et.mot_de_passe), 'create: 6-digit pwd');
    ok(t.db.comptes_clients[0].engagement === 'Annuel', 'create: engagement Annuel for 12m');
    ok(t.db.historique_admin.length === 1, 'create: history traced');
    ok(t.alerts.some(function (a) { return /Client cr/.test(a); }), 'create: success alert');
    const y = new Date(et.date_expiration).getFullYear();
    ok(y === new Date().getFullYear() + 1, 'create: exp ~+1 year');
  }
  { const t = env(); t.doc._add('adminContent');
    setInputs(t.doc, { nc_etab: '', nc_email: 'j@b.fr', nc_secteur: 'resto' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 0 && /minimum/.test(t.alerts[0] || ''), 'create: missing etab blocked'); }
  { const t = env(); t.doc._add('adminContent');
    setInputs(t.doc, { nc_etab: 'X', nc_email: '', nc_secteur: 'resto' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 0, 'create: missing email blocked'); }
  { const t = env(); t.doc._add('adminContent');
    setInputs(t.doc, { nc_etab: 'X', nc_email: 'j@b.fr', nc_secteur: '' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 0 && t.alerts.some(function (a){return /SECTEUR/.test(a);}), 'create: missing secteur blocked'); }
  { const t = env(); t.doc._add('adminContent');
    setInputs(t.doc, { nc_etab: '   ', nc_email: 'j@b.fr', nc_secteur: 'resto' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 0, 'create: whitespace-only etab blocked'); }
  { const t = env({ config: { rejectEtabContactCols: true } }); t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: 'Sans cols', nc_resp: 'Jean', nc_tel: '06', nc_email: 'j@b.fr', nc_adresse: 'a', nc_secteur: 'bp', nc_duree: '12' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 1, 'create-fallback: etab inserted without contact cols');
    ok(!('responsable' in t.db.etablissements[0]), 'create-fallback: no responsable col');
    ok(t.db.comptes_clients.length === 1, 'create-fallback: compte still created');
    ok(t.alerts.some(function (a){return /Client cr/.test(a);}), 'create-fallback: success'); }
  { const t = env({ config: { failComptesInsert: true } }); t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: 'Compte KO', nc_email: 'j@b.fr', nc_secteur: 'resto', nc_duree: '12' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements.length === 1, 'create-compteKO: etab (login) still created');
    ok(t.alerts.some(function (a){return /erreur fiche/i.test(a);}), 'create-compteKO: warns fiche error'); }
  { const t = env(); t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: 'Deux ans', nc_email: 'j@b.fr', nc_secteur: 'resto', nc_duree: '24' });
    t.mod.creerClientDirect(); await flush();
    const y = new Date(t.db.etablissements[0].date_expiration).getFullYear();
    ok(y === new Date().getFullYear() + 2, 'create: 24m -> +2 years'); }
  { const t = env(); t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: 'Trim', nc_email: 'j@b.fr', nc_secteur: 'rapide', nc_duree: '3' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.comptes_clients[0].engagement === 'Mensuel', 'create: 3m -> Mensuel'); }
  { const t = env(); t.doc._add('adminContent'); t.doc._add('btnCreerClient');
    setInputs(t.doc, { nc_etab: "L'Auberge d'O'Brien <b>", nc_email: 'j@b.fr', nc_secteur: 'boucherie', nc_duree: '12' });
    t.mod.creerClientDirect(); await flush();
    ok(t.db.etablissements[0].nom === "L'Auberge d'O'Brien <b>", 'create: special chars stored raw');
    ok(t.db.etablissements[0].secteur === 'boucherie', 'create: boucherie secteur'); }

  // ═══════════════ MODIFY ═══════════════
  { const t = env({ prompts: ['Nouveau Nom', 'bp', ''] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    const et = t.db.etablissements[0];
    ok(et.nom === 'Nouveau Nom' && et.secteur === 'bp', 'modify: nom+secteur updated');
    ok(et.mot_de_passe === '123456', 'modify: pwd unchanged when empty');
    ok(t.db.comptes_clients[0].etablissement === 'Nouveau Nom', 'modify: comptes synced'); }
  { const t = env({ prompts: ['Nom', 'PIZZA', ''] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].secteur === 'resto' && t.alerts.some(function(a){return /invalide/.test(a);}), 'modify: invalid secteur blocked'); }
  { const t = env({ prompts: ['', 'bp', ''] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].nom === 'Resto A' && t.alerts.some(function(a){return /vide/.test(a);}), 'modify: empty name blocked'); }
  { const t = env({ prompts: [null] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].nom === 'Resto A', 'modify: cancel name -> no-op'); }
  { const t = env({ prompts: ['Nom', null] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].nom === 'Resto A', 'modify: cancel secteur -> no-op'); }
  { const t = env({ prompts: ['Nom', 'collective', '999999'] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].mot_de_passe === '999999', 'modify: new pwd applied'); }
  { const t = env({ prompts: ['Nom', 'RESTO', ''] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].secteur === 'resto', 'modify: uppercase secteur lowercased'); }
  { const t = env({ prompts: ['Nom', 'bp', ''] });
    t.mod.modifierClient('HACCP-ZZZZZ-2026'); await flush();
    ok(t.alerts.some(function(a){return /introuvable/.test(a);}), 'modify: unknown code -> introuvable'); }
  { const t = env({ prompts: ['Nom', 'bp', '   '] }); seedClient(t.db);
    t.mod.modifierClient('HACCP-AAAAA-2026'); await flush();
    ok(t.db.etablissements[0].mot_de_passe === '123456', 'modify: whitespace pwd -> unchanged'); }

  // ═══════════════ DELETE single ═══════════════
  { const t = env({ confirms: [true, true] }); seedClient(t.db); const c = t.db.comptes_clients[0];
    t.mod.supprimerClient(c.id, c.code_acces, c.etablissement); await flush();
    ok(t.db.comptes_clients.length === 0 && t.db.etablissements.length === 0, 'delete: both tables purged'); }
  { const t = env({ confirms: [false] }); seedClient(t.db); const c = t.db.comptes_clients[0];
    t.mod.supprimerClient(c.id, c.code_acces, c.etablissement); await flush();
    ok(t.db.comptes_clients.length === 1, 'delete: first confirm no -> keep'); }
  { const t = env({ confirms: [true, false] }); seedClient(t.db); const c = t.db.comptes_clients[0];
    t.mod.supprimerClient(c.id, c.code_acces, c.etablissement); await flush();
    ok(t.db.comptes_clients.length === 1, 'delete: second confirm no -> keep'); }

  // ═══════════════ SELECTION helpers ═══════════════
  function setupCheckboxes(t, clients, checkedIdx) {
    const cbs = clients.map(function (c, i) {
      const el = H.makeEl('cb' + i); el.checked = checkedIdx.indexOf(i) !== -1;
      el.setAttribute('data-id', c.id); el.setAttribute('data-code', c.code_acces); el.setAttribute('data-nom', c.etablissement);
      el.getAttribute = function (k) { return this._attrs[k]; };
      return el;
    });
    t.doc._setCheckboxes(cbs);
    t.doc._add('cntSelClients'); t.doc._add('chkTousClients');
    return cbs;
  }
  { const t = env(); const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    const c2 = seedClient(t.db, { code_acces: 'HACCP-BBBBB-2026', etablissement: 'B' });
    setupCheckboxes(t, [c1, c2], [0]);
    t.mod.majCompteurSelClients();
    ok(t.doc._registry['cntSelClients'].textContent === 1, 'sel: count reflects 1 checked');
    ok(t.doc._registry['chkTousClients'].checked === false, 'sel: chkTous unchecked when partial'); }
  { const t = env(); const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    const c2 = seedClient(t.db, { code_acces: 'HACCP-BBBBB-2026', etablissement: 'B' });
    const cbs = setupCheckboxes(t, [c1, c2], []);
    t.mod.toggleTousClients({ checked: true });
    ok(cbs[0].checked && cbs[1].checked, 'sel: toggleAll checks all');
    ok(t.doc._registry['cntSelClients'].textContent === 2, 'sel: count = 2 after toggleAll'); }

  // ═══════════════ BULK delete selection ═══════════════
  { const t = env(); seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    setupCheckboxes(t, t.db.comptes_clients.slice(), []);
    t.mod.supprimerSelectionClients(); await flush();
    ok(t.alerts.some(function(a){return /Aucun client/.test(a);}) && t.db.comptes_clients.length === 1, 'bulk-sel: none selected -> alert, no delete'); }
  { const t = env({ confirms: [true, true] });
    const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    const c2 = seedClient(t.db, { code_acces: 'HACCP-BBBBB-2026', etablissement: 'B' });
    const c3 = seedClient(t.db, { code_acces: 'HACCP-CCCCC-2026', etablissement: 'C' });
    setupCheckboxes(t, [c1, c2, c3], [0, 2]);
    t.mod.supprimerSelectionClients(); await flush();
    ok(t.db.comptes_clients.length === 1 && t.db.comptes_clients[0].code_acces === 'HACCP-BBBBB-2026', 'bulk-sel: only selected deleted (B remains)');
    ok(t.db.etablissements.length === 1 && t.db.etablissements[0].code_acces === 'HACCP-BBBBB-2026', 'bulk-sel: etab synced'); }
  { const t = env({ confirms: [true, false] });
    const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    setupCheckboxes(t, [c1], [0]);
    t.mod.supprimerSelectionClients(); await flush();
    ok(t.db.comptes_clients.length === 1, 'bulk-sel: 2nd confirm no -> keep'); }

  // ═══════════════ BULK delete ALL ═══════════════
  { const t = env({ confirms: [true], prompts: ['SUPPRIMER'] });
    const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: 'A' });
    const c2 = seedClient(t.db, { code_acces: 'HACCP-BBBBB-2026', etablissement: 'B' });
    setupCheckboxes(t, [c1, c2], []);
    t.mod.supprimerTousClients(); await flush();
    ok(t.db.comptes_clients.length === 0 && t.db.etablissements.length === 0, 'bulk-all: typed SUPPRIMER -> all purged'); }
  { const t = env({ confirms: [true], prompts: ['supprimer'] });
    const c1 = seedClient(t.db); setupCheckboxes(t, [c1], []);
    t.mod.supprimerTousClients(); await flush();
    ok(t.db.comptes_clients.length === 0, 'bulk-all: lowercase "supprimer" accepted (case-insensitive, intended)'); }
  { const t = env({ confirms: [true], prompts: ['NOPE'] });
    const c1 = seedClient(t.db); setupCheckboxes(t, [c1], []);
    t.mod.supprimerTousClients(); await flush();
    ok(t.db.comptes_clients.length === 1 && t.alerts.some(function(a){return /Annul/.test(a);}), 'bulk-all: wrong text -> annulé'); }
  { const t = env({ confirms: [true], prompts: [null] });
    const c1 = seedClient(t.db); setupCheckboxes(t, [c1], []);
    t.mod.supprimerTousClients(); await flush();
    ok(t.db.comptes_clients.length === 1, 'bulk-all: cancel prompt -> no-op'); }
  { const t = env({ confirms: [false] });
    const c1 = seedClient(t.db); setupCheckboxes(t, [c1], []);
    t.mod.supprimerTousClients(); await flush();
    ok(t.db.comptes_clients.length === 1, 'bulk-all: confirm no -> no-op'); }
  { const t = env({ confirms: [true], prompts: ['SUPPRIMER'] });
    t.doc._setCheckboxes([]);
    t.mod.supprimerTousClients(); await flush();
    ok(t.alerts.some(function(a){return /Aucun client/.test(a);}), 'bulk-all: empty list -> alert'); }

  // ═══════════════ DESACTIVER / REACTIVER / PROLONGER ═══════════════
  { const t = env({ prompts: ['Non paiement'] }); const c = seedClient(t.db);
    t.mod.desactiverClient(c.id, c.code_acces); await flush();
    ok(t.db.comptes_clients[0].actif === false && t.db.etablissements[0].actif === false, 'desactiver: both inactive'); }
  { const t = env({ prompts: [null] }); const c = seedClient(t.db);
    t.mod.desactiverClient(c.id, c.code_acces); await flush();
    ok(t.db.comptes_clients[0].actif === true, 'desactiver: cancel -> no-op'); }
  { const t = env({ confirms: [true] }); const c = seedClient(t.db, { actif: false });
    t.db.etablissements[0].actif = false;
    t.mod.reactiverClient(c.id, c.code_acces); await flush();
    ok(t.db.comptes_clients[0].actif === true && t.db.etablissements[0].actif === true, 'reactiver: both active'); }
  { const t = env({ prompts: ['6'] }); const c = seedClient(t.db);
    t.mod.prolongerClient(c.code_acces); await flush();
    const exp = new Date(t.db.etablissements[0].date_expiration); const now = new Date(); now.setMonth(now.getMonth() + 6);
    ok(Math.abs(exp - now) < 3 * 86400000, 'prolonger: +6 months exp'); }
  { const t = env({ prompts: ['abc'] }); const c = seedClient(t.db);
    t.mod.prolongerClient(c.code_acces); await flush();
    ok(t.alerts.some(function(a){return /invalide/.test(a);}), 'prolonger: invalid number -> alert'); }

  // ═══════════════ VALIDER / REFUSER demande ═══════════════
  function seedDemande(db, secteur) {
    const d = { id: H.uid(), etablissement: 'Demande X', email: 'd@x.fr', responsable: 'Bob', telephone: '06', adresse: 'rue', siret: '123', formule: 'Std', engagement: 'Annuel', secteur: secteur, statut: 'en_attente' };
    db.demandes_inscription.push(d); return d;
  }
  const secMap = { resto_trad: 'resto', boulangerie: 'bp', fast_food: 'rapide', boucherie: 'boucherie', collective: 'collective' };
  for (const k of Object.keys(secMap)) {
    const t = env({ confirms: [true] }); const d = seedDemande(t.db, k);
    t.mod.validerDemande(d.id); await flush();
    ok(t.db.etablissements.length === 1 && t.db.etablissements[0].secteur === secMap[k], 'valider: secteur map ' + k + '->' + secMap[k]);
  }
  { const t = env({ confirms: [true] }); const d = seedDemande(t.db, 'inconnu');
    t.mod.validerDemande(d.id); await flush();
    ok(t.db.etablissements[0].secteur === 'resto', 'valider: unknown secteur -> resto default');
    ok(t.db.comptes_clients.length === 1 && t.db.demandes_inscription[0].statut === 'validee', 'valider: compte created + demande validee'); }
  { const t = env({ prompts: ['doublon'] }); const d = seedDemande(t.db, 'resto_trad');
    t.mod.refuserDemande(d.id); await flush();
    ok(t.db.demandes_inscription[0].statut === 'refusee', 'refuser: statut refusee'); }

  // ═══════════════ RENDER loadAdminClients ═══════════════
  { const t = env(); const c1 = seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: "O'Brien <x>", email: 'a@a.fr', actif: true });
    const c2 = seedClient(t.db, { code_acces: 'HACCP-BBBBB-2026', etablissement: 'B', actif: false });
    const cont = t.doc._add('adminContent'); t.doc._add('cntClients');
    t.mod.loadAdminClients(); await flush();
    const h = cont.innerHTML;
    ok(/Cr.{0,3}er un compte client/.test(h), 'render: create form present');
    ok(/Tout s.{0,3}lectionner/.test(h), 'render: bulk bar present');
    ok((h.match(/class="chkClient"/g) || []).length === 2, 'render: 2 checkboxes');
    ok(/data-nom="O&#39;Brien &lt;x&gt;"/.test(h), 'render: name escaped in data attr');
    ok(/id="cntSelClients"/.test(h) && /\/2 s.{0,3}lectionn/.test(h), 'render: total shown in selection counter (/2)');
    ok(t.doc._registry['cntClients'].textContent === 1, 'render: cntClients = active count (1)');
    ok(/✏️ Modifier/.test(h) && /🗑️ Supprimer/.test(h), 'render: per-client buttons'); }
  { const t = env(); const cont = t.doc._add('adminContent'); t.doc._add('cntClients');
    t.mod.loadAdminClients(); await flush();
    ok(/Aucun client/.test(cont.innerHTML) && /Cr.{0,3}er un compte client/.test(cont.innerHTML), 'render: empty -> form + aucun'); }

  // ═══════════════ attrJs (apostrophe / injection safety in onclick) ═══════════════
  function decodeHtml(s) { return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
  function onclickParses(jsAfterDecode) { try { new Function('supprimerClient', jsAfterDecode); return true; } catch (e) { return false; } }
  ['Chez L\'Ami', 'O\'Tacos', 'A & B "Resto" <x>', "',alert(1),'", 'Back\\slash', 'Normal Name'].forEach(function (nom) {
    const t = env();
    const onclick = 'supprimerClient(\'' + t.mod.attrJs('id1') + '\',\'' + t.mod.attrJs('HACCP-AAAAA-2026') + '\',\'' + t.mod.attrJs(nom) + '\')';
    const decoded = decodeHtml(onclick);
    ok(onclickParses(decoded), 'attrJs: onclick valid for name ' + JSON.stringify(nom));
    // and confirm the decoded literal round-trips to the original name (no injection / no truncation)
    let captured = null;
    try { new Function('supprimerClient', decoded)(function (a, b, c) { captured = c; }); } catch (e) {}
    ok(captured === nom, 'attrJs: name round-trips exactly for ' + JSON.stringify(nom));
  });
  { // full render path with apostrophe name -> button onclick must parse
    const t = env(); seedClient(t.db, { code_acces: 'HACCP-AAAAA-2026', etablissement: "Chez L'Ami <b>" });
    const cont = t.doc._add('adminContent'); t.doc._add('cntClients');
    t.mod.loadAdminClients(); await flush();
    const h = cont.innerHTML; const i = h.indexOf('supprimerClient(');
    const oc = decodeHtml(h.slice(i, h.indexOf(')"', i) + 1));
    ok(onclickParses(oc), 'render: delete onclick parses with apostrophe name'); }

  // ═══════════════ generators ═══════════════
  { const t = env(); let bad = 0, codes = {};
    for (let i = 0; i < 5000; i++) { const c = t.mod.genererCodeAcces(); if (!/^HACCP-[A-HJ-NP-Z2-9]{5}-\d{4}$/.test(c)) bad++; codes[c] = (codes[c] || 0) + 1; }
    ok(bad === 0, 'gen: 5000 codes all valid format (no I/O/0/1)');
    const dups = Object.keys(codes).filter(function (k) { return codes[k] > 1; }).length;
    ok(dups < 50, 'gen: collisions rare in 5000 (' + dups + ')');
    let badp = 0; for (let i = 0; i < 2000; i++) { if (!/^\d{6}$/.test(t.mod.genererMotDePasse())) badp++; }
    ok(badp === 0, 'gen: 2000 passwords all 6 digits'); }

  console.log('\n══════════════════════════════════════');
  console.log('RESULTS: ' + pass + ' passed, ' + fail + ' failed');
  if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('══════════════════════════════════════');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('HARNESS CRASH:', e); process.exit(2); });
