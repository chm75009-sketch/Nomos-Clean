'use strict';
const fs = require('fs'), path = require('path');
require(path.join(__dirname, '..', 'pms_secteurs.js'));            // expose module.exports
const { PMS_SECTEURS } = require(path.join(__dirname, '..', 'pms_secteurs.js'));
global.window = { PMS_SECTEURS: PMS_SECTEURS };                    // pour getPMS()
const { buildPMSDocument } = require(path.join(__dirname, '..', 'pms_generateur.js'));

const outDir = path.join(__dirname, '..', 'modeles_pms');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Établissement laissé en modèle (champs « à compléter »)
const E = {};
const noms = { resto: 'restauration', bp: 'boulangerie-patisserie', rapide: 'restauration-rapide', boucherie: 'boucherie-charcuterie', collective: 'restauration-collective' };
Object.keys(PMS_SECTEURS).forEach(function (k) {
  const html = buildPMSDocument(k, E);
  const f = path.join(outDir, 'PMS-modele-' + noms[k] + '.html');
  fs.writeFileSync(f, html);
  console.log('écrit : ' + f + '  (' + html.length + ' octets)');
});
