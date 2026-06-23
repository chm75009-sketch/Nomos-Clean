-- ============================================================================
-- Écritures ADMIN sur comptes_clients (contournement RLS contrôlé).
-- Complète admin_ecritures_etab. À EXÉCUTER UNE FOIS dans Supabase → SQL Editor
-- (projet kiknaxuzpovvivkjqzss). Toutes protégées par le mot de passe admin.
--
-- But : la table comptes_clients (registre admin) n'a plus besoin d'être
-- ouverte en écriture à la clé publique. Le panneau admin écrit désormais via
-- ces fonctions sécurisées ; ensuite on ferme les règles anon (2e bloc séparé).
-- ============================================================================

-- ── BLOC 1 — créer les fonctions (n'enlève rien, ne casse rien) ──────────────

-- 1) Activer / désactiver une fiche client (désactiverClient / réactiverClient).
create or replace function public.admin_set_compte_actif(
  p_pwd text, p_id text, p_actif boolean, p_motif text default null
) returns json language plpgsql security definer set search_path = public, vault as $$
declare _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  update public.comptes_clients
     set actif = p_actif,
         date_desactivation  = case when p_actif then null else now() end,
         motif_desactivation = case when p_actif then null else coalesce(p_motif, '') end
   where id::text = p_id;
  get diagnostics _cnt = row_count;
  return json_build_object('ok', _cnt > 0, 'updated', _cnt);
end $$;
grant execute on function public.admin_set_compte_actif(text, text, boolean, text) to anon, authenticated;

-- 2) Créer une fiche client (creerClientDirect).
create or replace function public.admin_creer_compte(
  p_pwd text, p_code_acces text, p_mot_de_passe text, p_etablissement text,
  p_email text, p_formule text, p_engagement text, p_date_debut date
) returns json language plpgsql security definer set search_path = public, vault as $$
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  insert into public.comptes_clients
        (code_acces, mot_de_passe, etablissement, email, formule, engagement, date_debut, actif)
  values (p_code_acces, p_mot_de_passe, p_etablissement, p_email, p_formule, p_engagement, p_date_debut, true);
  return json_build_object('ok', true);
end $$;
grant execute on function public.admin_creer_compte(text, text, text, text, text, text, text, date) to anon, authenticated;

-- 3) Supprimer des fiches clients (unitaire ou lot) par id.
create or replace function public.admin_delete_comptes(p_pwd text, p_ids jsonb)
returns json language plpgsql security definer set search_path = public, vault as $$
declare _cnt int;
begin
  if not public.admin_check(p_pwd) then raise exception 'unauthorized'; end if;
  delete from public.comptes_clients
   where id::text in (select jsonb_array_elements_text(p_ids));
  get diagnostics _cnt = row_count;
  return json_build_object('ok', true, 'deleted', _cnt);
end $$;
grant execute on function public.admin_delete_comptes(text, jsonb) to anon, authenticated;

-- Recharger le cache d'API si besoin :  NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- ── BLOC 2 — À LANCER SEULEMENT APRÈS avoir vérifié que le panneau admin
--    fonctionne encore (création / désactivation / suppression de clients).
--    Ferme l'écriture directe de comptes_clients à la clé publique.
-- ============================================================================
-- do $$
-- declare r record;
-- begin
--   for r in select policyname from pg_policies
--            where schemaname='public' and tablename='comptes_clients'
--              and cmd in ('INSERT','UPDATE','DELETE') loop
--     execute format('drop policy %I on public.comptes_clients', r.policyname);
--   end loop;
-- end $$;
-- -- (plus aucune règle d'écriture anon → seules les fonctions admin sécurisées écrivent)
