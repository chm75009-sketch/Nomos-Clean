'use strict';
// Round 27 — Contenu PMS par secteur (pms_secteurs.js) + générateur (pms_generateur.js)
const path = require('path');
let pass = 0, fail = 0; const failures = [];
function ok(c, n) { if (c) pass++; else { fail++; failures.push(n); console.log('  ✗ FAIL: ' + n); } }

// ── Chargement du contenu ──
const { PMS_SECTEURS, ALLERGENES_14 } = require(path.join(__dirname, '..', 'pms_secteurs.js'));

const CLES = ['resto', 'bp', 'rapide', 'boucherie', 'collective'];

// ════════════ A) STRUCTURE COMPLÈTE POUR LES 5 SECTEURS ════════════
ok(PMS_SECTEURS && Object.keys(PMS_SECTEURS).length === 5, 'PMS: 5 secteurs présents');
ok(ALLERGENES_14.length === 14, 'PMS: 14 allergènes réglementaires');

CLES.forEach(function (k) {
  const S = PMS_SECTEURS[k];
  ok(!!S, 'secteur ' + k + ' présent');
  if (!S) return;
  ok(S.cle === k, k + ': clé interne cohérente');
  ok(typeof S.label === 'string' && S.label.length > 3, k + ': label défini');
  ok(Array.isArray(S.references) && S.references.length >= 4, k + ': textes de référence (≥4)');
  ok(S.references.some(function (r) { return /852\/2004/.test(r); }), k + ': référence Règlement 852/2004');
  ok(S.references.some(function (r) { return /GBPH/i.test(r); }), k + ': référence GBPH du secteur');
  // BPH — 7 prérequis
  ok(S.bph && S.bph.personnel && S.bph.personnel.formation, k + ': BPH personnel/formation');
  ok(S.bph.personnel.mains && /lavage/i.test(S.bph.personnel.mains), k + ': BPH hygiène des mains');
  ok(typeof S.bph.locaux === 'string' && S.bph.locaux.length > 20, k + ': BPH locaux');
  ok(Array.isArray(S.bph.nettoyage) && S.bph.nettoyage.length >= 5, k + ': plan de nettoyage (≥5 lignes)');
  ok(S.bph.nettoyage.every(function (n) { return n.zone && n.freq && n.produit && n.methode; }), k + ': nettoyage — 4 colonnes par ligne');
  ok(/nuisible/i.test(S.bph.nuisibles), k + ': BPH lutte nuisibles');
  ok(/eau/i.test(S.bph.eau), k + ': BPH eau');
  ok(/déchet|dechet/i.test(S.bph.dechets), k + ': BPH déchets');
  ok(typeof S.bph.froidChaud === 'string', k + ': BPH froid/chaud');
  // HACCP
  ok(typeof S.haccp.champ === 'string' && /Codex|852/i.test(S.haccp.champ), k + ': HACCP champ d\'application');
  ok(Array.isArray(S.haccp.equipe) && S.haccp.equipe.length >= 2, k + ': HACCP équipe');
  ok(Array.isArray(S.haccp.produits) && S.haccp.produits.length >= 3, k + ': HACCP description produits');
  ok(Array.isArray(S.haccp.diagramme) && S.haccp.diagramme.length >= 6, k + ': HACCP diagramme (≥6 étapes)');
  ok(Array.isArray(S.haccp.dangers) && S.haccp.dangers.length >= 6, k + ': HACCP analyse des dangers (≥6)');
  ok(S.haccp.dangers.every(function (d) { return d.etape && d.danger && d.type && d.mesure; }), k + ': dangers — 4 colonnes par ligne');
  ok(S.haccp.dangers.some(function (d) { return /Allergène/i.test(d.type); }), k + ': danger allergène identifié');
  ok(S.haccp.dangers.some(function (d) { return /Physique/i.test(d.type); }), k + ': danger physique identifié');
  ok(Array.isArray(S.haccp.ccp) && S.haccp.ccp.length >= 3, k + ': HACCP au moins 3 CCP');
  ok(S.haccp.ccp.every(function (c) { return c.nom && c.limite && c.surveillance && c.correction && c.enreg; }), k + ': CCP — 5 colonnes par ligne');
  // Mesures de gestion (III)
  ok(S.tracabilite && /178\/2002/.test(S.tracabilite.principe), k + ': traçabilité (Règl. 178/2002)');
  ok(S.nonConformites && Array.isArray(S.nonConformites.procedure), k + ': procédure non-conformités');
  ok(S.retraitRappel && /DD.*PP|DDPP/.test(S.retraitRappel.contact), k + ': retrait/rappel + DDPP');
  ok(Array.isArray(S.allergenes) && S.allergenes.length === 14, k + ': 14 allergènes rattachés');
  ok(Array.isArray(S.temperatures) && S.temperatures.length >= 5, k + ': tableau températures');
  ok(S.temperatures.every(function (t) { return t.denree && t.valeur; }), k + ': températures — denrée + valeur');
  ok(Array.isArray(S.autocontroles) && S.autocontroles.length >= 6, k + ': liste des autocontrôles');
});

// ════════════ B) PRÉCISION SECTORIELLE (chaque secteur a SES spécificités) ════════════
// Restauration : enrichissements du GBPH Restaurateur
ok(PMS_SECTEURS.resto.references.some(function (r) { return /9 mai 1995/.test(r); }), 'resto: référence Arrêté du 9 mai 1995 (GBPH Restaurateur)');
ok(PMS_SECTEURS.resto.haccp.dangers.some(function (d) { return /Clostridium perfringens/.test(d.danger); }), 'resto: danger Clostridium perfringens (cause n°1, GBPH)');
ok(PMS_SECTEURS.resto.haccp.dangers.some(function (d) { return /anisakis/i.test(d.danger); }), 'resto: danger parasites poisson cru (anisakis)');
ok(PMS_SECTEURS.resto.temperatures.some(function (t) { return /180 ?°C/.test(t.valeur); }), 'resto: huile de friture ≤ 180 °C (GBPH)');
// Restauration : cuisson volaille 74°C + refroidissement < 2h
ok(PMS_SECTEURS.resto.haccp.ccp.some(function (c) { return /74/.test(c.limite); }), 'resto: cuisson volaille ≥ 74 °C');
ok(PMS_SECTEURS.resto.haccp.ccp.some(function (c) { return /< 2 h|moins de 2 h/i.test(c.limite); }), 'resto: refroidissement < 2 h');

// Boulangerie : crème pâtissière 85°C + Salmonella œufs
ok(PMS_SECTEURS.bp.haccp.ccp.some(function (c) { return /85/.test(c.limite); }), 'bp: cuisson crème ≥ 85 °C');
ok(PMS_SECTEURS.bp.haccp.dangers.some(function (d) { return /Salmonella/i.test(d.danger); }), 'bp: danger Salmonella (œufs)');
ok(PMS_SECTEURS.bp.references.some(function (r) { return /Boulangerie|Pâtisserie/i.test(r); }), 'bp: GBPH Boulangerie-Pâtisserie');

// Restauration rapide : huiles de friture (composés polaires) + viande hachée
ok(PMS_SECTEURS.rapide.haccp.ccp.some(function (c) { return /polaire/i.test(c.limite) || /polaire/i.test(c.nom); }), 'rapide: CCP huiles de friture (composés polaires)');
ok(PMS_SECTEURS.rapide.haccp.dangers.some(function (d) { return /STEC|E\. coli/i.test(d.danger); }), 'rapide: danger E. coli (viande hachée)');
// Enrichissements GBPH Restauration rapide :
ok(PMS_SECTEURS.rapide.haccp.ccp.some(function (c) { return /broche|kebab|döner/i.test(c.nom); }), 'rapide: CCP broche kebab (cuisson de surface)');
ok(PMS_SECTEURS.rapide.haccp.dangers.some(function (d) { return /broche|kebab|döner/i.test(d.etape); }), 'rapide: danger broche kebab (cœur froid)');
ok(PMS_SECTEURS.rapide.haccp.dangers.some(function (d) { return /Salmonella/i.test(d.danger) && /œuf/i.test(d.mesure + d.etape); }), 'rapide: danger Salmonella sauces froides (œuf cru)');
ok(PMS_SECTEURS.rapide.temperatures.some(function (t) { return /70 ?°C/.test(t.valeur); }), 'rapide: broche tranchée ≥ 70 °C');
ok(PMS_SECTEURS.rapide.autocontroles.some(function (a) { return /livraison|isotherme/i.test(a); }), 'rapide: maîtrise T° en livraison / emporter');
// Éléments vérifiés depuis le GBPH 2024 (pages BPHG) :
ok(/TACT/.test(PMS_SECTEURS.rapide.bph.froidChaud), 'rapide: méthode de nettoyage TACT (GBPH)');
ok(/ATP/.test(PMS_SECTEURS.rapide.bph.froidChaud), 'rapide: transport ATP classes C/F (GBPH)');
ok(PMS_SECTEURS.rapide.references.some(function (r) { return /2024/.test(r) && /SNARR/i.test(r); }), 'rapide: référence GBPH SNARR 2024');
ok(PMS_SECTEURS.rapide.references.some(function (r) { return /2017\/2158|acrylamide/i.test(r); }), 'rapide: référence acrylamide 2017/2158');
// Valeurs réglementaires confirmées (cuisson volaille, refroidissement, DLC sandwichs SNARR) :
ok(PMS_SECTEURS.rapide.haccp.ccp.some(function (c) { return /74 ?°C/.test(c.limite) && /volaille/i.test(c.limite); }), 'rapide: cuisson volaille ≥ 74 °C à cœur');
ok(PMS_SECTEURS.rapide.temperatures.some(function (t) { return /74 ?°C/.test(t.valeur); }), 'rapide: T° cuisson volaille 74 °C');
ok(PMS_SECTEURS.rapide.haccp.dangers.some(function (d) { return /< 2 h|moins de 2 h/i.test(d.mesure) && /63.*10|10.*°C/.test(d.mesure); }), 'rapide: refroidissement +63→+10 °C en < 2 h');
ok(PMS_SECTEURS.rapide.dureesVie.some(function (p) { return /24 ?h/i.test(p.duree) && /sandwich/i.test(p.produit); }), 'rapide: DLC sandwichs 24 h (étude SNARR)');

// Boucherie : Règlement 853/2004 + zone ≤ 12°C + sous-produits animaux
ok(PMS_SECTEURS.boucherie.references.some(function (r) { return /853\/2004/.test(r); }), 'boucherie: référence Règlement 853/2004 (agrément)');
ok(PMS_SECTEURS.boucherie.haccp.ccp.some(function (c) { return /12 ?°C/.test(c.limite); }) ||
   PMS_SECTEURS.boucherie.temperatures.some(function (t) { return /12 ?°C/.test(t.valeur); }), 'boucherie: zone de travail ≤ 12 °C');
ok(/équarriss|sous-produit|SPAn/i.test(PMS_SECTEURS.boucherie.bph.dechets), 'boucherie: gestion des sous-produits animaux (équarrissage)');
ok(PMS_SECTEURS.boucherie.autocontroles.some(function (a) { return /stérilisateur|82/i.test(a); }), 'boucherie: stérilisateur à couteaux 82 °C');

// Collective : plats témoins (5 jours) + remise en température (CCP) + liaison froide ≤ 3°C
ok(/5 jours/.test(PMS_SECTEURS.collective.platsTemoins || ''), 'collective: plats témoins conservés 5 jours');
ok(PMS_SECTEURS.collective.haccp.ccp.some(function (c) { return /remise en température/i.test(c.nom); }), 'collective: CCP remise en température');
ok(PMS_SECTEURS.collective.haccp.ccp.some(function (c) { return /≤ ?\+?3 ?°C/.test(c.limite); }), 'collective: liaison froide ≤ +3 °C');
ok(PMS_SECTEURS.collective.haccp.ccp.length >= 5, 'collective: au moins 5 CCP (liaison froide/chaude)');
// Enrichissements guide CDG76 :
ok(PMS_SECTEURS.collective.references.some(function (r) { return /853\/2004/.test(r); }), 'collective: référence 853/2004 (températures DAOA)');
ok(PMS_SECTEURS.collective.references.some(function (r) { return /GEM-RCN/.test(r); }), 'collective: référence GEM-RCN (grammages)');
ok(PMS_SECTEURS.collective.temperatures.some(function (t) { return /-12 ?°C/.test(t.valeur); }), 'collective: autres congelés -12 °C');
ok(PMS_SECTEURS.collective.gestionExcedents && /24 ?h/.test(PMS_SECTEURS.collective.gestionExcedents.froides), 'collective: gestion excédents froids (24 h)');
ok(/refroidissement rapide/i.test(PMS_SECTEURS.collective.gestionExcedents.chaudes), 'collective: gestion excédents chauds (refroidissement rapide)');
ok(PMS_SECTEURS.collective.autocontroles.some(function (a) { return /laboratoire agréé/i.test(a); }), 'collective: analyses micro — fréquence définie avec labo agréé');
ok(PMS_SECTEURS.collective.autocontroles.some(function (a) { return /estampille/i.test(a); }), 'collective: contrôle réception — estampille des viandes');

// ════════════ C) GÉNÉRATEUR — produit un document HTML pré-rempli ════════════
(function () {
  // shim navigateur minimal
  let written = '';
  const fakeWin = {
    PMS_SECTEURS: PMS_SECTEURS,
    ETAB: { nom: 'Cuisine Test', adresse: '1 rue de Paris', cp: '75009', ville: 'Paris', siret: '44424477600019', responsable: 'Léa C.', secteur: 'collective', tel: '0102030405', email: 't@t.fr' },
    open: function () { return { document: { open: function () {}, close: function () {}, write: function (h) { written = h; } } }; },
    print: function () {},
    prompt: function () { return null; }
  };
  global.window = fakeWin;
  global.SECTEUR_ACTIF = 'collective';
  const G = require(path.join(__dirname, '..', 'pms_generateur.js'));
  ok(typeof fakeWin.genererPMS === 'function', 'générateur: genererPMS() exposé');
  ok(typeof G.buildPMSDocument === 'function', 'générateur: buildPMSDocument exporté (réutilisable)');

  // On teste directement le constructeur de document (sans DOM)
  written = G.buildPMSDocument('collective', fakeWin.ETAB);
  ok(/Plan de Maîtrise Sanitaire/i.test(written), 'générateur: titre PMS présent');
  ok(/Cuisine Test/.test(written), 'générateur: nom de l\'établissement injecté');
  ok(/44424477600019/.test(written), 'générateur: SIRET injecté');
  ok(/Léa C\./.test(written), 'générateur: responsable (fiche inscription) injecté');
  ok(/0102030405/.test(written), 'générateur: téléphone (fiche inscription) injecté');
  ok(/t@t\.fr/.test(written), 'générateur: e-mail (fiche inscription) injecté');
  // Trame du modèle de référence : sections numérotées 1 à 7 + validation + annexes
  ok(/1\. Présentation/.test(written), 'générateur: chapitre 1 Présentation');
  ok(/2\. Les Bonnes Pratiques d.Hygiène/.test(written), 'générateur: chapitre 2 BPH');
  ok(/3\. Le plan HACCP/.test(written), 'générateur: chapitre 3 HACCP');
  ok(/4\. Traçabilité/.test(written), 'générateur: chapitre 4 Traçabilité');
  ok(/5\. Information du consommateur/.test(written), 'générateur: chapitre 5 Allergènes');
  ok(/6\. Procédures de vérification/.test(written), 'générateur: chapitre 6 Vérification');
  ok(/7\. Documents d.enregistrement/.test(written), 'générateur: chapitre 7 Documents');
  ok(/1\.3/.test(written) && /Obligations réglementaires/.test(written), 'générateur: §1.3 obligations réglementaires');
  ok(/7 principes/.test(written) && /12 étapes/.test(written), 'générateur: méthode HACCP 7 principes / 12 étapes');
  ok(/Durées de vie indicatives/.test(written), 'générateur: durées de vie des produits finis');
  ok(/Critères microbiologiques/.test(written) && /2073\/2005/.test(written), 'générateur: critères microbiologiques');
  ok(/Validation du PMS/.test(written), 'générateur: bloc Validation du PMS');
  // Annexes 1 à 11
  ['Annexe 1', 'Annexe 2', 'Annexe 3', 'Annexe 4', 'Annexe 5', 'Annexe 6', 'Annexe 7', 'Annexe 8', 'Annexe 9', 'Annexe 10', 'Annexe 11'].forEach(function (a) {
    ok(written.indexOf(a) > -1, 'générateur: ' + a + ' présente');
  });
  ok(/relevé des températures/i.test(written), 'générateur: Annexe 1 = fiche relevé températures');
  ok(/Registre des allergènes/i.test(written), 'générateur: Annexe 4 = registre allergènes');
  ok(/class="form"/.test(written), 'générateur: fiches vierges à remplir (tableaux form)');
  ok((written.match(/class="apage"/g) || []).length >= 10, 'générateur: chaque fiche d\'annexe occupe une page A4 entière');
  ok((written.match(/class="poster"/g) || []).length === 11, 'générateur: Annexe 11 = 11 affiches, une par page');
  ok(/Rouge — Viande crue/.test(written), 'générateur: affiche code couleur des planches (remplie)');
  ok(/grid14/.test(written), 'générateur: affiche des 14 allergènes (remplie)');
  ok(/Affichages obligatoires/i.test(written), 'générateur: Annexe 10 = affichages obligatoires');
  ok(/Se laver les mains/.test(written), 'générateur: Annexe 11 = liste des affiches');
  ok(/Avertissement/i.test(written), 'générateur: avertissement en tête');
  ok(/plats? témoins?/i.test(written), 'générateur (collective): section plats témoins');
  ok(/excédents de fin de service/i.test(written), 'générateur (collective): section gestion des excédents');
  ok(/852\/2004/.test(written), 'générateur: référence réglementaire affichée');
  ok(/Imprimer/.test(written), 'générateur: bouton Imprimer/PDF');
  ok(/seul responsable/i.test(written), 'générateur: clause de responsabilité (modèle)');
  // Alignement structure « PMS pains » : chapitre 5 (prix) + PND document détaillé
  ok(/allergènes et prix/i.test(written) && /Information sur les prix/i.test(written), 'générateur: chapitre 5 inclut l\'information sur les prix');
  ok(/Plan de Nettoyage.{0,12}Désinfection.{0,12}document détaillé/i.test(written), 'générateur: PND document détaillé présent');
  ok(/principe TACT/i.test(written), 'générateur: PND détaillé — méthode TACT');
  ok(/Stockage des produits d.entretien/i.test(written), 'générateur: PND détaillé — stockage des produits d\'entretien');
  ok(/émargement hebdomadaire/i.test(written), 'générateur: PND détaillé — fiche d\'émargement hebdomadaire');

  // secteur différent => contenu différent
  let w2 = G.buildPMSDocument('boucherie', fakeWin.ETAB);
  ok(/853\/2004/.test(w2), 'générateur (boucherie): référence 853/2004 présente');
  ok(/Annexe 9/.test(w2), 'générateur (boucherie): annexes présentes aussi');
  ok(!/Plats témoins \(obligatoires\)/.test(w2), 'générateur (boucherie): pas de section dédiée plats témoins (spécifique collective)');
})();

console.log('\n══════════════════════════════════════');
console.log('ROUND 27 (PMS par secteur + générateur) RESULTS: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('FAILURES:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('══════════════════════════════════════');
process.exit(fail ? 1 : 0);
