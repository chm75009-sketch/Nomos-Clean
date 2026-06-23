-- ============================================================================
-- admin_set_etat_etab — Écriture ADMIN de l'état d'un établissement (actif +
-- date d'expiration), en contournant RLS de façon contrôlée.
-- ----------------------------------------------------------------------------
-- CONTEXTE : la RLS sur etablissements n'autorise pas l'admin (clé anonyme, pas
-- de jeton établissement) à faire UPDATE → les actions « Prolonger / Suspendre /
-- Réactiver » échouaient SILENCIEUSEMENT (aucune écriture, fiche restait expirée).
--
-- Cette fonction SECURITY DEFINER fait l'UPDATE après vérification du mot de passe
-- admin (même Vault que public.admin_check). Lecture/écriture limitée à l'état.
--
-- À EXÉCUTER UNE FOIS dans Supabase → SQL Editor (projet kiknaxuzpovvivkjqzss).
-- Test :  select public.admin_set_etat_etab('826700', '<ID_ETAB>', true, '2026-07-15');
-- ============================================================================

create or replace function public.admin_set_etat_etab(
  p_pwd text,
  p_id text,
  p_actif boolean default null,
  p_date_expiration text default null   -- 'YYYY-MM-DD' ; null = inchangé
) returns json
language plpgsql
security definer
set search_path = public, vault
as $$
declare _row public.etablissements%rowtype;
begin
  if not public.admin_check(p_pwd) then
    raise exception 'unauthorized';
  end if;

  -- 1) actif (et borne la ligne)
  update public.etablissements
     set actif = coalesce(p_actif, actif)
   where id::text = p_id
   returning * into _row;

  if _row.id is null then
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- 2) date d'expiration (optionnelle) — cast texte → date (tolère colonne date ou text)
  if p_date_expiration is not null and p_date_expiration <> '' then
    update public.etablissements
       set date_expiration = p_date_expiration::date
     where id::text = p_id
     returning * into _row;
  end if;

  return json_build_object('ok', true, 'actif', _row.actif, 'date_expiration', _row.date_expiration);
end $$;

grant execute on function public.admin_set_etat_etab(text, text, boolean, text) to anon, authenticated;

-- Vérif (remplacer le mot de passe et l'ID) :
--   select public.admin_set_etat_etab('826700', 'COLLER_ICI_ID', true, '2026-07-31');
--   -> { "ok": true, "actif": true, "date_expiration": "2026-07-31" }
