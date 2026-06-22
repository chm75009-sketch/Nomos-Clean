-- ============================================================================
-- admin_list_controles — Lecture ADMIN des contrôles d'un établissement.
-- ----------------------------------------------------------------------------
-- CONTEXTE : la policy RLS `tenant_select` sur controles_haccp n'autorise chaque
-- établissement à lire QUE ses propres contrôles (establishment_id = jeton).
-- L'admin (console interne) n'a pas le jeton du client : il ne peut donc PAS
-- lire les contrôles d'un autre établissement en direct → 0 ligne.
--
-- Cette fonction SECURITY DEFINER contourne RLS de façon contrôlée : elle est
-- protégée par le mot de passe admin (même Vault que public.admin_check), et ne
-- renvoie QUE les contrôles de l'établissement demandé. Lecture seule.
--
-- Utilisée par le bouton « 📄 Pack DDPP » de la console admin pour régénérer,
-- pour n'importe quel client, le MÊME document que celui qu'il voit dans son app.
--
-- À EXÉCUTER UNE FOIS dans Supabase → SQL Editor (projet kiknaxuzpovvivkjqzss).
-- Test :  select count(*) from public.admin_list_controles('826700', 'ESSAI-SVSQN-2026');
-- ============================================================================

create or replace function public.admin_list_controles(p_pwd text, p_etab text)
returns setof public.controles_haccp
language plpgsql
security definer
set search_path = public, vault
as $$
declare _e public.etablissements%rowtype;
begin
  -- 1) Authentification admin (réutilise la vérification mot de passe existante).
  if not public.admin_check(p_pwd) then
    raise exception 'unauthorized';
  end if;

  -- 2) Résolution de l'établissement par id (PK), establishment_id (uuid)
  --    ou code d'accès — selon ce que la console envoie.
  select * into _e
    from public.etablissements
   where id::text = p_etab
      or establishment_id::text = p_etab
      or code_acces = p_etab
   limit 1;

  -- 3) Contrôles de CET établissement uniquement. On couvre les différentes
  --    façons dont un contrôle a pu être rattaché (code_client texte historique
  --    = id de l'établissement, code d'accès, ou establishment_id uuid récent).
  if _e.id is null then
    -- Établissement introuvable : tentative directe sur code_client.
    return query
      select c.* from public.controles_haccp c
       where c.code_client = p_etab
       order by c.date_controle desc nulls last;
  else
    return query
      select c.* from public.controles_haccp c
       where c.code_client = _e.id::text
          or c.code_client = _e.code_acces
          or c.code_client = _e.establishment_id::text
          or c.establishment_id = _e.establishment_id
       order by c.date_controle desc nulls last;
  end if;
end $$;

grant execute on function public.admin_list_controles(text, text) to anon, authenticated;

-- Vérification rapide (remplacer le mot de passe et le code par les vôtres) :
--   select count(*) from public.admin_list_controles('826700', 'ESSAI-SVSQN-2026');
--   -> doit renvoyer le nombre de contrôles du client (13 dans l'exemple BLU BLU).
