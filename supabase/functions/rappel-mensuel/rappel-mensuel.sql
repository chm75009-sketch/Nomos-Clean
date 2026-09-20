-- ───────────────────────────────────────────────────────────────────────────
-- Nomos — SQL pour l'envoi mensuel du rappel « exportez votre Pack DDPP »
-- À exécuter dans Supabase → SQL Editor. Deux parties : (1) la RPC qui liste les
-- clients actifs, (2) la planification pg_cron qui appelle la fonction chaque mois.
-- ───────────────────────────────────────────────────────────────────────────

-- ⚠️ VÉRIFIER LES NOMS DE TABLE/COLONNES : adapter `comptes_clients`, `email`,
-- `nom`/`etablissement`, `date_expiration` à votre schéma réel si besoin.

-- (1) RPC SECURITY DEFINER : renvoie les clients actifs ayant un e-mail.
create or replace function public.clients_actifs_pour_rappel()
returns table(email text, nom text)
language sql
security definer
set search_path = public
as $$
  select c.email::text,
         coalesce(c.etablissement, c.nom, '')::text as nom
  from public.comptes_clients c
  where c.email is not null
    and c.email <> ''
    and (c.date_expiration is null or c.date_expiration >= now())
$$;

-- Cette RPC ne doit PAS être appelable par le public : révoquer l'accès anonyme.
revoke all on function public.clients_actifs_pour_rappel() from anon, authenticated, public;
-- (elle reste appelable par la service_role, utilisée par l'Edge Function)

-- ───────────────────────────────────────────────────────────────────────────
-- (2) Planification mensuelle via pg_cron + pg_net.
--     Activer les extensions si nécessaire (Database → Extensions) :
--       - pg_cron
--       - pg_net
-- ───────────────────────────────────────────────────────────────────────────

-- Remplacer <CRON_SECRET> par la même valeur que le secret Supabase CRON_SECRET.
-- L'URL est celle de la fonction rappel-mensuel.

select cron.schedule(
  'rappel-pack-ddpp-mensuel',
  '0 8 1 * *',   -- le 1er de chaque mois à 08:00 UTC
  $$
  select net.http_post(
    url     := 'https://kiknaxuzpovvivkjqzss.supabase.co/functions/v1/rappel-mensuel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Pour arrêter la planification plus tard :
--   select cron.unschedule('rappel-pack-ddpp-mensuel');

-- Pour tester tout de suite (une exécution immédiate), lancer manuellement :
--   select net.http_post(
--     url:='https://kiknaxuzpovvivkjqzss.supabase.co/functions/v1/rappel-mensuel',
--     headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body:='{}'::jsonb);
