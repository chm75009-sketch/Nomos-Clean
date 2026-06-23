-- ============================================================================
-- Écritures ADMIN sur etablissements (contournement RLS contrôlé).
-- Complète admin_set_etat_etab. À EXÉCUTER UNE FOIS dans Supabase → SQL Editor
-- (projet kiknaxuzpovvivkjqzss). Toutes protégées par le mot de passe admin.
--
-- Couvre : Modifier un compte, actions clients (désactiver/réactiver/prolonger),
-- suppression réelle de l'accès (unitaire + lot), bascule sauvegarde quotidienne.
-- ============================================================================

-- 1) MISE À JOUR générique (par id OU code d'accès), via un patch JSON sécurisé.
create or replace function public.admin_update_etab(
  p_pwd text, p_id text default null, p_code text default null, p_patch jsonb default '{}'::jsonb
) returns json
language plpgsql security definer set search_path = public, vault
as $$
declare
  _allow text[] := array['nom','secteur','mot_de_passe','multi_secteur','date_expiration',
                         'actif','sauvegarde_off','date_desactivation','motif_desactivation'];
  _k text; _sets text := ''; _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  if p_id is null and p_code is null then return json_build_object('ok', false, 'reason', 'no_target'); end if;
  for _k in select jsonb_object_keys(p_patch) loop
    if _k = any(_allow) then
      _sets := _sets || (case when _sets = '' then '' else ', ' end) || quote_ident(_k) || ' = ' ||
        case
          when (p_patch->_k) = 'null'::jsonb then 'NULL'
          when _k in ('actif','multi_secteur','sauvegarde_off') then quote_literal(p_patch->>_k) || '::boolean'
          when _k = 'date_expiration'   then quote_literal(p_patch->>_k) || '::date'
          when _k = 'date_desactivation' then quote_literal(p_patch->>_k) || '::timestamptz'
          else quote_literal(p_patch->>_k)
        end;
    end if;
  end loop;
  if _sets = '' then return json_build_object('ok', false, 'reason', 'no_fields'); end if;
  execute 'update public.etablissements set ' || _sets || ' where ' ||
    case when p_id is not null then 'id::text = ' || quote_literal(p_id)
         else 'code_acces = ' || quote_literal(p_code) end;
  get diagnostics _cnt = row_count;
  return json_build_object('ok', _cnt > 0, 'updated', _cnt);
end $$;
grant execute on function public.admin_update_etab(text, text, text, jsonb) to anon, authenticated;

-- 2) SUPPRESSION d'un accès (par id OU code).
create or replace function public.admin_delete_etab(p_pwd text, p_id text default null, p_code text default null)
returns json language plpgsql security definer set search_path = public, vault as $$
declare _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  if p_id is not null then delete from public.etablissements where id::text = p_id;
  elsif p_code is not null then delete from public.etablissements where code_acces = p_code;
  else return json_build_object('ok', false, 'reason', 'no_target'); end if;
  get diagnostics _cnt = row_count;
  return json_build_object('ok', true, 'deleted', _cnt);
end $$;
grant execute on function public.admin_delete_etab(text, text, text) to anon, authenticated;

-- 3) SUPPRESSION groupée (liste de codes, en JSON).
create or replace function public.admin_delete_etabs(p_pwd text, p_codes jsonb)
returns json language plpgsql security definer set search_path = public, vault as $$
declare _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  delete from public.etablissements where code_acces in (select jsonb_array_elements_text(p_codes));
  get diagnostics _cnt = row_count;
  return json_build_object('ok', true, 'deleted', _cnt);
end $$;
grant execute on function public.admin_delete_etabs(text, jsonb) to anon, authenticated;

-- 4) BASCULE sauvegarde quotidienne (sélection de codes, ou TOUS). EXECUTE dynamique
--    pour tolérer l'absence éventuelle de la colonne sauvegarde_off à la création.
create or replace function public.admin_set_sauvegarde(
  p_pwd text, p_codes jsonb default '[]'::jsonb, p_off boolean default true, p_all boolean default false
) returns json language plpgsql security definer set search_path = public, vault as $$
declare _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  if p_all then
    execute 'update public.etablissements set sauvegarde_off = $1' using p_off;
  else
    execute 'update public.etablissements set sauvegarde_off = $1
             where code_acces in (select jsonb_array_elements_text($2))' using p_off, p_codes;
  end if;
  get diagnostics _cnt = row_count;
  return json_build_object('ok', true, 'updated', _cnt);
end $$;
grant execute on function public.admin_set_sauvegarde(text, jsonb, boolean, boolean) to anon, authenticated;

-- Après exécution, recharger le cache d'API si besoin :  NOTIFY pgrst, 'reload schema';
