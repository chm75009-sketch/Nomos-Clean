// ════════════════════════════════════════════════════════════════
// PATCH PHOTO BL — V118 (avec Pack DDPP)
// 1) Ajoute case à cocher "BL lisible" sous la photo du bon de livraison
// 2) Insère cette photo dans le PDF de réception (si case cochée)
// 3) Insère cette photo dans le rapport Pack DDPP (depuis la mémoire locale)
// Ce fichier se charge APRÈS script.js et "patche" les fonctions sans modifier
// le fichier principal.
// ════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function appliquerPatch() {
    if (typeof window.previewPhotoBL !== 'function' ||
        typeof window.imprimerReception !== 'function' ||
        typeof window.validerReception !== 'function') {
      setTimeout(appliquerPatch, 100);
      return;
    }
    console.info('[Patch Photo BL] ✓ Application du patch V118');

    // ── 1) previewPhotoBL : remplace par version avec case à cocher ──
    window.previewPhotoBL = function(input) {
      var prev = document.getElementById('preview_bl');
      if (!prev || !input.files || !input.files[0]) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        var apresCompression = function(compressed) {
          prev.innerHTML =
            '<div id="photo_bl_wrapper" style="margin-top:8px">' +
              '<div id="photo_bl_banner" style="background:#dc2626;color:white;font-size:13px;font-weight:800;padding:10px 12px;border-radius:10px 10px 0 0;text-align:center;line-height:1.4">' +
                '❌ PHOTO NON VALIDE — Cochez la case ci-dessous pour qu\'elle soit acceptée' +
              '</div>' +
              '<img id="photo_bl_img" src="' + compressed + '" alt="Photo bon de livraison" style="display:block;width:100%;max-height:200px;object-fit:contain;border:3px solid #dc2626;border-top:none;border-radius:0 0 10px 10px;box-sizing:border-box;background:#f9fafb"/>' +
              '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;cursor:pointer;margin-top:8px">' +
                '<input type="checkbox" id="ph_bl_ok" onchange="verifierPhotoBL()" style="width:18px;height:18px"/> Le bon de livraison est bien lisible sur la photo' +
              '</label>' +
              '<div id="photo_bl_status" style="display:block;font-size:11px;font-weight:700;border-radius:6px;padding:6px 8px;margin-top:6px;line-height:1.4;background:#fef2f2;color:#dc2626;border:1px solid #fecaca">' +
                '⚠️ Photo NON valide — sera supprimée à la validation si vous ne cochez pas la case' +
              '</div>' +
            '</div>';
          if (typeof apresLaCapturePhoto === 'function') {
            apresLaCapturePhoto(compressed, 'bl', 'bon_livraison');
          }
        };
        if (typeof compresserPhoto === 'function') {
          compresserPhoto(e.target.result, apresCompression);
        } else {
          apresCompression(e.target.result);
        }
      };
      reader.readAsDataURL(input.files[0]);
    };

    // ── 2) verifierPhotoBL ──
    window.verifierPhotoBL = function() {
      var blOk = document.getElementById('ph_bl_ok');
      var img = document.getElementById('photo_bl_img');
      var banner = document.getElementById('photo_bl_banner');
      var status = document.getElementById('photo_bl_status');
      if (!img) return;
      if (blOk && blOk.checked) {
        if (banner) banner.style.display = 'none';
        img.style.border = '3px solid #16a34a';
        img.style.borderTop = '3px solid #16a34a';
        img.style.borderRadius = '10px';
        if (status) {
          status.style.background = '#dcfce7';
          status.style.color = '#15803d';
          status.style.border = '1px solid #86efac';
          status.innerHTML = '✓ Photo acceptée comme preuve';
        }
      } else {
        if (banner) banner.style.display = 'block';
        img.style.border = '3px solid #dc2626';
        img.style.borderTop = 'none';
        img.style.borderRadius = '0 0 10px 10px';
        if (status) {
          status.style.background = '#fef2f2';
          status.style.color = '#dc2626';
          status.style.border = '1px solid #fecaca';
          status.innerHTML = '⚠️ Photo NON valide — sera supprimée à la validation si vous ne cochez pas la case';
        }
      }
    };

    // ── 3) validerReception : nettoyer la photo BL si pas cochée ──
    var _originalValiderReception = window.validerReception;
    window.validerReception = async function() {
      var blOk = document.getElementById('ph_bl_ok');
      var blImg = document.getElementById('photo_bl_img');
      if (blImg && (!blOk || !blOk.checked)) {
        blImg.src = '';
        var blWrapper = document.getElementById('photo_bl_wrapper');
        if (blWrapper) blWrapper.style.display = 'none';
      }
      return _originalValiderReception.apply(this, arguments);
    };

    // ── 4) imprimerReception : DÉSACTIVÉ — script.js rend désormais la photo BL nativement (script.js:5954-5961). L'injection ici créait un doublon dans le PDF Réception.

    // ── 5) NOUVEAU : Pack DDPP — récupère la photo BL depuis Supabase + Dexie locale ──
    if (typeof window.lancerPackDDPPAvecPhotos === 'function') {
      var _originalLancerPack = window.lancerPackDDPPAvecPhotos;
      window.lancerPackDDPPAvecPhotos = async function(dateFrom, dateTo, selectionIds) {
        var resultat = await _originalLancerPack.apply(this, arguments);
        setTimeout(injecterPhotosBLPackDDPP, 300);
        return resultat;
      };
      console.info('[Patch Photo BL] ✓ lancerPackDDPPAvecPhotos surchargée');
    }

    async function injecterPhotosBLPackDDPP() {
      try {
        var blocsReception = document.querySelectorAll('[data-controle-module="reception"][data-controle-ts]');
        if (blocsReception.length === 0) return;
        console.info('[Patch Photo BL Pack DDPP] ' + blocsReception.length + ' bloc(s) Réception trouvé(s)');

        var photosBLLocales = [];
        if (typeof photoQueueDB !== 'undefined' && photoQueueDB && photoQueueDB.photos) {
          try {
            var toutes = await photoQueueDB.photos.toArray();
            photosBLLocales = toutes.filter(function(p) {
              return p.source === 'bon_livraison' && p.base64;
            });
            console.info('[Patch Photo BL Pack DDPP] ' + photosBLLocales.length + ' photo(s) BL en mémoire locale');
          } catch(eDexie) {
            console.warn('[Patch Photo BL Pack DDPP] Erreur lecture Dexie:', eDexie);
          }
        }

        for (var i = 0; i < blocsReception.length; i++) {
          var bloc = blocsReception[i];
          if (bloc.querySelector('.patch-bl-pack-ddpp')) continue;
          // V121 — anti-doublon : l'injection Supabase (lancerPackDDPPAvecPhotos) a déjà posé la photo BL
          if (bloc.getAttribute('data-bl-photo-done') === '1') continue;

          var imgsExistantes = bloc.querySelectorAll('img');
          var dejaInjectee = false;
          for (var j = 0; j < imgsExistantes.length; j++) {
            if ((imgsExistantes[j].src || '').indexOf('bon_livraison') > -1) {
              dejaInjectee = true;
              break;
            }
          }
          // V121 — filet de sécurité : un groupe « Bon de livraison » est déjà présent dans le bloc
          if (!dejaInjectee && bloc.textContent && bloc.textContent.indexOf('Bon de livraison') > -1) {
            dejaInjectee = true;
          }
          if (dejaInjectee) {
            console.info('[Patch Photo BL Pack DDPP] Bloc ' + i + ' : photo BL déjà présente (depuis Supabase)');
            continue;
          }

          var tsBloc = new Date(bloc.getAttribute('data-controle-ts')).getTime();
          if (isNaN(tsBloc)) continue;

          var meilleur = null;
          var ecartMin = 10 * 60 * 1000;
          photosBLLocales.forEach(function(p) {
            var tsP = new Date(p.createdAt).getTime();
            if (isNaN(tsP)) return;
            var ecart = Math.abs(tsBloc - tsP);
            if (ecart <= ecartMin) {
              if (!meilleur || ecart < Math.abs(tsBloc - new Date(meilleur.createdAt).getTime())) {
                meilleur = p;
              }
            }
          });

          if (meilleur) {
            var photoHtml =
              '<div class="patch-bl-pack-ddpp" style="margin-top:10px;padding:10px;border:1.5px solid #2563eb;border-radius:8px;background:#eff6ff;break-inside:avoid">' +
                '<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:6px">📄 Photo du bon de livraison</div>' +
                '<div style="text-align:center">' +
                  '<img src="' + meilleur.base64 + '" alt="Bon de livraison" style="max-width:100%;max-height:280px;border:1px solid #d1d5db;border-radius:4px"/>' +
                '</div>' +
              '</div>';
            bloc.insertAdjacentHTML('beforeend', photoHtml);
            bloc.setAttribute('data-bl-photo-done', '1'); // V121 — anti-doublon
            console.info('[Patch Photo BL Pack DDPP] ✓ Photo BL injectée dans bloc Réception ' + i);
          } else {
            console.info('[Patch Photo BL Pack DDPP] Bloc ' + i + ' : pas de photo BL trouvée en mémoire locale');
          }
        }
      } catch(e) {
        console.warn('[Patch Photo BL Pack DDPP] Erreur:', e);
      }
    }

    console.info('[Patch Photo BL] ✓ Patch V118 actif (5 fonctions patchées)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appliquerPatch);
  } else {
    appliquerPatch();
  }
})();
