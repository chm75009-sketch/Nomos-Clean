-- ════════════════════════════════════════════════════════════════════════
--  PURGE AUTOMATIQUE DES PHOTOS DE PLUS DE 18 MOIS  —  HACCP Pro
-- ════════════════════════════════════════════════════════════════════════
--  But : empêcher la saturation du Storage Supabase. Chaque nuit, les photos
--  du bucket « haccp-photos » de plus de 18 mois sont SUPPRIMÉES du disque
--  (le fichier ET sa fiche), ce qui libère réellement l'espace.
--
--  ⚠️ Ne touche JAMAIS aux contrôles (table controles_haccp) : seuls les
--     fichiers image de plus de 18 mois sont effacés. Les enregistrements
--     de contrôle restent intacts pour toujours.
--
--  À coller dans Supabase → SQL Editor, dans l'ordre (étapes 1 à 5).
-- ════════════════════════════════════════════════════════════════════════


-- ── ÉTAPE 1 — Activer les extensions nécessaires ────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ── ÉTAPE 2 — Mettre la clé service_role en coffre-fort (Vault) ─────────
-- Récupère ta clé : Supabase → Project Settings → API → « service_role »
-- (clé secrète). Remplace COLLE_TA_CLE_SERVICE_ROLE_ICI ci-dessous.
-- (À ne faire qu'UNE fois.)
select vault.create_secret(
  'COLLE_TA_CLE_SERVICE_ROLE_ICI',
  'service_role_key',
  'Clé service_role utilisée par la purge automatique des photos'
);


-- ── ÉTAPE 3 — La fonction de purge ──────────────────────────────────────
create or replace function purge_photos_18_mois()
returns integer
language plpgsql
security definer
set search_path = public, storage, vault, net
as $$
declare
  k   text;
  rec record;
  n   integer := 0;
begin
  -- Récupère la clé service_role depuis le Vault
  select decrypted_secret into k
  from vault.decrypted_secrets
  where name = 'service_role_key'
  limit 1;

  if k is null then
    raise notice 'Clé service_role absente du Vault — purge annulée.';
    return 0;
  end if;

  -- Jusqu'à 300 photos par passage (le reste partira les nuits suivantes)
  for rec in
    select name
    from storage.objects
    where bucket_id = 'haccp-photos'
      and created_at < now() - interval '18 months'
    order by created_at asc
    limit 300
  loop
    -- Suppression propre via l'API Storage (fichier + fiche, aucun orphelin)
    perform net.http_delete(
      url     := 'https://kiknaxuzpovvivkjqzss.supabase.co/storage/v1/object/haccp-photos/' || rec.name,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || k,
        'apikey',        k
      )
    );
    n := n + 1;
  end loop;

  raise notice 'Purge photos : % fichier(s) de +18 mois envoyés à la suppression.', n;
  return n;
end;
$$;


-- ── ÉTAPE 4 — Planifier la purge chaque nuit à 03h00 ───────────────────
select cron.schedule(
  'purge-photos-18-mois',
  '0 3 * * *',
  $$ select purge_photos_18_mois(); $$
);


-- ── ÉTAPE 5 (facultatif) — Lancer une fois maintenant pour tester ──────
select purge_photos_18_mois();


-- ════════════════════════════════════════════════════════════════════════
--  OUTILS DE CONTRÔLE (à coller quand tu veux)
-- ════════════════════════════════════════════════════════════════════════

-- Combien de photos seraient supprimées (et quel espace libéré) ?
--   select count(*) as nb_photos,
--          pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as espace
--   from storage.objects
--   where bucket_id = 'haccp-photos'
--     and created_at < now() - interval '18 months';

-- Voir que la tâche nocturne est bien programmée :
--   select jobname, schedule, active from cron.job where jobname = 'purge-photos-18-mois';

-- Désactiver / supprimer la purge si besoin :
--   select cron.unschedule('purge-photos-18-mois');

-- Changer la durée (ex : 24 mois) : ré-exécuter l'ÉTAPE 3 en remplaçant
--   « interval '18 months' » par « interval '24 months' ».
-- ════════════════════════════════════════════════════════════════════════
