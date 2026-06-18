// ════════════════════════════════════════════════════
// SHARED.JS — Clean Food | ExpertAudit HACCP
// Fonctions et constantes partagées entre toutes les pages
// ════════════════════════════════════════════════════

var SESSION_KEY  = 'haccp_session';
var CODES_KEY    = 'haccp_codes';
var PWD_KEY      = 'haccp_adminpwd';
var DEMANDES_KEY = 'haccp_demandes';
var DEFAULT_ADMIN_PWD = '826700';
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
  return fetch(SUPABASE_URL + '/rest/v1/demandes?order=id.desc', {
    headers: sbHeaders()
  }).then(function(r){ return r.json(); }).then(function(rows) {
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
  var body = { statut: statut };
  if (codeGenere) body.code_genere = codeGenere;
  return fetch(SUPABASE_URL + '/rest/v1/demandes?id=eq.' + id, {
    method: 'PATCH',
    headers: Object.assign({}, sbHeaders(), { 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ 
    if (!r.ok) {
      console.warn('Supabase update demande HTTP error:', r.status, r.statusText);
      return null;
    }
    return r.json(); 
  }).catch(function(e) {
    console.warn('Supabase update demande network error:', e);
    return null;
  });
}
function deleteDemande_remote(id) {
  return fetch(SUPABASE_URL + '/rest/v1/demandes?id=eq.' + id, {
    method: 'DELETE', headers: sbHeaders()
  });
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
function saveCode_remote(codeObj) {
  return fetch(SUPABASE_URL + '/rest/v1/codes', {
    method: 'POST',
    headers: Object.assign({}, sbHeaders(), { 'Prefer': 'return=representation' }),
    body: JSON.stringify({
      code: codeObj.code, client: codeObj.client,
      info: JSON.stringify(codeObj.info || {}),
      type: codeObj.type || null, service_type: codeObj.serviceType || null,
      docs_unlocked: codeObj.docsUnlocked || false,
      exp: codeObj.exp || null, used: codeObj.used || false
    })
  }).then(function(r){ 
    if (!r.ok) {
      console.warn('Supabase save code HTTP error:', r.status, r.statusText);
      return null;
    }
    return r.json(); 
  }).catch(function(e) {
    console.warn('Supabase save code network error:', e);
    return null;
  });
}
function fetchCodes_remote() {
  return fetch(SUPABASE_URL + '/rest/v1/codes?order=created_at.desc', {
    headers: sbHeaders()
  }).then(function(r){ return r.json(); }).then(function(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function(r) {
      var info = {};
      try { info = typeof r.info === 'string' ? JSON.parse(r.info) : (r.info || {}); } catch(e){}
      return {
        code: r.code, client: r.client, info: info,
        type: r.type, serviceType: r.service_type,
        docsUnlocked: r.docs_unlocked, exp: r.exp,
        used: r.used, created: new Date(r.created_at).getTime()
      };
    });
  });
}
function updateCode_remote(code, fields) {
  var body = {};
  if (fields.used !== undefined) body.used = fields.used;
  if (fields.exp !== undefined) body.exp = fields.exp;
  return fetch(SUPABASE_URL + '/rest/v1/codes?code=eq.' + code, {
    method: 'PATCH',
    headers: Object.assign({}, sbHeaders(), { 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}
function deleteCode_remote(code) {
  return fetch(SUPABASE_URL + '/rest/v1/codes?code=eq.' + code, {
    method: 'DELETE', headers: sbHeaders()
  });
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
    '<div style="width:42px;height:42px;border-radius:12px;background:#1f5649;color:#fff;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center;letter-spacing:.06em;flex-shrink:0">CF</div>' +
    '<div><div style="font-weight:900;font-size:.95rem;letter-spacing:.08em;color:#153e35;line-height:1">CLEAN FOOD</div>' +
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
    to_name:      'Administrateur Clean Food',
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
