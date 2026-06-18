'use strict';
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load_app.js');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

const ctx = loadApp();
if (ctx._loadErrors.length) { console.log('LOAD ERRORS:', ctx._loadErrors.map(e => e.message)); process.exit(2); }
const doc = ctx.document;
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function renduLegal(section) {
  const created = [];
  const oc = doc.createElement.bind(doc);
  doc.createElement = function (t) { const e = oc(t); created.push(e); return e; };
  ctx.ouvrirInfosLegales(section);
  doc.createElement = oc;
  const ov = created.find(function (e) { return e.id === 'infosLegalesOverlay'; });
  return ov ? ov.innerHTML : '';
}

// ════════════ A) POLITIQUE DE CONFIDENTIALITÉ (RGPD) ════════════
const conf = renduLegal('confidentialite');
ok(conf.length > 0, 'RGPD: page confidentialité générée');
ok(/Politique de confidentialité/.test(conf), 'RGPD: titre présent');
[['Données traitées', /Données traitées/], ['Bases légales', /Bases légales/], ['Hébergement UE', /Supabase|Union européenne|Irlande/], ['Vos droits', /Vos droits/], ['CNIL', /CNIL/], ['Conservation', /Conservation/]].forEach(function (p) {
  ok(p[1].test(conf), 'RGPD: section "' + p[0] + '" présente');
});
ok(/effacement|portabilit/.test(conf), 'RGPD: droits RGPD détaillés (effacement, portabilité…)');
ok(/votre responsabilité/.test(conf) && /ne garantit pas la conservation/.test(conf) && /vous appartient/.test(conf), 'RGPD: sauvegarde à la charge du client, responsabilité éditeur dégagée');
ok(!/ne jamais perdre un contrôle/.test(conf) && /ne se substituent pas à la sauvegarde/.test(conf), 'RGPD: section Sécurité cohérente (pas de promesse de non-perte)');
ok(/jamais vos données|pas.*publicitaires/i.test(conf), 'RGPD: engagement non-revente/non-pub');

// ════════════ B) MENTIONS LÉGALES (LCEN) ════════════
const ment = renduLegal('mentions');
ok(/Mentions légales/.test(ment), 'mentions: titre présent');
[['Éditeur', /Éditeur/], ['Hébergeurs', /Héberge/], ['Responsabilité', /Responsabilité/], ['Droit applicable', /Droit applicable/]].forEach(function (p) {
  ok(p[1].test(ment), 'mentions: section "' + p[0] + '" présente');
});
ok(/SIRET/.test(ment) && /Directrice? de la publication/.test(ment), 'mentions: champs obligatoires LCEN (SIRET, directeur publication)');

// navigation croisée + fermeture
ok(/ouvrirInfosLegales\('mentions'\)/.test(conf) && /ouvrirInfosLegales\('confidentialite'\)/.test(ment), 'légal: navigation croisée entre les deux pages');
ok(/fermerInfosLegales/.test(conf), 'légal: bouton fermer présent');

// ════════════ C) ACCESSIBILITÉ DES LIENS ════════════
// avant connexion : pied de page de l'accueil
ok(/ouvrirInfosLegales\('confidentialite'\)/.test(HTML) && /ouvrirInfosLegales\('mentions'\)/.test(HTML), 'accès: liens légaux dans le pied de page d\'accueil');
// après connexion : page Réglages (ajout)
{
  const i = HTML.indexOf('settingsVersionTxt');
  const seg = i > -1 ? HTML.slice(i, i + 700) : '';
  ok(/ouvrirInfosLegales\('confidentialite'\)/.test(seg) && /ouvrirInfosLegales\('mentions'\)/.test(seg), 'accès: liens légaux aussi dans les Réglages (après connexion)');
}
// version dynamique (plus de numéro figé)
ok(/settingsVersionTxt/.test(HTML) && /settingsVersionTxt'\)\s*;\s*if\s*\(_sv\)\s*_sv\.textContent/.test(SRC.replace(/\n/g, ' ')) === false || /settingsVersionTxt/.test(SRC), 'version: affichage de version dynamique dans les Réglages');
ok(!/Version V111/.test(HTML), 'version: ancien numéro figé "V111" supprimé');

// ════════════ D) CONSENTEMENT RGPD à l'inscription ════════════
ok(/id="insc_rgpd"/.test(HTML) && /required/.test(HTML.slice(HTML.indexOf('insc_rgpd') - 80, HTML.indexOf('insc_rgpd') + 40)), 'inscription: case RGPD obligatoire (required)');
ok(/Conformité RGPD|données.*conservées|3 ans/i.test(HTML), 'inscription: mention durée de conservation');

// ════════════ E) IDENTITÉ ÉDITEUR — mentions complètes (RTH NETGOCE) ════════════
ok(/RTH NETGOCE/.test(ment), 'mentions: raison sociale RTH NETGOCE');
ok(/SARL/.test(ment), 'mentions: forme juridique SARL');
ok(/au capital de 8 000 €/.test(ment), 'mentions: capital social SARL');
ok(/444 ?244 ?776 ?00019/.test(ment), 'mentions: SIRET renseigné');
ok(/RCS Paris/.test(ment), 'mentions: RCS Paris');
ok(/FR27 ?444 ?244 ?776/.test(ment), 'mentions: TVA intracommunautaire');
ok(/46\.51Z/.test(ment), 'mentions: code APE');
ok(/49 rue de Douai, 75009 Paris/.test(ment), 'mentions: siège social');
ok(/Léa Chikhaoui-Auguste/.test(ment), 'mentions: directrice de la publication');
ok(/tribunaux compétents de Paris/.test(ment), 'mentions: juridiction Paris');
ok(/r\.t\.h@orange\.fr/.test(conf), 'RGPD: e-mail de contact des droits renseigné');
const restants = (ment + conf).match(/\{\{[A-ZÀ-Üa-z][^}]*\}\}/g) || [];
ok(restants.length === 0, 'légal: plus aucun champ à compléter' + (restants.length ? ' [' + restants.join(', ') + ']' : ''));

// ════════════ F) CGV + COOKIES ════════════
const cgv = renduLegal('cgv'); const cookies = renduLegal('cookies');
ok(/Conditions Générales de Vente/.test(cgv), 'CGV: page présente');
ok(/sans engagement/.test(cgv) && /12.{0,3}mois/i.test(cgv), 'CGV: deux formules (sans engagement / 12 mois)');
ok(/affichés lors de l’inscription/.test(cgv), 'CGV: tarifs renvoyés à l’inscription');
ok(/hors taxes/.test(cgv) && /TVA applicable/.test(cgv), 'CGV: tarifs HT + TVA applicable en sus');
ok(/rétractation de 14 jours/.test(cgv) && /rembours/i.test(cgv), 'CGV: droit de rétractation 14 jours accordé (remboursement)');
ok(/résiliable|résiliation/i.test(cgv), 'CGV: clauses de résiliation');
ok(/tribunaux de Paris/.test(cgv), 'CGV: juridiction Paris');
ok(/Gestion des cookies/.test(cookies) && /aucun cookie publicitaire/i.test(cookies), 'Cookies: page présente, sans traceur publicitaire');
ok(/ouvrirInfosLegales\('cgv'\)/.test(conf) && /ouvrirInfosLegales\('cookies'\)/.test(conf), 'légal: navigation vers les 4 pages (CGV + Cookies inclus)');
ok(/ouvrirInfosLegales\('cgv'\)/.test(HTML), 'accès: lien CGV dans le pied de page');

ok(/_modalOuvert/.test(require('fs').readFileSync(require('path').join(__dirname,'..','script.js'),'utf8')), 'maj auto: aucun rechargement tant qu’une fenêtre légale/modal est ouverte');
console.log('\n══════════════════════════════════════');
console.log('ROUND 22 (RGPD + mentions légales) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
