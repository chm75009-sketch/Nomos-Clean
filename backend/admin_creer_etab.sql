-- ============================================================================
-- Création ADMIN d'un établissement (client payant) via fonction sécurisée.
-- À EXÉCUTER UNE FOIS dans Supabase → SQL Editor (projet kiknaxuzpovvivkjqzss).
-- Protégée par le mot de passe admin. Permet de garder une expiration LONGUE
-- (clients payants) alors qu'on va bientôt limiter l'INSERT anonyme aux essais.
--
-- Robuste : n'insère QUE les colonnes réellement présentes dans la table
-- (responsable/telephone/email peuvent ne pas exister selon le déploiement).
-- ============================================================================

create or replace function public.admin_creer_etab(p_pwd text, p_row jsonb)
returns json language plpgsql security definer set search_path = public, vault as $$
declare
  _allow text[] := array['code_acces','mot_de_passe','nom','secteur','adresse','actif',
                         'date_debut','date_expiration','multi_secteur','responsable','telephone','email','siret'];
  _cols text := ''; _vals text := ''; _k text;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  for _k in select jsonb_object_keys(p_row) loop
    if _k = any(_allow)
       and exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'etablissements' and column_name = _k) then
      _cols := _cols || (case when _cols = '' then '' else ', ' end) || quote_ident(_k);
      _vals := _vals || (case when _vals = '' then '' else ', ' end) ||
        case
          when (p_row->_k) = 'null'::jsonb then 'NULL'
          when _k in ('actif','multi_secteur') then quote_literal(p_row->>_k) || '::boolean'
          when _k in ('date_debut','date_expiration') then quote_literal(p_row->>_k) || '::date'
          else quote_literal(p_row->>_k)
        end;
    end if;
  end loop;
  if _cols = '' then return json_build_object('ok', false, 'reason', 'no_fields'); end if;
  execute 'insert into public.etablissements (' || _cols || ') values (' || _vals || ')';
  return json_build_object('ok', true);
end $$;
grant execute on function public.admin_creer_etab(text, jsonb) to anon, authenticated;

-- Après exécution :  NOTIFY pgrst, 'reload schema';
