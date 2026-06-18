-- ════════════════════════════════════════════════════════════════════════════
-- DATA-9 — Déduplication SERVEUR des contrôles HACCP
-- À exécuter UNE fois dans le SQL Editor de Supabase (rôle service → ignore la RLS).
-- Objectif : empêcher définitivement les doublons (re-push réseau, espion 3s + envoi
-- immédiat, réconciliation) et nettoyer ceux déjà présents, SANS perdre de photos.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Colonne uid (identifiant client stable du contrôle, posé à la sauvegarde).
alter table public.controles_haccp add column if not exists uid text;

-- 2) Backfill : récupérer l'uid déjà présent dans le JSON 'contenu' des contrôles
--    existants. Le cast ::jsonb gère aussi bien une colonne jsonb que text-JSON.
update public.controles_haccp
   set uid = (contenu::jsonb)->>'uid'
 where uid is null
   and (contenu::jsonb) ? 'uid'
   and coalesce((contenu::jsonb)->>'uid', '') <> '';

-- 3) Nettoyage des doublons EXISTANTS partageant le même (code_client, uid) :
--    on GARDE la ligne qui porte le PLUS de photos (puis la plus ancienne), on
--    supprime les autres. length(photos::text) est neutre vis-à-vis du type de la
--    colonne (jsonb ou text) et préserve la ligne la plus complète.
delete from public.controles_haccp c
 using (
   select id,
          row_number() over (
            partition by code_client, uid
            order by length(coalesce(photos::text, '')) desc,
                     date_controle asc,
                     id asc
          ) as rn
     from public.controles_haccp
    where uid is not null
 ) d
 where c.id = d.id
   and d.rn > 1;

-- 4) Index unique → bloque DÉFINITIVEMENT tout nouveau doublon. Les uid NULL (contrôles
--    historiques sans uid) restent autorisés en plusieurs exemplaires : NULL est
--    considéré distinct dans un index unique Postgres.
create unique index if not exists controles_haccp_client_uid_uidx
  on public.controles_haccp (code_client, uid);

-- 5) VÉRIFICATION : doit renvoyer 0 ligne (plus aucun doublon non-null).
select code_client, uid, count(*)
  from public.controles_haccp
 where uid is not null
 group by code_client, uid
having count(*) > 1;
