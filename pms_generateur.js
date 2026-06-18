/* ════════════════════════════════════════════════════════════════════════
   PMS_GENERATEUR — Génère un Plan de Maîtrise Sanitaire complet, pré-rempli
   avec les informations de l'établissement et adapté à son secteur.

   Le document s'ouvre dans une fenêtre imprimable (bouton « Imprimer / PDF »).
   Aucune donnée n'est envoyée : tout est construit localement à partir de
   pms_secteurs.js + de la fiche établissement (ETAB). Le client reste seul
   responsable de relire, compléter et tenir à jour son PMS.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Source du contenu : window (navigateur) ou require (Node, scripts/tests)
  function getPMS() {
    if (typeof window !== 'undefined' && window.PMS_SECTEURS) return window.PMS_SECTEURS;
    try { return require('./pms_secteurs.js').PMS_SECTEURS; } catch (e) { return null; }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Récupère le secteur actif (clé interne : resto/bp/rapide/boucherie/collective)
  function secteurActif() {
    try { if (typeof SECTEUR_ACTIF !== 'undefined' && SECTEUR_ACTIF) return SECTEUR_ACTIF; } catch (e) {}
    try { if (window.ETAB && window.ETAB.secteur) return window.ETAB.secteur; } catch (e) {}
    try {
      var ls = (typeof _ls === 'function') ? _ls : (typeof lsGet === 'function' ? lsGet : null);
      if (ls) { var v = ls('haccp_secteur_actif') || ls('haccp_secteur'); if (v) return v; }
    } catch (e) {}
    return 'resto';
  }

  function etab() {
    try { if (window.ETAB) return window.ETAB; } catch (e) {}
    return {};
  }

  // ── Feuille de styles du document (mise en forme propre, format A4) ──
  var PMS_CSS =
    '@page{size:A4;margin:16mm 15mm 18mm}' +
    '*{box-sizing:border-box}' +
    'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#1f2937;font-size:11.5px;line-height:1.55;margin:0;background:#e5e7eb}' +
    '.sheet{background:#fff;max-width:800px;margin:0 auto;padding:26px 30px 40px;box-shadow:0 1px 14px rgba(0,0,0,.14)}' +
    'h1,h2,h3,h4{font-family:"Segoe UI",Arial,sans-serif;margin:0}' +
    'p{margin:0 0 8px}' +
    '.part{display:flex;align-items:center;gap:10px;background:#1e1b4b;color:#fff;padding:10px 14px;border-radius:8px;margin:26px 0 14px;font-size:15px;font-weight:800;letter-spacing:.2px}' +
    '.part .pn{background:rgba(255,255,255,.18);border-radius:6px;padding:2px 9px;font-size:13px}' +
    '.sec{margin:0 0 16px}' +
    '.sec>h3{display:flex;gap:8px;align-items:baseline;font-size:13px;font-weight:700;color:#1e1b4b;border-left:4px solid #4338ca;background:#eef2ff;padding:7px 11px;border-radius:0 6px 6px 0;margin:0 0 9px}' +
    '.sec>h3 .num{color:#4338ca;font-weight:800}' +
    '.body{padding:0 2px}' +
    'table{width:100%;border-collapse:collapse;font-size:11px;margin:4px 0 6px;table-layout:fixed}' +
    'th{background:#1e1b4b;color:#fff;text-align:left;padding:6px 8px;border:1px solid #cbd5e1;font-weight:700;font-size:10.5px;overflow-wrap:anywhere;word-break:break-word}' +
    'td{padding:5px 8px;border:1px solid #d7dce3;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}' +
    'tbody tr:nth-child(even){background:#f8fafc}' +
    'table.info td:first-child{font-weight:700;width:34%;background:#f1f5f9;color:#374151}' +
    'table.ccp th{background:#b91c1c}table.ccp tbody tr:nth-child(even){background:#fef4f4}' +
    'table.temp th{background:#0f766e}table.temp tbody tr:nth-child(even){background:#f0fdfa}' +
    'table.temp td:last-child{font-weight:700;white-space:nowrap;color:#0f766e}' +
    'ul.l,ol.l{margin:4px 0 8px;padding-left:20px}ul.l li,ol.l li{margin-bottom:4px}' +
    '.avert{margin:16px 0 0;padding:11px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e}' +
    'table.form td{height:22px}table.form{margin-bottom:14px}' +
    /* Annexe = une page A4 entière */
    '.apage{break-before:page;min-height:244mm;border:1.5px solid #c7d2fe;border-radius:10px;margin:0 0 6px;display:flex;flex-direction:column;overflow:hidden}' +
    '.apage .ah{background:#1e1b4b;color:#fff;padding:11px 14px;display:flex;align-items:baseline;gap:10px}' +
    '.apage .ah .anum{background:rgba(255,255,255,.2);border-radius:6px;padding:2px 9px;font-weight:800;font-size:12px;white-space:nowrap}' +
    '.apage .ah .atitle{font-weight:800;font-size:14px}' +
    '.apage .ac{flex:1;padding:14px 16px;display:flex;flex-direction:column}' +
    '.apage .ac>p{margin-top:0}' +
    '.apage table.form{flex:1}.apage table.form td{height:34px}' +
    /* Affiche pleine page (Annexe 11) */
    '.poster{break-before:page;min-height:244mm;border:3px solid #1e1b4b;border-radius:14px;padding:24px;display:flex;flex-direction:column;text-align:center;page-break-inside:avoid;margin:0 0 6px}' +
    '.poster .pemoji{font-size:58px;margin:8px 0 2px}' +
    '.poster h2{font-size:30px;color:#1e1b4b;margin:2px 0 8px;font-weight:800;line-height:1.12}' +
    '.poster .psub{font-size:15px;color:#4338ca;font-weight:700;margin-bottom:16px}' +
    '.poster .pbody{flex:1;display:flex;flex-direction:column;justify-content:center;font-size:15px;line-height:1.6}' +
    '.poster ol,.poster ul{text-align:left;font-size:17px;line-height:2;max-width:560px;margin:0 auto;padding-left:26px}' +
    '.poster ol li,.poster ul li{margin-bottom:6px}' +
    '.poster .pfoot{font-size:12.5px;color:#475569;margin-top:16px;border-top:1px dashed #cbd5e1;padding-top:12px}' +
    '.poster .grid14{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;text-align:left;max-width:620px;margin:0 auto;font-size:14.5px}' +
    '.poster .grid14 div{padding:4px 0;border-bottom:1px solid #eef2ff}' +
    '.poster .flowp{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;align-items:center}' +
    '.poster .flowp .st{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:9px 13px;font-weight:700;font-size:14px;color:#1e1b4b}' +
    '.poster .flowp .ar{color:#94a3b8;font-weight:800}' +
    '.poster .ccrow{display:flex;align-items:center;gap:14px;max-width:520px;margin:9px auto;font-size:17px;font-weight:600;text-align:left}' +
    '.poster .chip{width:34px;height:34px;border-radius:7px;flex-shrink:0;border:1px solid rgba(0,0,0,.18)}' +
    '.poster table.temp{max-width:620px;margin:0 auto}' +
    '.flow{line-height:2.1}.flow .st{display:inline-block;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:4px 9px;margin:2px;font-size:11px;font-weight:600;color:#1e1b4b}.flow .ar{color:#94a3b8;margin:0 1px;font-weight:700}' +
    '.callout{border-radius:6px;padding:9px 12px;margin:0 0 8px}' +
    '.cy{background:#fef9c3;border:1px solid #fde047}' +
    '.cb{background:#eff6ff;border-left:4px solid #3b82f6}' +
    '.co{background:#fff7ed;border-left:4px solid #f97316}' +
    '.cg{background:#f8fafc;border-left:4px solid #94a3b8}' +
    '.muted{color:#6b7280;font-size:10.5px}' +
    '.disclaimer{margin:24px 0 0;padding:12px 14px;background:#f1f5f9;border-left:4px solid #4338ca;border-radius:4px;font-size:11px;color:#475569}' +
    /* page de garde plein format */
    '.cover{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:235mm;padding:0 10mm}' +
    '.cover .kicker{font-size:13px;letter-spacing:3px;color:#6b7280;font-weight:700}' +
    '.cover h1{font-size:34px;line-height:1.15;color:#1e1b4b;margin:14px 0 6px;font-weight:800}' +
    '.cover .emoji{font-size:54px;margin:6px 0 10px}' +
    '.cover .secteur{font-size:20px;color:#4338ca;font-weight:700;margin-bottom:26px}' +
    '.cover .etab{font-size:16px;color:#111827;font-weight:600}' +
    '.cover .rule{width:120px;height:3px;background:#4338ca;border-radius:2px;margin:22px auto}' +
    '.cover .base{font-size:12px;color:#6b7280;max-width:460px}' +
    '.cover .foot{margin-top:auto;padding-top:24px;font-size:11px;color:#94a3b8}' +
    /* sommaire */
    '.toc{margin:0 0 8px}.toc .toc-part{font-weight:800;color:#1e1b4b;margin:12px 0 4px;font-size:13px}' +
    '.toc ul{list-style:none;margin:0 0 4px;padding:0}.toc li{padding:3px 0;border-bottom:1px dotted #d1d5db;font-size:11.5px;color:#374151}' +
    '@media screen{.toolbar{position:sticky;top:0;z-index:9;background:#1e1b4b;color:#fff;padding:11px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px}' +
    '.toolbar .t{font-weight:700;font-size:14px}.toolbar button{background:#fff;color:#1e1b4b;border:none;border-radius:8px;font-weight:700;font-size:13px;padding:8px 16px;cursor:pointer}}' +
    /* Pages A4 paginées (paginateur maison, borné) */
    '.pages{padding:10px 0}' +
    // À l'écran : la page s'adapte à la largeur du téléphone (lisible, rien ne déborde).
    '.pg{width:100%;max-width:820px;box-sizing:border-box;background:#fff;margin:0 auto 12px;box-shadow:0 1px 10px rgba(0,0,0,.15);padding:18px 18px 34px;position:relative}' +
    '.pgft{position:absolute;left:14px;right:14px;bottom:10px;text-align:center;font:9px Arial;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:5px}' +
    '.tocpg{display:inline-block;min-width:26px;font-weight:800;color:#4338ca;margin-right:6px}' +
    // À l\'impression / PDF : vraie page A4.
    '@media print{@page{margin:0}body{background:#fff}.noprint{display:none!important}' +
    '.pages{padding:0}.pg{width:auto;max-width:none;margin:0;box-shadow:none;height:296mm;padding:15mm 15mm 20mm;break-after:page;page-break-after:always}' +
    '.pgft{left:15mm;right:15mm;bottom:8mm}' +
    '.part,.sec,table,tr,.callout,.flow,.apage,.poster{break-inside:avoid}thead{display:table-header-group}h3{break-after:avoid}}';

  // ── Briques de mise en forme ──
  function infoRow(label, valeur) {
    return '<tr><td>' + esc(label) + '</td><td>' +
      (valeur ? esc(valeur) : '<span style="color:#9ca3af">à compléter</span>') + '</td></tr>';
  }
  function liste(arr) {
    if (!arr || !arr.length) return '';
    return '<ul class="l">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }
  function part(num, titre) {
    return '<h2 class="part"><span class="pn">PARTIE ' + esc(num) + '</span>' + esc(titre) + '</h2>';
  }
  function sec(num, titre, contenuHtml) {
    return '<section class="sec"><h3>' + (num ? '<span class="num">' + esc(num) + '</span>' : '') +
      '<span>' + esc(titre) + '</span></h3><div class="body">' + contenuHtml + '</div></section>';
  }
  function para(txt) { return '<p>' + esc(txt) + '</p>'; }

  function tableauTemperatures(S) {
    var t = '<table class="temp"><thead><tr><th>Denrée / opération</th><th>Température réglementaire</th></tr></thead><tbody>';
    (S.temperatures || []).forEach(function (r) {
      t += '<tr><td>' + esc(r.denree) + '</td><td>' + esc(r.valeur) + '</td></tr>';
    });
    return t + '</tbody></table>';
  }

  // Construit le corps HTML du PMS pour un secteur donné
  function corpsPMS(S, E) {
    var nom = E.nom || '';
    var adr = [E.adresse, [E.cp, E.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var dateStr = new Date().toLocaleDateString('fr-FR');
    var html = '';

    // ════ PAGE DE GARDE ════
    html += '<div class="cover">' +
      '<div class="kicker">PLAN DE MAÎTRISE SANITAIRE</div>' +
      '<div class="emoji">' + S.emoji + '</div>' +
      '<h1>Plan de Maîtrise<br>Sanitaire</h1>' +
      '<div class="secteur">' + esc(S.label) + '</div>' +
      '<div class="etab">' + (nom ? esc(nom) : '<span style="color:#9ca3af">[ Nom de l\'établissement ]</span>') + '</div>' +
      '<div class="rule"></div>' +
      '<div class="base">Document établi d\'après le Règlement (CE) n° 852/2004 et le Guide de Bonnes Pratiques d\'Hygiène (GBPH) du secteur.</div>' +
      '<div class="foot">Établi le ' + dateStr + ' · Généré avec HACCP Pro</div>' +
      '</div>';

    html += '<div class="avert">⚠️ <b>Avertissement :</b> le présent Plan de Maîtrise Sanitaire est un modèle. Il doit être ' +
      'complété, adapté et validé par l\'exploitant en fonction de l\'activité réelle, puis fait vivre au quotidien (relevés, ' +
      'plan de nettoyage émargé, fiches de réception et de non-conformité…). HACCP Pro est un outil d\'aide à l\'autocontrôle ; ' +
      'l\'exploitant reste seul responsable de la conformité de son établissement et de la sauvegarde de ses documents.</div>';

    // ── Outils de mise en forme locaux ──
    var chap = function (num, titre) {
      return '<h2 class="part"><span class="pn">' + esc(num) + '</span>' + esc(titre) + '</h2>';
    };
    var listeNum = function (arr) {
      return '<ol class="l">' + (arr || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    };
    var tbl = function (headers, rows, cls) {
      var h = '<table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' +
        headers.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
      (rows || []).forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + (c == null ? '' : c) + '</td>'; }).join('') + '</tr>'; });
      return h + '</tbody></table>';
    };
    var blankTable = function (headers, nRows) {
      var rows = [];
      for (var i = 0; i < (nRows || 10); i++) rows.push(headers.map(function () { return '<div style="height:15px"></div>'; }));
      return tbl(headers, rows, 'form');
    };

    // ════ SOMMAIRE ════
    html += '<div class="page-break"></div>';
    var ptNum = S.platsTemoins ? '3.6' : '';
    html += sec('', 'Sommaire',
      '<div class="toc">' +
      '<div class="toc-part">1. Présentation de l\'établissement et champ d\'application</div>' +
      '<ul><li>1.1 — Objet du PMS</li><li>1.2 — Champ d\'application</li><li>1.3 — Obligations réglementaires préalables</li></ul>' +
      '<div class="toc-part">2. Les Bonnes Pratiques d\'Hygiène (BPH)</div>' +
      '<ul><li>2.1 — Personnel</li><li>2.2 — Locaux & matériel</li><li>2.3 — Plan de nettoyage</li><li>2.4 — Nuisibles</li>' +
      '<li>2.5 — Eau</li><li>2.6 — Températures</li><li>2.7 — Déchets</li></ul>' +
      '<div class="toc-part">3. Le plan HACCP</div>' +
      '<ul><li>3.1 — Méthode (7 principes / 12 étapes)</li><li>3.2 — Équipe & champ</li><li>3.3 — Diagramme</li>' +
      '<li>3.4 — Analyse des dangers</li><li>3.5 — Points critiques (CCP)</li>' + (S.platsTemoins ? '<li>3.6 — Plats témoins & excédents</li>' : '') + '</ul>' +
      '<div class="toc-part">4. Traçabilité et gestion des non-conformités</div>' +
      '<ul><li>4.1 — Traçabilité & durées de conservation</li><li>4.2 — Produits non conformes</li><li>4.3 — Retrait / rappel & TIAC</li></ul>' +
      '<div class="toc-part">5. Information du consommateur — allergènes et prix</div>' +
      '<div class="toc-part">6. Procédures de vérification et d\'autocontrôle</div>' +
      '<div class="toc-part">7. Documents d\'enregistrement (fiches & registres)</div>' +
      '<div class="toc-part">Validation du PMS</div>' +
      '<div class="toc-part">Plan de Nettoyage & Désinfection (PND) — document détaillé</div>' +
      '<ul><li>Méthode TACT · règles générales · plan par zone · stockage des produits · émargement hebdomadaire</li></ul>' +
      '<div class="toc-part">Annexes 1 à 9 — Fiches d\'enregistrement · Annexe 10 — Affichages · Annexe 11 — Affiches</div>' +
      '</div>');

    // ════ 1. PRÉSENTATION ════
    html += '<div class="page-break"></div>';
    html += chap('1', 'Présentation de l\'établissement et champ d\'application');
    html += sec('', 'Identification de l\'établissement',
      '<table class="info">' +
      infoRow('Raison sociale', E.nom) +
      (E.formeJuridique ? infoRow('Forme juridique', E.formeJuridique + (E.capital ? ' — capital ' + E.capital : '')) : '') +
      infoRow('Adresse', adr) + infoRow('SIRET', E.siret) +
      (E.siren ? infoRow('SIREN', E.siren) : '') + (E.rcs ? infoRow('RCS', E.rcs) : '') +
      infoRow('Téléphone', E.tel) + infoRow('E-mail', E.email) +
      infoRow('Responsable de l\'hygiène', E.responsable) + infoRow('Secteur d\'activité', S.label) +
      infoRow('Eau potable réseau public', 'Oui') + infoRow('Date d\'établissement', dateStr) + '</table>');
    html += sec('1.1', 'Objet du PMS', para(S.objetPMS));
    html += sec('1.2', 'Champ d\'application', para(S.haccp.champ) + liste(S.references));
    html += sec('1.3', 'Obligations réglementaires préalables',
      '<p><b>Déclaration d\'activité :</b> ' + esc(S.obligations.cerfa) + '</p>' +
      '<p><b>Formation / instructions à l\'hygiène :</b> ' + esc(S.obligations.formation) + '</p>' +
      '<p><b>Tenue et conservation des enregistrements :</b></p>' +
      tbl(['Document à archiver', 'Durée de conservation'],
        S.obligations.conservation.map(function (r) { return [esc(r.doc), '<b>' + esc(r.duree) + '</b>']; })));

    // ════ 2. BPH ════
    html += chap('2', 'Les Bonnes Pratiques d\'Hygiène (BPH)');
    var p = S.bph.personnel;
    html += sec('2.1', 'Hygiène et formation du personnel',
      '<table class="info">' +
      infoRow('Formation', p.formation) + infoRow('Tenue de travail', p.tenue) +
      infoRow('Bijoux, ongles, plaies', p.bijoux) + infoRow('Suivi médical / santé', p.sante) +
      infoRow('Hygiène des mains', p.mains) + infoRow('Visiteurs / livreurs', p.visiteurs) +
      (p.notes ? infoRow('Spécificité du secteur', p.notes) : '') + '</table>');
    html += sec('2.2', 'Locaux, équipements et matériel', para(S.bph.locaux));
    var pn = '<table><thead><tr><th>Zone / matériel</th><th>Fréquence</th><th>Produit</th><th>Méthode</th></tr></thead><tbody>';
    (S.bph.nettoyage || []).forEach(function (n) {
      pn += '<tr><td style="font-weight:600">' + esc(n.zone) + '</td><td>' + esc(n.freq) +
        '</td><td>' + esc(n.produit) + '</td><td>' + esc(n.methode) + '</td></tr>';
    });
    pn += '</tbody></table>';
    html += sec('2.3', 'Plan de nettoyage et de désinfection (PND)',
      '<p>Protocole en 5 étapes : pré-nettoyage → lavage (détergent) → rinçage → désinfection → rinçage final / séchage. ' +
      'Produits d\'entretien stockés dans un local fermé séparé des denrées, avec leurs fiches de données de sécurité (FDS).</p>' + pn);
    html += sec('2.4', 'Lutte contre les nuisibles', para(S.bph.nuisibles));
    html += sec('2.5', 'Approvisionnement en eau', para(S.bph.eau));
    html += sec('2.6', 'Maîtrise des températures (chaîne du froid et du chaud)',
      para(S.bph.froidChaud) + tableauTemperatures(S) +
      '<p class="muted">Relevés de température quotidiens (1 à 2 fois/jour) sur fiche émargée pour chaque enceinte (conservation 12 mois). ' +
      'Toute dérive déclenche une action corrective. Décongélation en enceinte réfrigérée (0 à +4 °C), jamais à température ambiante. ' +
      'Enregistrement automatique continu obligatoire pour les enceintes négatives de plus de 10 m².</p>');
    html += sec('2.7', 'Gestion des déchets', para(S.bph.dechets));

    // ════ 3. HACCP ════
    html += chap('3', 'Le plan HACCP');
    html += sec('3.1', 'La méthode HACCP : 7 principes et 12 étapes',
      '<p><b>Les 7 principes</b> (Codex Alimentarius) :</p>' + listeNum(S.methodeHACCP.principes) +
      '<p><b>Les 12 étapes d\'application :</b></p>' + listeNum(S.methodeHACCP.etapes));
    html += sec('3.2', 'Équipe et champ d\'application', para(S.haccp.champ) + liste(S.haccp.equipe));
    var diag = '<div class="flow">' + (S.haccp.diagramme || []).map(function (e, i) {
      return '<span class="st">' + (i + 1) + '. ' + esc(e) + '</span>';
    }).join('<span class="ar">→</span>') + '</div>';
    html += sec('3.3', 'Diagramme de fabrication', '<p>' + esc(S.haccp.produits.join(' · ')) + '</p>' + diag);
    var dg = '<table><thead><tr><th>Étape</th><th>Danger</th><th>Type</th><th>Mesure de maîtrise</th></tr></thead><tbody>';
    (S.haccp.dangers || []).forEach(function (d) {
      dg += '<tr><td style="font-weight:600">' + esc(d.etape) + '</td><td>' + esc(d.danger) +
        '</td><td>' + esc(d.type) + '</td><td>' + esc(d.mesure) + '</td></tr>';
    });
    dg += '</tbody></table>';
    html += sec('3.4', 'Analyse des dangers', dg);
    var cc = '<table class="ccp"><thead><tr><th>CCP / PrPo</th><th>Limite critique</th><th>Surveillance</th><th>Action corrective</th><th>Enregistrement</th></tr></thead><tbody>';
    (S.haccp.ccp || []).forEach(function (c) {
      cc += '<tr><td style="font-weight:700">' + esc(c.nom) + '</td><td>' + esc(c.limite) +
        '</td><td>' + esc(c.surveillance) + '</td><td>' + esc(c.correction) + '</td><td>' + esc(c.enreg) + '</td></tr>';
    });
    cc += '</tbody></table><p class="muted">Vérification : étalonnage des sondes, relecture des enregistrements, revue annuelle du plan HACCP et après tout changement de process.</p>';
    html += sec('3.5', 'Tableau de maîtrise des points critiques (CCP / PrPo)', cc);
    if (S.platsTemoins || S.gestionExcedents) {
      var pt = '';
      if (S.platsTemoins) pt += '<div class="callout cy"><b>Plats témoins (obligatoires) — </b>' + esc(S.platsTemoins) + '</div>';
      if (S.gestionExcedents) {
        var ge = S.gestionExcedents;
        pt += '<p style="margin-top:6px">' + esc(ge.principe) + '</p>' +
          '<div class="callout cb">' + esc(ge.froides) + '</div>' +
          '<div class="callout co">' + esc(ge.chaudes) + '</div>' +
          '<div class="callout cg">' + esc(ge.satellite) + '</div>';
      }
      html += sec('3.6', 'Plats témoins & gestion des excédents de fin de service', pt);
    }

    // ════ 4. TRAÇABILITÉ & NON-CONFORMITÉS ════
    html += chap('4', 'Traçabilité et gestion des non-conformités');
    html += sec('4.1', 'Traçabilité',
      para(S.tracabilite.principe) + liste(S.tracabilite.enregistrements) +
      '<p><b>Durées de vie indicatives des produits finis</b> (dès fabrication, conservation au froid) :</p>' +
      tbl(['Produit', 'Durée de vie'], (S.dureesVie || []).map(function (r) { return [esc(r.produit), '<b>' + esc(r.duree) + '</b>']; })));
    html += sec('4.2', 'Gestion des produits non conformes', para(S.nonConformites.principe) + liste(S.nonConformites.procedure));
    html += sec('4.3', 'Procédure de retrait / rappel',
      para(S.retraitRappel.principe) + listeNum(S.retraitRappel.procedure) +
      '<div class="callout cy"><b>En cas de suspicion de TIAC </b>(toxi-infection alimentaire collective) : conserver les plats témoins / échantillons, ' +
      'noter les produits et symptômes, alerter la DD(ETS)PP, coopérer à l\'enquête.</div>' +
      '<p class="muted">' + esc(S.retraitRappel.contact) + '</p>');

    // ════ 5. ALLERGÈNES ET PRIX ════
    html += chap('5', 'Information du consommateur — allergènes et prix');
    html += sec('5.1', 'Les 14 allergènes à déclaration obligatoire',
      '<p>Conformément au Règlement (UE) n° 1169/2011 (INCO), l\'information sur la présence des 14 allergènes est mise à disposition ' +
      'du consommateur pour les denrées non préemballées : par affichage et/ou via un <b>registre des allergènes</b> consultable, tenu à jour par produit ' +
      '(voir Annexe 4). Les produits vendus décongelés portent la mention « décongelé ».</p>' + liste(S.allergenes));
    html += sec('5.2', 'Information sur les prix',
      '<p>Les prix sont portés à la connaissance du consommateur avant la commande, conformément aux obligations d\'affichage ' +
      '(arrêté du 27 mars 1987 relatif à l\'affichage des prix dans les établissements servant des repas, denrées ou boissons). ' +
      'Affichage <b>à l\'extérieur</b> (carte ou menu lisibles depuis la voie publique) et <b>à l\'intérieur</b> (carte remise au client). ' +
      'Prix indiqués <b>taxes et service compris</b>. L\'origine des viandes bovines est affichée (décret n° 2002-1465).</p>');

    // ════ 6. VÉRIFICATION & AUTOCONTRÔLE ════
    html += chap('6', 'Procédures de vérification et d\'autocontrôle');
    html += sec('', 'Vérifications', liste(S.verification));
    html += sec('', 'Critères microbiologiques de référence (produits sensibles)',
      tbl(['Germe', 'Critère (Règl. CE 2073/2005)'], (S.criteresMicro || []).map(function (r) { return [esc(r.germe), esc(r.critere)]; })));

    // ════ 7. DOCUMENTS D'ENREGISTREMENT ════
    html += chap('7', 'Documents d\'enregistrement (fiches & registres)');
    html += sec('', 'Le classeur « Hygiène »',
      '<p>Les fiches suivantes constituent le classeur « Hygiène ». Elles sont renseignées et émargées au quotidien, et fournies vierges en annexe :</p>' +
      listeNum(S.fichesEnreg));

    // ════ VALIDATION ════
    html += chap('✓', 'Validation du PMS');
    html += '<table class="info">' +
      infoRow('Rédigé / proposé par', 'HACCP Pro (RTH NETGOCE)') +
      infoRow('Validé par (exploitant)', E.responsable) +
      '<tr><td>Date de mise en application</td><td></td></tr>' +
      '<tr><td>Signature de l\'exploitant</td><td style="height:34px"></td></tr>' +
      infoRow('Date de révision prévue', 'Annuelle, ou après tout changement majeur') + '</table>';

    // ════════ PLAN DE NETTOYAGE & DÉSINFECTION — DOCUMENT DÉTAILLÉ ════════
    html += '<div class="page-break"></div>';
    html += chap('PND', 'Plan de Nettoyage & Désinfection — document détaillé');
    html += sec('', 'Méthodologie — le principe TACT',
      '<p>L\'efficacité du nettoyage-désinfection repose sur 4 facteurs complémentaires (méthode <b>TACT</b>) :</p>' +
      tbl(['Facteur', 'Ce que cela signifie'], [
        ['<b>T</b> — Température', 'Utiliser l\'eau à la température préconisée par le fournisseur du produit (souvent tiède).'],
        ['<b>A</b> — Action mécanique', 'Frotter, brosser, racler : l\'action manuelle décolle les souillures.'],
        ['<b>C</b> — Concentration', 'Respecter la dilution indiquée sur la fiche technique du produit (ni trop, ni trop peu).'],
        ['<b>T</b> — Temps', 'Laisser agir le produit le temps de contact prescrit avant rinçage.']
      ]) +
      '<p class="muted">Réduire un facteur oblige à renforcer les autres. Les produits utilisés sont conformes aux normes CEN ' +
      '(détergents et désinfectants contact alimentaire) et leurs fiches de données de sécurité (FDS) sont conservées sur place.</p>');
    html += sec('', 'Règles générales d\'hygiène du nettoyage',
      liste([
        'Protocole en 5 étapes : pré-nettoyage (retirer les résidus) → lavage au détergent → rinçage → désinfection (temps de contact) → rinçage final et séchage.',
        'Ne jamais mélanger deux produits (risque de dégagement toxique, ex. javel + acide).',
        'Matériel de nettoyage propre, rangé, séché entre deux usages ; lavettes et balais à code couleur par zone.',
        'Nettoyer du plus propre vers le plus sale, et du haut vers le bas.',
        'Se laver les mains après toute opération de nettoyage avant de reprendre la manipulation des denrées.',
        'Émarger le plan de nettoyage après chaque opération (preuve d\'application exigée par la DDPP).'
      ]));
    var pndZones = '<table><thead><tr><th>Quoi (zone / matériel)</th><th>Quand (fréquence)</th><th>Avec quoi (produit)</th><th>Comment (méthode)</th><th>Qui</th></tr></thead><tbody>';
    (S.bph.nettoyage || []).forEach(function (n) {
      pndZones += '<tr><td style="font-weight:600">' + esc(n.zone) + '</td><td>' + esc(n.freq) +
        '</td><td>' + esc(n.produit) + '</td><td>' + esc(n.methode) + '</td><td><span style="color:#9ca3af">à désigner</span></td></tr>';
    });
    pndZones += '</tbody></table>';
    html += sec('', 'Plan de nettoyage détaillé par zone (QQOQC)', pndZones);
    html += sec('', 'Stockage des produits d\'entretien',
      '<p>Les produits d\'entretien et de désinfection sont stockés dans un <b>local ou placard fermé, ventilé, séparé des denrées ' +
      'alimentaires et des emballages</b>. Ils restent dans leur emballage d\'origine étiqueté, avec leur <b>fiche de données de sécurité (FDS)</b> ' +
      'accessible. Les bidons entamés sont refermés ; aucun transvasement dans un contenant alimentaire. Le matériel de nettoyage ' +
      '(seaux, balais, raclettes) y est rangé propre et sec.</p>');
    var jours = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    var emRows = (S.bph.nettoyage || []).slice(0, 12).map(function (n) {
      return [esc(n.zone)].concat(jours.map(function () { return '<div style="height:14px"></div>'; })).concat(['']);
    });
    html += sec('', 'Fiche d\'émargement hebdomadaire',
      '<p class="muted">Cocher / viser chaque jour après l\'opération de nettoyage. Semaine du __ / __ / ____ .</p>' +
      tbl(['Zone / matériel', 'L', 'M', 'M', 'J', 'V', 'S', 'D', 'Visa resp.'], emRows, 'form'));

    // ════════ ANNEXES — une annexe = une page A4 entière ════════
    html += '<div class="page-break"></div>';
    html += chap('A', 'Annexes — Fiches d\'enregistrement & affiches');
    html += '<p class="muted">Chaque annexe est conçue pour être imprimée sur une page A4. Les fiches (Annexes 1 à 9) sont à renseigner et émarger ' +
      'au quotidien, puis à conserver dans le classeur « Hygiène ». L\'Annexe 10 liste les affichages ; l\'Annexe 11 fournit les affiches, une par page.</p>';

    // Fiche pleine page : en-tête « Annexe N » + tableau vierge qui remplit la page
    var annexePage = function (num, titre, headers, nRows) {
      return '<section class="apage"><div class="ah"><span class="anum">Annexe ' + esc(num) + '</span>' +
        '<span class="atitle">' + esc(titre) + '</span></div><div class="ac">' + blankTable(headers, nRows) + '</div></section>';
    };

    html += annexePage('1', 'Fiche de relevé des températures (quotidienne, par enceinte)',
      ['Date', 'Enceinte', 'T° matin', 'T° soir', 'Conforme (O/N)', 'Action corrective', 'Visa'], 18);
    html += annexePage('2', 'Plan de nettoyage et de désinfection — émargement',
      ['Date', 'Zone / matériel', 'Fréquence prévue', 'Produit utilisé', 'Fait (✔)', 'Visa'], 18);
    html += annexePage('3', 'Fiche de contrôle à la réception',
      ['Date', 'Fournisseur', 'Produit', 'T° relevée', 'État colis', 'DLC / DDM', 'N° lot', 'Conforme', 'Visa'], 18);
    html += annexePage('4', 'Registre des allergènes (par produit / recette)',
      ['Produit / recette', 'Allergènes présents', 'Traces possibles', 'Mis à jour le', 'Visa'], 18);
    html += annexePage('5', 'Fiche de non-conformité et de retrait / rappel',
      ['Date', 'Produit / lot', 'Nature de la non-conformité', 'Cause', 'Action corrective', 'Devenir', 'Visa'], 16);
    html += annexePage('6', 'Fiche de traçabilité (bons de livraison, lots, origine)',
      ['Date', 'Produit', 'Fournisseur', 'N° lot', 'Origine', 'DLC / DDM', 'N° bon de livraison'], 18);
    html += annexePage('7', 'Suivi de la maintenance et des attestations',
      ['Équipement', 'Opération (ramonage, étalonnage, entretien froid…)', 'Date', 'Prestataire / interne', 'Prochaine échéance', 'Visa'], 16);
    html += annexePage('8', 'Fiche de contrôle de l\'huile de friture (le cas échéant)',
      ['Date', 'Bain / friteuse', 'Composés polaires (%)', 'Conforme (≤ 25 %)', 'Action', 'Visa'], 16);
    html += annexePage('9', 'Fiche de conservation & DLC secondaires',
      ['Produit', 'Date de fabrication / ouverture', 'DLC secondaire', 'N° lot', 'Visa'], 18);

    // Annexe 10 — affichages obligatoires (page entière)
    html += '<section class="apage"><div class="ah"><span class="anum">Annexe 10</span>' +
      '<span class="atitle">Affichages obligatoires & supports visuels</span></div><div class="ac">' +
      '<p class="muted">Cocher « Oui » lorsque l\'affiche est en place. Les affiches doivent être personnalisées au nom de l\'établissement.</p>' +
      tbl(['Catégorie', 'Affiche / support', 'Emplacement conseillé', 'Affiché (O/N)'],
        (S.affichesOblig || []).map(function (a) { return [esc(a.cat), esc(a.affiche), esc(a.lieu), '']; })) +
      '</div></section>';

    // Annexe 11 — les affiches, UNE AFFICHE PAR PAGE (poster A4 entièrement rempli)
    var poster = function (emoji, titre, sousTitre, body, foot) {
      return '<section class="poster"><div class="pemoji">' + emoji + '</div><h2>' + esc(titre) + '</h2>' +
        (sousTitre ? '<div class="psub">' + esc(sousTitre) + '</div>' : '') +
        '<div class="pbody">' + body + '</div>' + (foot ? '<div class="pfoot">' + foot + '</div>' : '') + '</section>';
    };
    var ol = function (arr) { return '<ol>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>'; };
    var ul = function (arr) { return '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; };
    var chip = function (couleur, label) { return '<div class="ccrow"><span class="chip" style="background:' + couleur + '"></span><span>' + esc(label) + '</span></div>'; };
    var flow = function (etapes) { return '<div class="flowp">' + etapes.map(function (e) { return '<span class="st">' + esc(e) + '</span>'; }).join('<span class="ar">→</span>') + '</div>'; };

    var POSTERS = {
      'Se laver les mains': poster('🧼', 'Se laver les mains', 'Au moins 30 secondes',
        ol(['Mouiller les mains à l\'eau tiède', 'Savonner : paumes, dos, entre les doigts, ongles, poignets (30 s)',
          'Rincer abondamment', 'Sécher avec un essuie-mains à usage unique', 'Fermer le robinet avec l\'essuie-mains']),
        'Quand : prise de poste · sortie des toilettes · après les déchets · changement d\'activité · après s\'être mouché.'),
      'Plan de nettoyage & désinfection': poster('🧽', 'Plan de nettoyage & désinfection', 'Le protocole en 5 étapes',
        ol(['Pré-nettoyage : retirer les résidus', 'Lavage au détergent', 'Rinçage', 'Désinfection (respecter le temps de contact)', 'Rinçage final et séchage']),
        'Respecter la dilution et le temps d\'action du produit. Produits d\'entretien rangés à part, fermés, avec leur fiche de données de sécurité (FDS).'),
      'Rangement des enceintes froides': poster('🧊', 'Rangement des enceintes froides', null,
        ul(['Produits cuits / prêts à consommer EN HAUT', 'Produits crus EN BAS', 'Tout filmé, daté et étiqueté (DLC)',
          'Rotation FIFO (premier entré, premier sorti)', 'Jamais de carton ni de contenant souillé', 'Ne pas surcharger : l\'air doit circuler', 'Contrôler la température 2×/jour']), null),
      'Rangement de la réserve sèche': poster('📦', 'Rangement de la réserve sèche', null,
        ul(['Stockage hors-sol (étagères ou palettes)', 'Rotation FIFO', 'Contenants fermés et étiquetés',
          'Séparé des produits d\'entretien et des déchets', 'Local sec, propre et ventilé', 'Sacs entamés reconditionnés et datés']), null),
      'Les 14 allergènes': poster('🥜', 'Les 14 allergènes', 'À déclaration obligatoire (Règl. UE 1169/2011)',
        '<div class="grid14">' + (S.allergenes || []).map(function (a, i) { return '<div>' + (i + 1) + '. ' + esc(a) + '</div>'; }).join('') + '</div>',
        'Information du consommateur obligatoire. Voir le registre des allergènes par produit (Annexe 4).'),
      'Tenue & hygiène du personnel': poster('🧑‍🍳', 'Tenue & hygiène du personnel', null,
        ul(['Tenue propre, réservée à la production', 'Charlotte : cheveux entièrement couverts', 'Pas de bijoux, montre, faux ongles ni vernis',
          'Ongles courts et propres', 'Plaies protégées (pansement bleu détectable + gant)', 'Ne pas manger, boire ni fumer en zone de production']), null),
      'La marche en avant': poster('➡️', 'La marche en avant', 'Du « sale » vers le « propre », sans croisement',
        flow(['Réception', 'Stockage', 'Déconditionnement', 'Préparation', 'Cuisson', 'Refroidissement', 'Conservation', 'Vente']),
        'Si les locaux ne permettent pas la séparation dans l\'espace, l\'organiser dans le temps (nettoyage entre deux activités).'),
      'Relevé des températures': poster('🌡️', 'Températures réglementaires', 'À respecter et à relever',
        tableauTemperatures(S),
        'Relever les températures 2×/jour sur la fiche (Annexe 1). Toute dérive déclenche une action corrective.'),
      'En cas de suspicion d\'intoxication (TIAC)': poster('🚨', 'En cas de suspicion d\'intoxication (TIAC)', 'Toxi-infection alimentaire collective',
        ol(['Conserver les plats témoins et les restes suspects', 'Noter les produits servis et les symptômes',
          'Alerter immédiatement la DD(ETS)PP et l\'ARS', 'Isoler les denrées concernées', 'Coopérer à l\'enquête sanitaire']), null),
      'Code couleur des lavettes': poster('🧻', 'Code couleur des lavettes', 'Schéma indicatif — à adapter à votre établissement',
        chip('#2563eb', 'Bleu — Surfaces et plans de travail propres') + chip('#dc2626', 'Rouge — Sanitaires / zones à risque') +
        chip('#16a34a', 'Vert — Zone de préparation des légumes') + chip('#eab308', 'Jaune — Lavabos / usages divers'),
        'Une couleur = un usage. Ne jamais croiser les lavettes entre zones.'),
      'Code couleur des planches': poster('🔪', 'Code couleur des planches à découper', 'Une planche par famille de produit',
        chip('#dc2626', 'Rouge — Viande crue') + chip('#2563eb', 'Bleu — Poisson cru') + chip('#eab308', 'Jaune — Volaille crue') +
        chip('#16a34a', 'Vert — Fruits & légumes') + chip('#f8fafc', 'Blanc — Produits laitiers & boulangerie') + chip('#92400e', 'Marron — Viandes & légumes cuits'),
        'Évite les contaminations croisées. Nettoyer et désinfecter entre chaque usage.')
    };
    (S.affichesA4 || []).forEach(function (nom) {
      html += POSTERS[nom] || poster('📌', nom, null, '<p>Affiche à personnaliser au nom de l\'établissement.</p>', null);
    });

    html += '<div class="disclaimer"><b>Note importante :</b> ce Plan de Maîtrise Sanitaire est un modèle pré-rempli, ' +
      'généré automatiquement à partir des informations de votre établissement et du Guide de Bonnes Pratiques d\'Hygiène de votre secteur. ' +
      'Il doit être relu, complété (plans des locaux, fiches techniques de vos produits, coordonnées de vos prestataires) et tenu à jour. ' +
      'L\'éditeur de HACCP Pro fournit un outil d\'aide à l\'autocontrôle ; l\'exploitant reste seul responsable de la conformité de son établissement et de la sauvegarde de ses documents.</div>';

    return html;
  }

  // ── Construit le document HTML complet (autonome, imprimable en PDF) ──
  // Réutilisé par l'application (fenêtre) ET par les scripts Node (fichiers).
  function buildPMSDocument(cle, E, opts) {
    var PMS = getPMS();
    if (!PMS) return '';
    var S = PMS[cle] || PMS.resto;
    E = E || {}; opts = opts || {};
    var titre = 'PMS — ' + (E.nom || S.label);
    var toolbar = opts.noToolbar ? '' :
      '<div class="toolbar noprint"><span class="t">📄 Plan de Maîtrise Sanitaire — ' + esc(S.label) + '</span>' +
      '<button onclick="window.print()">🖨️ Imprimer / PDF</button></div>';
    // Paginateur MAISON, borné : range les blocs de .sheet dans des pages A4 et
    // tamponne « Page X / Y ». Ne peut PAS exploser (un bloc = placé une fois ;
    // nb de pages ≤ nb de blocs). Aucun clip → pas de perte de contenu.
    var paginator = '<script>(function(){function P(){var s=document.querySelector(".sheet");' +
      'if(!s||s.getAttribute("data-paged"))return;s.setAttribute("data-paged","1");' +
      'var ks=[],i;for(i=0;i<s.childNodes.length;i++)ks.push(s.childNodes[i]);' +
      'var W=document.createElement("div");W.className="pages";s.parentNode.insertBefore(W,s);' +
      'var pg,bd,n=0,MAX=1000;function np(){n++;pg=document.createElement("div");pg.className="pg";' +
      'bd=document.createElement("div");pg.appendChild(bd);var f=document.createElement("div");' +
      'f.className="pgft";pg.appendChild(f);pg._f=f;W.appendChild(pg);}np();' +
      'for(var j=0;j<ks.length;j++){var b=ks[j];var c=(b.nodeType===1&&b.className)?(""+b.className):"";' +
      'if(c.indexOf("page-break")>=0){if(bd.childNodes.length)np();continue;}' +
      'var force=/(\\bcover\\b|\\bpart\\b|\\bapage\\b|\\bposter\\b)/.test(c);' +
      'if(force&&bd.childNodes.length)np();bd.appendChild(b);' +
      'if(bd.offsetHeight>MAX&&bd.childNodes.length>1){bd.removeChild(b);np();bd.appendChild(b);}}' +
      's.parentNode.removeChild(s);var ps=W.querySelectorAll(".pg"),T=ps.length;' +
      'for(var k=0;k<ps.length;k++)ps[k]._f.textContent="Page "+(k+1)+" / "+T;}' +
      'if(document.readyState!=="loading")setTimeout(P,30);' +
      'else document.addEventListener("DOMContentLoaded",function(){setTimeout(P,30);});})();<\/script>';
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(titre) + '</title><style>' + PMS_CSS + '</style></head><body>' +
      toolbar + '<div class="sheet">' + corpsPMS(S, E) + '</div>' + paginator + '</body></html>';
  }

  // ── Point d'entrée navigateur : ouvre le PMS imprimable du secteur actif ──
  if (typeof window !== 'undefined') {
    window.genererPMS = function (secteurForce) {
      var PMS = getPMS();
      if (!PMS) {
        if (typeof showToast === 'function') showToast('Contenu PMS indisponible', 'warn', 3000);
        else alert('Contenu PMS indisponible.');
        return;
      }
      var cle = secteurForce || secteurActif();
      // Vue INTÉGRÉE à l'app (overlay plein écran + iframe isolé), avec un vrai
      // bouton « ← Retour ». Évite l'onglet orphelin / le « plus que Quitter »
      // qu'on avait avec window.open sur l'iPhone (PWA).
      var anc = document.getElementById('pmsOverlay');
      if (anc && anc.parentNode) anc.parentNode.removeChild(anc);
      var ov = document.createElement('div');
      ov.id = 'pmsOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e5e7eb;display:flex;flex-direction:column';
      var bar = document.createElement('div');
      bar.style.cssText = 'flex:0 0 auto;background:#1e1b4b;color:#fff;padding:calc(8px + env(safe-area-inset-top,0px)) 14px 8px;display:flex;gap:10px;align-items:center;justify-content:space-between';
      bar.innerHTML =
        '<button id="pmsBack" style="background:rgba(255,255,255,.16);color:#fff;border:none;border-radius:9px;font:700 14px Arial;padding:9px 16px;cursor:pointer">← Retour</button>' +
        '<span style="font:700 13px Arial;flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Plan de Maîtrise Sanitaire</span>' +
        '<button id="pmsPrint" style="background:#fff;color:#1e1b4b;border:none;border-radius:9px;font:700 14px Arial;padding:9px 16px;cursor:pointer">🖨️ PDF</button>';
      var ifr = document.createElement('iframe');
      ifr.style.cssText = 'flex:1;width:100%;border:none;background:#fff';
      ov.appendChild(bar); ov.appendChild(ifr);
      document.body.appendChild(ov);
      try {
        var idoc = ifr.contentWindow.document;
        idoc.open(); idoc.write(buildPMSDocument(cle, etab(), { noToolbar: true })); idoc.close();
      } catch (e) {
        ifr.setAttribute('srcdoc', buildPMSDocument(cle, etab(), { noToolbar: true }));
      }
      var fermer = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
      document.getElementById('pmsBack').onclick = fermer;
      document.getElementById('pmsPrint').onclick = function () {
        try { ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (e2) { try { window.print(); } catch (e3) {} }
      };
    };

    // Choix du secteur avant génération (depuis l'admin / multi-secteurs)
    window.genererPMSChoix = function () {
      var PMS = getPMS(); if (!PMS) return;
      var labels = Object.keys(PMS).map(function (k) { return PMS[k].emoji + ' ' + PMS[k].label + ' (' + k + ')'; }).join('\n');
      var rep = window.prompt('Secteur du PMS à générer :\n' + labels + '\n\nTapez la clé (resto / bp / rapide / boucherie / collective) :', secteurActif());
      if (!rep) return;
      rep = String(rep).trim().toLowerCase();
      if (!PMS[rep]) { alert('Secteur inconnu : ' + rep); return; }
      window.genererPMS(rep);
    };
  }

  // ── Export Node (scripts de génération de fichiers + tests) ──
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPMSDocument: buildPMSDocument, corpsPMS: corpsPMS };
  }
})();
