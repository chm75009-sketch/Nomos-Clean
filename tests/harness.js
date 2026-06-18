'use strict';
const fs = require('fs');
const path = require('path');
// Extrait dynamiquement le bloc « gestion admin/clients » depuis script.js,
// entre genererCodeAcces() et updateTopbarEtab() — robuste aux décalages de lignes.
const _full = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const _start = _full.indexOf('function genererCodeAcces()');
const _end = _full.indexOf('window.updateTopbarEtab = function');
if (_start < 0 || _end < 0 || _end <= _start) { throw new Error('Bloc admin introuvable dans script.js (marqueurs déplacés ?)'); }
const BLOCK = _full.slice(_start, _end);

// ───────────────────────── Fake in-memory Supabase ─────────────────────────
function makeDB() {
  return { comptes_clients: [], etablissements: [], historique_admin: [], demandes_inscription: [] };
}
let _uid = 1;
function uid() { return 'uuid-' + (_uid++); }

// config.rejectEtabContactCols : simulate schema without responsable/telephone/email
function makeSupabase(db, config) {
  config = config || {};
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function matchOr(row, expr) {
    // expr like "code_acces.like.CLIENT-%,code_acces.like.ESSAI-%"
    return expr.split(',').some(function (part) {
      var m = part.split('.');
      var col = m[0], op = m[1], val = m.slice(2).join('.');
      if (op === 'like') {
        var rx = new RegExp('^' + val.replace(/%/g, '.*') + '$');
        return rx.test(String(row[col] || ''));
      }
      return false;
    });
  }
  function from(table) {
    var st = { table: table, op: null, cols: '*', filters: [], inFilter: null, patch: null, rows: null, single: false, orFilter: null };
    var b = {
      select: function (cols) { st.op = 'select'; st.cols = cols || '*'; return b; },
      insert: function (rows) { st.op = 'insert'; st.rows = clone(rows); return b; },
      update: function (patch) { st.op = 'update'; st.patch = clone(patch); return b; },
      delete: function () { st.op = 'delete'; return b; },
      eq: function (col, val) { st.filters.push([col, val]); return b; },
      in: function (col, arr) { st.inFilter = [col, arr.slice()]; return b; },
      like: function (col, val) { st.filters.push(['__like', [col, val]]); return b; },
      or: function (expr) { st.orFilter = expr; return b; },
      order: function () { return b; },
      limit: function (n) { st.limitN = n; return b; },
      single: function () { st.single = true; return b; },
      then: function (cb) { return Promise.resolve(exec(st, db, config)).then(cb); }
    };
    return b;
  }
  function rpc(name, params) {
    params = params || {};
    // admin_check : valide le mot de passe admin (simule la RPC serveur/Vault).
    if (name === 'admin_check') {
      var good = (config.adminPwd || 'secret');
      return Promise.resolve({ data: params.p_pwd === good, error: null });
    }
    // supervision_capteurs : mot de passe correct -> liste (vide ici), sinon refus silencieux.
    if (name === 'supervision_capteurs') {
      if (params.p_pwd !== (config.adminPwd || 'secret')) return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: (db.supervision_capteurs || []), error: null });
    }
    return Promise.resolve({ data: null, error: { message: 'no such rpc ' + name } });
  }
  return { from: from, rpc: rpc };
}

function exec(st, db, config) {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var T = db[st.table];
  if (!T) return { data: null, error: { message: 'no such table ' + st.table } };
  function applyFilters(rows) {
    var out = rows;
    st.filters.forEach(function (f) {
      if (f[0] === '__like') {
        var col = f[1][0], val = f[1][1];
        var rx = new RegExp('^' + val.replace(/%/g, '.*') + '$');
        out = out.filter(function (r) { return rx.test(String(r[col] || '')); });
      } else {
        out = out.filter(function (r) { return String(r[f[0]]) === String(f[1]); });
      }
    });
    if (st.inFilter) {
      var col = st.inFilter[0], arr = st.inFilter[1].map(String);
      out = out.filter(function (r) { return arr.indexOf(String(r[col])) !== -1; });
    }
    if (st.orFilter) out = out.filter(function (r) { return matchOrExpr(r, st.orFilter); });
    return out;
  }
  function matchOrExpr(row, expr) {
    return expr.split(',').some(function (part) {
      var m = part.split('.'); var col = m[0], op = m[1], val = m.slice(2).join('.');
      if (op === 'like') { var rx = new RegExp('^' + val.replace(/%/g, '.*') + '$'); return rx.test(String(row[col] || '')); }
      return false;
    });
  }
  try {
    if (st.op === 'select') {
      var rows = applyFilters(T).map(function (r) { return Object.assign({}, r); });
      if (st.limitN) rows = rows.slice(0, st.limitN);
      if (st.single) {
        if (rows.length !== 1) return { data: null, error: { message: 'single: ' + rows.length + ' rows' } };
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null };
    }
    if (st.op === 'insert') {
      // simulate missing-contact-columns schema
      if (st.table === 'etablissements' && config.rejectEtabContactCols) {
        var bad = st.rows.some(function (r) { return ('responsable' in r) || ('telephone' in r) || ('email' in r); });
        if (bad) return { data: null, error: { message: "Could not find the 'responsable' column of 'etablissements' in the schema cache (PGRST204)" } };
      }
      if (st.table === 'comptes_clients' && config.failComptesInsert) {
        return { data: null, error: { message: 'comptes_clients insert forced failure' } };
      }
      st.rows.forEach(function (r) { if (!r.id) r.id = uid(); T.push(Object.assign({}, r)); });
      return { data: clone(st.rows), error: null };
    }
    if (st.op === 'update') {
      var targets = applyFilters(T);
      targets.forEach(function (r) { Object.assign(r, st.patch); });
      return { data: clone(targets), error: null };
    }
    if (st.op === 'delete') {
      var toDel = applyFilters(T);
      var ids = new Set(toDel);
      for (var i = T.length - 1; i >= 0; i--) { if (ids.has(T[i])) T.splice(i, 1); }
      return { data: clone(toDel), error: null };
    }
  } catch (e) {
    return { data: null, error: { message: 'exec exception: ' + e.message } };
  }
  return { data: null, error: { message: 'unknown op' } };
}

// ───────────────────────── Fake DOM ─────────────────────────
function makeEl(id) {
  return {
    id: id, value: '', checked: false, textContent: '', innerHTML: '', disabled: false,
    style: {}, _attrs: {},
    getAttribute: function (k) { return this._attrs[k]; },
    setAttribute: function (k, v) { this._attrs[k] = v; }
  };
}
function makeDocument() {
  var registry = {};
  var checkboxes = [];
  return {
    _registry: registry,
    _checkboxes: checkboxes,
    getElementById: function (id) { return registry[id] || null; },
    querySelectorAll: function (sel) {
      if (sel === '.chkClient') return checkboxes.slice();
      return [];
    },
    _add: function (id) { return (registry[id] = makeEl(id)); },
    _setCheckboxes: function (arr) { checkboxes.length = 0; arr.forEach(function (c) { checkboxes.push(c); }); }
  };
}

// ───────────────────────── Build module ─────────────────────────
function buildModule(env) {
  const src =
    'return (function(){\n' +
    'var window=__env.window, document=__env.document, alert=__env.alert, confirm=__env.confirm, prompt=__env.prompt;\n' +
    'var lsSet=__env.lsSet, lsGet=__env.lsGet, lsRemove=__env.lsRemove, _scrollHaut=__env._scrollHaut, showPage=__env.showPage;\n' +
    'var APP_BUILD=__env.APP_BUILD, renderEuCampagne=__env.renderEuCampagne, console=__env.console, setTimeout=__env.setTimeout;\n' +
    'with (window) {\n' +
    BLOCK + '\n' +
    'return {loadAdminClients:loadAdminClients,_formCreerClient:_formCreerClient,escapeHtml:escapeHtml,' +
    'genererCodeAcces:genererCodeAcces,genererMotDePasse:genererMotDePasse,attrJs:attrJs,' +
    'creerClientDirect:window.creerClientDirect,modifierClient:window.modifierClient,supprimerClient:window.supprimerClient,' +
    'supprimerSelectionClients:window.supprimerSelectionClients,supprimerTousClients:window.supprimerTousClients,' +
    'toggleTousClients:window.toggleTousClients,majCompteurSelClients:window.majCompteurSelClients,' +
    'desactiverClient:window.desactiverClient,reactiverClient:window.reactiverClient,prolongerClient:window.prolongerClient,' +
    'validerDemande:window.validerDemande,refuserDemande:window.refuserDemande,' +
    'creerEssai:window.creerEssai,genererCodeEssai:genererCodeEssai,loadAdminEssais:loadAdminEssais,' +
    'loadAdminDemandes:loadAdminDemandes,loadAdminHistorique:loadAdminHistorique,' +
    'adminTab:window.adminTab,loginAdmin:window.loginAdmin,logoutAdmin:window.logoutAdmin};\n' +
    '}\n' +
    '})();';
  // eslint-disable-next-line no-new-func
  const f = new Function('__env', src);
  return f(env);
}

module.exports = { makeDB, makeSupabase, makeDocument, makeEl, buildModule, uid };
