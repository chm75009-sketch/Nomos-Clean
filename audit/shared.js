// ════════════════════════════════════════════════════
// SHARED.JS — Nomos | ExpertAudit HACCP
// Fonctions et constantes partagées entre toutes les pages
// ════════════════════════════════════════════════════

var SESSION_KEY  = 'haccp_session';
var CODES_KEY    = 'haccp_codes';
var PWD_KEY      = 'haccp_adminpwd';
var DEMANDES_KEY = 'haccp_demandes';
var DEFAULT_ADMIN_PWD = '';  // SECURITE : plus de mot de passe public en clair (validation serveur via Vault)
var DOC_AUTH_KEY = 'haccp_doc_auths';
var ADMIN_EMAIL_KEY = 'haccp_admin_email';

// ══════════════════════════════════════════
//   SUPABASE CONFIG
// ══════════════════════════════════════════
var SUPABASE_URL = 'https://zdwdeavcwivvdtrjqwme.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkd2RlYXZjd2l2dmR0cmpxd21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTQ5MDYsImV4cCI6MjA5MDEzMDkwNn0.oR7OVs7YwB3STuRkq7BZhzEfrjptDI2Z9yFK7d5wlzI';

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY
  };
}

// ══════════════════════════════════════════
//   SESSION
// ══════════════════════════════════════════
function getSession() {
  try {
    var s = sessionStorage.getItem(SESSION_KEY);
    if (s && s !== 'null') return JSON.parse(s);
  } catch(e) {}
  try {
    var s2 = localStorage.getItem('haccp_session_fallback');
    if (s2 && s2 !== 'null') return JSON.parse(s2);
  } catch(e) {}
  return null;
}
function setSession(obj) {
  var val = JSON.stringify(obj);
  try { sessionStorage.setItem(SESSION_KEY, val); } catch(e) {}
  try { localStorage.setItem('haccp_session_fallback', val); } catch(e) {}
}
function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  try { localStorage.removeItem('haccp_session_fallback'); } catch(e) {}
}
function getAdminPwd() {
  return localStorage.getItem(PWD_KEY) || DEFAULT_ADMIN_PWD;
}
function getAdminEmail() { return localStorage.getItem(ADMIN_EMAIL_KEY) || ''; }
function saveAdminEmail(e) { localStorage.setItem(ADMIN_EMAIL_KEY, e); }

// ══════════════════════════════════════════
//   DEMANDES (Supabase)
// ══════════════════════════════════════════
function getDemandes() {
  try { return JSON.parse(localStorage.getItem(DEMANDES_KEY)||'[]'); } catch(e){ return []; }
}
function saveDemandes(d) {
  localStorage.setItem(DEMANDES_KEY, JSON.stringify(d));
}
function saveDemande_remote(demande) {
  return fetch(SUPABASE_URL + '/rest/v1/demandes', {
    method: 'POST',
    headers: Object.assign({}, sbHeaders(), { 'Prefer': 'return=representation' }),
    body: JSON.stringify({
      resp: demande.resp, etab: demande.etab, secteur: demande.secteur,
      service: demande.service, tel: demande.tel, email: demande.email,
      adresse: demande.adresse || '', siret: demande.siret || '',
      effectif: demande.effectif || '', message: demande.message || '',
      date: demande.date, statut: 'nouveau'
    })
  }).then(function(r){ return r.json(); });
}
function fetchDemandes_remote() {
  return _rpc('admin_list_demandes', { p_pwd: _admPwd() }).then(function(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function(r) {
      return {
        id: r.id, resp: r.resp, etab: r.etab, secteur: r.secteur,
        service: r.service, tel: r.tel, email: r.email,
        adresse: r.adresse, siret: r.siret, effectif: r.effectif,
        message: r.message, date: r.date, statut: r.statut,
        codeGenere: r.code_genere
      };
    });
  });
}
function updateDemande_remote(id, statut, codeGenere) {
  return _rpc('admin_update_demande', { p_pwd: _admPwd(), p_id: id, p_statut: statut, p_code: codeGenere || null })
    .catch(function(e){ console.warn('update demande:', e); return null; });
}
function deleteDemande_remote(id) {
  return _rpc('admin_delete_demande', { p_pwd: _admPwd(), p_id: id })
    .catch(function(){ return null; });
}

// ══════════════════════════════════════════
//   CODES (Supabase)
// ══════════════════════════════════════════
function getCodes() {
  try { return JSON.parse(localStorage.getItem(CODES_KEY) || '[]'); } catch(e){ return []; }
}
function saveCodes(c) {
  localStorage.setItem(CODES_KEY, JSON.stringify(c));
}
// ── Appel d'une fonction serveur (RPC) Supabase ──
function _rpc(name, body) {
  return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: Object.assign({}, sbHeaders(), { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body || {})
  }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)); });
}
// Mot de passe admin de la session (mémorisé à la connexion admin), pour les
// fonctions réservées à l'admin. Repli sur getAdminPwd() par sécurité.
function _admPwd() {
  try { return sessionStorage.getItem('_adm_pwd') || getAdminPwd(); } catch (e) { return getAdminPwd(); }
}
function _mapCodeRow(r) {
  var info = {};
  try { info = typeof r.info === 'string' ? JSON.parse(r.info) : (r.info || {}); } catch (e) {}
  return {
    code: r.code, client: r.client, info: info,
    type: r.type, serviceType: r.service_type,
    docsUnlocked: r.docs_unlocked, exp: r.exp,
    used: r.used, created: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  };
}
// ── CODES via fonctions serveur sécurisées (plus d'accès direct à la table) ──
function saveCode_remote(codeObj) {
  return _rpc('admin_save_code', { p_pwd: _admPwd(), p_code: {
    code: codeObj.code, client: codeObj.client,
    info: JSON.stringify(codeObj.info || {}),
    type: codeObj.type || null, service_type: codeObj.serviceType || null,
    docs_unlocked: codeObj.docsUnlocked || false,
    exp: codeObj.exp || null, used: codeObj.used || false
  } }).catch(function (e) { console.warn('save code:', e); return null; });
}
function fetchCodes_remote() {
  return _rpc('admin_list_codes', { p_pwd: _admPwd() }).then(function (rows) {
    return Array.isArray(rows) ? rows.map(_mapCodeRow) : [];
  });
}
function updateCode_remote(code, fields) {
  var patch = { code: code };
  if (fields.used !== undefined) patch.used = fields.used;
  if (fields.exp !== undefined) patch.exp = fields.exp;
  if (fields.client !== undefined) patch.client = fields.client;
  if (fields.info !== undefined) patch.info = (typeof fields.info === 'string') ? fields.info : JSON.stringify(fields.info);
  return _rpc('admin_save_code', { p_pwd: _admPwd(), p_code: patch }).catch(function () { return null; });
}
function deleteCode_remote(code) {
  return _rpc('admin_delete_code', { p_pwd: _admPwd(), p_code: code }).catch(function () { return null; });
}
// Client : valide UN code (le sien) sans télécharger toute la liste.
function fetchOneCode_remote(code) {
  return _rpc('valider_code', { p_code: code }).then(function (row) {
    return row ? [_mapCodeRow(row)] : [];
  }).catch(function () { return []; });
}
// Client : marque son code comme utilisé.
function consommer_code_remote(code) {
  return _rpc('consommer_code', { p_code: code }).catch(function () { return null; });
}

// ── Synchronisation Supabase ──
function syncFromSupabase(callback) {
  Promise.all([fetchDemandes_remote(), fetchCodes_remote()]).then(function(results) {
    saveDemandes(results[0]);
    saveCodes(results[1]);
    if (callback) callback();
  }).catch(function(err) {
    console.error('Supabase sync error:', err);
    if (callback) callback();
  });
}

// ══════════════════════════════════════════
//   GÉNÉRATEURS DE CODES
// ══════════════════════════════════════════
function makeCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var c = 'HACCP-';
  for (var i=0; i<6; i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function makeDocCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var c = 'DOCS-';
  for (var i=0; i<6; i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function makeFullCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var c = 'FULL-';
  for (var i=0; i<6; i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function makeUniqueCode(maker) {
  var codes = getCodes();
  var code = maker();
  while (codes.find(function(c){ return c.code === code; })) { code = maker(); }
  return code;
}

// ══════════════════════════════════════════
//   NAVIGATION INTER-PAGES
// ══════════════════════════════════════════
function goToAuditPage() {
  window.location.href = 'audit.html';
}
function goToDocumentsPage() {
  window.location.href = 'documents.html';
}
function goToTarifsPage() {
  window.location.href = 'tarifs.html';
}
function goToHomePage() {
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════
//   NAVBAR COMMUNE (injected dynamiquement)
// ══════════════════════════════════════════
function buildNavbar(activePage) {
  var sess = getSession();
  var authLabel = sess ? '🚪 Déconnexion' : '🔑 Accès';
  var authAction = sess ? 'logoutAndRedirect()' : "window.location.href='audit.html'";

  var pages = [
    { href: 'index.html',                 label: 'Accueil',                              id: 'home' },
    { href: 'documents.html',             label: '📋 Vos Documents',                     id: 'documents' },
    { href: 'controles.html',             label: '📊 Contrôles dans votre département',  id: 'controles' },
    { href: 'sanctions.html',             label: '⚖️ Cas Réels & Sanctions',             id: 'sanctions' },
    { href: 'tarifs.html',                label: '💶 Tarifs',                            id: 'tarifs' },
    { href: 'audit.html',                 label: '🔍 Mon Audit',                         id: 'audit' },
    { href: 'tarifs.html#contact-tarifs', label: '📩 Contact',                           id: 'contact' },
    { href: 'tarifs.html#faq',            label: '❓ FAQ',                               id: 'faq' }
  ];

  var desktopLinks = pages.map(function(p) {
    var a = p.id === activePage;
    return '<a href="' + p.href + '" style="color:' + (a?'#153e35':'#65716b') + ';font-weight:' + (a?'900':'700') + ';font-size:.88rem;text-decoration:none;white-space:nowrap' + (a?';background:rgba(21,62,53,.07);padding:4px 11px;border-radius:999px':'') + '">' + p.label + '</a>';
  }).join('');

  var mobileLinks = pages.map(function(p) {
    return '<a href="' + p.href + '" onclick="document.getElementById(\'cfMobNav\').style.display=\'none\'" style="display:flex;align-items:center;padding:13px 16px;color:#153e35;font-weight:700;font-size:.88rem;text-decoration:none;border-bottom:1px solid rgba(21,62,53,.06);gap:8px">' + p.label + '</a>';
  }).join('');

  var css = '<style id="cf-nav-css">' +
    '.cf-nav{position:sticky;top:0;z-index:1000;background:rgba(248,246,239,.97);backdrop-filter:blur(14px);border-bottom:1px solid rgba(21,62,53,.08);box-shadow:0 2px 16px rgba(21,62,53,.06);position:relative}' +
    '.cf-nav-inner{max-width:1180px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;min-height:64px;gap:12px}' +
    '.cf-nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none;flex-shrink:0}' +
    '.cf-nav-links{display:flex;gap:16px;align-items:center;flex:1;justify-content:center;flex-wrap:wrap}' +
    '.cf-nav-auth{padding:8px 16px;background:#fff;color:#153e35;border:2px solid #153e35;border-radius:999px;cursor:pointer;font-weight:900;font-size:.85rem;white-space:nowrap;flex-shrink:0;font-family:inherit}' +
    '.cf-nav-burger{display:none;flex-direction:column;gap:5px;width:38px;height:38px;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;flex-shrink:0;align-items:center;justify-content:center}' +
    '.cf-nav-burger span{display:block;height:2px;width:22px;background:#153e35;border-radius:2px}' +
    '.cf-mob-nav{display:none;flex-direction:column;background:rgba(248,246,239,.99);border-top:1px solid rgba(21,62,53,.08);padding-bottom:12px;position:absolute;top:100%;left:0;right:0;z-index:999;box-shadow:0 8px 24px rgba(21,62,53,.12)}' +
    '.cf-mob-nav-grid{display:grid;grid-template-columns:1fr 1fr}' +
    '.cf-mob-nav-grid a{border-right:1px solid rgba(21,62,53,.06)}' +
    '.cf-mob-nav-grid a:nth-child(even){border-right:none}' +
    '.cf-mob-nav-btn{display:block;margin:10px 16px 0;padding:12px;background:#153e35;color:#fff;border:none;border-radius:999px;cursor:pointer;font-weight:900;font-size:.9rem;font-family:inherit;width:calc(100% - 32px);text-align:center}' +
    '@media(max-width:768px){' +
    '.cf-nav-links{display:none!important}' +
    '.cf-nav-auth{display:none!important}' +
    '.cf-nav-burger{display:flex!important}' +
    '}' +
    '</style>';

  return css +
    '<header class="cf-nav">' +
    '<div class="cf-nav-inner">' +
    '<a href="index.html" class="cf-nav-logo">' +
    '<div style="width:42px;height:42px;border-radius:12px;background:#1f5649;color:#fff;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;letter-spacing:.06em;flex-shrink:0">N</div>' +
    '<div><div style="font-weight:900;font-size:.95rem;letter-spacing:.08em;color:#153e35;line-height:1">NOMOS</div>' +
    '<div style="font-size:.62rem;color:#65716b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Audit Hygiène &amp; Sécurité Alimentaire</div></div>' +
    '</a>' +
    '<nav class="cf-nav-links">' + desktopLinks + '</nav>' +
    '<button class="cf-nav-auth" onclick="' + authAction + '">' + authLabel + '</button>' +
    '<button class="cf-nav-burger" onclick="var m=document.getElementById(\'cfMobNav\');m.style.display=m.style.display===\'flex\'?\'none\':\'flex\'" aria-label="Menu">' +
    '<span></span><span></span><span></span>' +
    '</button>' +
    '</div>' +
    '<nav id="cfMobNav" class="cf-mob-nav">' +
    '<div class="cf-mob-nav-grid">' + mobileLinks + '</div>' +
    '<button class="cf-mob-nav-btn" onclick="' + authAction + '">' + authLabel + '</button>' +
    '</nav>' +
    '</header>';
}

function injectNavbar(activePage) {
  var navEl = document.getElementById('siteNavbar');
  if (!navEl) return;
  var old = document.getElementById('cf-nav-css');
  if (old) old.remove();
  navEl.innerHTML = buildNavbar(activePage);
}

function logoutAndRedirect() {
  if (!confirm('Se déconnecter ?')) return;
  clearSession();
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════
//   FAQ ACCORDÉON
// ══════════════════════════════════════════
function toggleFaq(btn) {
  var faq = btn.closest('.cf-faq');
  var content = faq.querySelector('.cf-faq-content');
  var plus = btn.querySelector('.faq-plus');
  var isOpen = content.style.display !== 'none' && content.style.display !== '';
  content.style.display = isOpen ? 'none' : 'block';
  if (plus) plus.textContent = isOpen ? '+' : '–';
}

// ══════════════════════════════════════════
//   UTILITAIRES
// ══════════════════════════════════════════
function todayFR() {
  return new Date().toLocaleDateString('fr-FR');
}

function getDocAuths() {
  try { return JSON.parse(localStorage.getItem(DOC_AUTH_KEY) || '{}'); } catch(e){ return {}; }
}
function saveDocAuths(a) { localStorage.setItem(DOC_AUTH_KEY, JSON.stringify(a)); }
function isDocAuthorized(code) {
  var auths = getDocAuths();
  return !!auths[code];
}

// ══════════════════════════════════════════
//   NAVIGATION RETOUR
// ══════════════════════════════════════════
function goBack() {
  if (document.referrer && document.referrer !== '') {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

// ══════════════════════════════════════════
//   NOTIFICATION ADMIN — nouvelle demande
// ══════════════════════════════════════════
function envoyerNotifAdmin(adminEmail, d) {
  if (!adminEmail || typeof emailjs === 'undefined') return;
  emailjs.send('service_84lz31w', 'template_ti43bkh', {
    to_name:      'Administrateur Nomos',
    to_email:     adminEmail,
    email:        adminEmail,
    code:         '⚠️ NOUVELLE DEMANDE — À TRAITER',
    service:      (d.service || '') + '\nClient : ' + (d.resp || '') + ' — ' + (d.tel || '') + (d.adresse ? '\n' + d.adresse : '') + (d.message ? '\nMessage : ' + d.message : ''),
    business:     d.etab || '',
    lien_site:    window.location.origin + '/audit.html',
    client_email: d.email || '',
    date:         d.date || ''
  }).then(function() {
    console.log('✅ Notif admin envoyée');
  }, function(err) {
    console.warn('⚠️ Notif admin non envoyée:', err);
  });
}
/* ── BOUTON RETOUR UNIVERSEL — visible quand utile, jamais cache (haut-gauche, z-index max) ── */
(function(){
  function _gbBack(){
    try { if (typeof _fermerOverlayOuvert==="function" && _fermerOverlayOuvert()) { try{ history.pushState({},"",""); }catch(_){ } return; } } catch(e){}
    try { var po=document.getElementById("printOverlay"); if(po&&po.parentNode){ po.parentNode.removeChild(po); return; } } catch(e){}
    try { var nav=document.getElementById("navMobileMenu"); if(nav&&nav.classList.contains("open")){ nav.classList.remove("open"); return; } } catch(e){}
    try { var m=document.querySelector(".modal-overlay.visible"); if(m){ m.classList.remove("visible"); return; } } catch(e){}
    try { if (history.length>1){ history.back(); return; } } catch(e){}
    try { var a=document.querySelector("a[href*=accueil]"); if(a&&a.getAttribute("href")){ location.href=a.getAttribute("href"); return; } } catch(e){}
    try { location.href="index.html"; } catch(e){}
  }
  function _gbShouldShow(){
    try { if (typeof _fermerOverlayOuvert==="function") { return !!(document.getElementById("printOverlay")||document.getElementById("packLoadingOverlay")); } } catch(e){}
    return true;
  }
  function _gbSync(){
    try {
      if (!document.body) return;
      var b=document.getElementById("globalBackBtn");
      if (!b){
        b=document.createElement("button");
        b.id="globalBackBtn"; b.type="button"; b.setAttribute("aria-label","Retour en arriere");
        b.textContent="← Retour";
        b.style.cssText="position:fixed;left:10px;top:10px;z-index:2147483600;background:rgba(15,23,42,.9);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:9px 14px;font-size:13px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);font-family:inherit;-webkit-tap-highlight-color:transparent";
        b.onclick=_gbBack;
        document.body.appendChild(b);
      }
      b.style.display = _gbShouldShow() ? "block" : "none";
    } catch(e){}
  }
  if (document.readyState!=="loading") _gbSync(); else document.addEventListener("DOMContentLoaded", _gbSync);
  window.addEventListener("load", _gbSync);
  setInterval(_gbSync, 400);
})();

/* === Détail formule Audit (option B : documents personnalisés établis par nos soins) === */
(function(){
  var DOCS = ["Plan de Maîtrise Sanitaire (PMS) + procédures HACCP", "Plan de nettoyage & désinfection", "Plan de lutte contre les nuisibles", "Protocole huiles de friture", "Procédure de traçabilité (+ modèles d'étiquettes & DLC)", "Registre des non-conformités & actions correctives", "Registre des relevés de températures (modèle)", "Procédure plats témoins (restauration collective)"], AFF = ["Information allergènes", "Consignes de lavage des mains", "Interdiction de fumer / vapoter", "Mention « eau potable / eau non potable » sur les points d'eau", "Origine des viandes", "Protocole de nettoyage en cuisine", "Affichage des prix (clientèle)"];
  var ORDER = ["audit_diagnostic","audit_essentiel","audit_complet"];
  var META = {
    audit_diagnostic:{nom:"Audit Diagnostic",prix:"390 €",col:"#b7791f"},
    audit_essentiel:{nom:"Audit Essentiel",prix:"690 €",col:"#2d6f60"},
    audit_complet:{nom:"Audit Complet",prix:"1 490 €",col:"#5c3d8f"}
  };
  window.closeAuditDetail = function(){ var m=document.getElementById("auditDetailModal"); if(m) m.remove(); document.body.style.overflow=""; };
  function secTitre(t,c){ return '<div style="font-size:.72rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:'+c+';margin:14px 0 6px">'+t+'</div>'; }
  function incList(arr){ return '<ul style="list-style:none;padding:0;margin:0 0 4px;font-size:.84rem;color:#374151;line-height:1.5">'+arr.map(function(t){return '<li style="margin-bottom:6px"><span style="color:#2d6f60;font-weight:900">✓</span> '+t+'</li>';}).join("")+'</ul>'; }
  function lockLine(t){ return '<div style="font-size:.8rem;color:#8a958f;background:#f6f7f6;border:1px dashed #dfe6e0;border-radius:10px;padding:10px 12px;margin-bottom:6px">🔒 '+t+'</div>'; }
  window.openAuditDetail = function(key){
    var meta = META[key] || META.audit_diagnostic;
    var sel = ORDER.indexOf(key); if(sel<0) sel=0;
    var clause = (sel>=1) ? '<p style="font-size:.72rem;color:#8a9e95;font-style:italic;line-height:1.5;margin:12px 0 14px">Les affiches et documents fournis constituent une base de travail adaptée à votre établissement. Ils doivent être personnalisés, complétés et tenus à jour par vos soins en fonction de l\'évolution de votre activité. Ces documents n\'ont pas valeur contractuelle.</p>' : "";
    var aff = (sel>=1) ? secTitre("📌 Affiches obligatoires fournies (prêtes à afficher)",meta.col)+incList(AFF)
                       : lockLine("Affiches obligatoires fournies — comprises dans les formules Audit Essentiel et Audit Complet.");
    var doc = (sel>=2) ? secTitre("📄 Documents obligatoires personnalisés — établis par nos soins",meta.col)+incList(DOCS)
                       : lockLine("Documents obligatoires personnalisés (PMS, plan de nettoyage…) — compris uniquement dans la formule Audit Complet.");
    var html = '<div style="position:fixed;inset:0;z-index:99999;background:rgba(20,30,25,.55);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto" onclick="if(event.target===this)closeAuditDetail()">'
      + '<div style="background:#fff;border-radius:18px;max-width:560px;width:100%;padding:22px;margin:auto;box-shadow:0 24px 70px rgba(0,0,0,.3);font-family:\'Source Sans 3\',sans-serif">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px"><div><div style="font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:'+meta.col+'">Formule Audit</div><div style="font-size:1.4rem;font-weight:900;color:#153e35">'+meta.nom+'</div></div><button onclick="closeAuditDetail()" style="background:#f1f5f4;border:none;width:34px;height:34px;border-radius:50%;font-size:16px;font-weight:900;cursor:pointer;color:#475569;flex-shrink:0">✕</button></div>'
      + '<div style="font-size:1.6rem;font-weight:900;color:'+meta.col+';margin-bottom:12px">'+meta.prix+' <span style="font-size:.8rem;color:#65716b;font-weight:600">HT</span></div>'
      + '<div style="font-size:.74rem;color:#65716b;margin-bottom:8px">Ce que comprend la formule <b style="color:#153e35">'+meta.nom+'</b> :</div>'
      + secTitre("🔍 Audit sur site",meta.col)
      + incList(["Déplacement dans votre établissement","Rapport détaillé : anomalies relevées + préconisations"])
      + aff + doc
      + clause
      + '<button onclick="closeAuditDetail(); if(typeof showInscriptionAvecService===\'function\')showInscriptionAvecService(\''+key+'\')" style="width:100%;padding:13px;background:linear-gradient(135deg,'+meta.col+',#153e35);color:#fff;border:none;border-radius:999px;font-weight:800;font-size:.95rem;cursor:pointer">✅ Je suis intéressé par cette formule</button>'
      + '<div style="text-align:center;font-size:.74rem;color:#8a9e95;margin-top:8px">Vous serez dirigé vers le formulaire de demande à remplir et à envoyer.</div>'
      + '</div></div>';
    var d = document.createElement("div"); d.id="auditDetailModal"; d.innerHTML=html;
    document.body.appendChild(d); document.body.style.overflow="hidden";
  };
})();

/* Pastille version (diagnostic cache) — coin haut droit, sur toutes les pages Audit */
(function(){
  var NV_BUILD = 'v415';
  function tag(){
    if(document.getElementById('nvBuildTag')) return;
    var d=document.createElement('div'); d.id='nvBuildTag';
    d.textContent='Audit '+NV_BUILD;
    d.style.cssText='position:fixed;top:3px;right:6px;z-index:2147483647;font-size:9px;font-weight:700;color:#8a958f;background:rgba(255,255,255,.75);padding:1px 6px;border-radius:7px;font-family:sans-serif;pointer-events:none';
    (document.body||document.documentElement).appendChild(d);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tag); else tag();
})();

