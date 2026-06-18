-- ════════════════════════════════════════════════════════════════════════
--  BRIQUE 2 — SUPERVISION CAPTEURS (vue administrateur)  — v2
--  HACCP Pro — voir l'état des capteurs RÉELLEMENT configurés chez les clients
-- ════════════════════════════════════════════════════════════════════════
--  v2 : on n'affiche QUE les capteurs présents dans la config actuelle de
--  chaque client (__sondes_config__), identifiés par leur CANAL — fini les
--  doublons / enceintes fantômes issus d'anciens tests. Pour chaque capteur :
--  son dernier relevé (apparié par canal), température, état, heure.
--
--  Sécurité : « security definer » mais PROTÉGÉE PAR MOT DE PASSE.
--  Pré-requis : la fonction de relevé doit écrire le canal dans le contrôle
--  (champ contenu->>'channel') — voir releves_auto_ubibot.sql (à jour).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.supervision_capteurs(p_pwd text)
returns table(
  etablissement text,
  code_client   text,
  frigo         text,
  temperature   text,
  conforme      boolean,
  derniere      timestamptz,
  hors_service  boolean
)
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  _admin text;
begin
  -- SÉCURITÉ : le mot de passe admin n'est PLUS codé en dur ici. On le lit dans le
  -- Vault (secret 'admin_password'). À créer UNE fois :
  --   select vault.create_secret('VOTRE_MDP_ADMIN','admin_password','Mot de passe admin HACCP');
  -- Repli : si le secret n'existe pas encore, on tolère l'ancien '826700' (transition).
  begin
    select decrypted_secret into _admin from vault.decrypted_secrets where name = 'admin_password' limit 1;
  exception when others then _admin := null; end;
  if _admin is null or _admin = '' then _admin := '826700'; end if;  -- repli transitoire
  if p_pwd is distinct from _admin then
    return;
  end if;

  return query
  with cfg as (   -- dernière config de chaque client
    select distinct on (cc.code_client)
           cc.code_client, cc.contenu->'sondes' as sondes
    from public.controles_haccp cc
    where cc.module = '__sondes_config__'
    order by cc.code_client, cc.created_at desc
  ),
  capteurs as (   -- un capteur = un canal présent dans la config actuelle
    select cfg.code_client,
           (s->>'channel')                                   as channel,
           coalesce(s->>'enceinte', s->>'nom', 'Capteur')    as frigo
    from cfg
    cross join lateral jsonb_array_elements(cfg.sondes) as s
    where coalesce(s->>'channel','') <> ''
  ),
  dernier as (    -- dernier relevé auto, apparié par canal
    select distinct on (c.code_client, (c.contenu->>'channel'))
           c.code_client,
           (c.contenu->>'channel')                                       as channel,
           (c.contenu->'temperatures'->0->>'temp')                       as temp,
           not coalesce((c.contenu->'temperatures'->0->>'isNC')::boolean,false) as conforme,
           c.recorded_at                                                 as derniere
    from public.controles_haccp c
    where c.module = 'Températures enceintes'
      and c.contenu->>'source' = 'ubibot'
      and c.contenu->>'channel' is not null
    order by c.code_client, (c.contenu->>'channel'), c.recorded_at desc
  )
  select
    coalesce(e.nom, cap.code_client)                                      as etablissement,
    cap.code_client,
    cap.frigo,
    d.temp                                                               as temperature,
    coalesce(d.conforme, false)                                          as conforme,
    d.derniere,
    (d.derniere is null or d.derniere < now() - interval '26 hours')     as hors_service
  from capteurs cap
  left join public.etablissements e on e.code_acces = cap.code_client
  left join dernier d on d.code_client = cap.code_client and d.channel = cap.channel
  order by etablissement, frigo;
end;
$$;

grant execute on function public.supervision_capteurs(text) to anon, authenticated;

-- ── Test ──  select * from public.supervision_capteurs('826700');
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- admin_check — valide le mot de passe ADMIN côté SERVEUR (via Vault).
-- Permet de retirer le mot de passe du code CLIENT : l'app envoie le mot de
-- passe saisi, le serveur répond true/false. Repli transitoire sur '826700'.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.admin_check(p_pwd text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare _a text;
begin
  begin select decrypted_secret into _a from vault.decrypted_secrets where name = 'admin_password' limit 1;
  exception when others then _a := null; end;
  if _a is null or _a = '' then _a := '826700'; end if;  -- repli transitoire
  return p_pwd is not null and p_pwd = _a;
end $$;
grant execute on function public.admin_check(text) to anon, authenticated;
-- Test :  select public.admin_check('826700');  -> true
