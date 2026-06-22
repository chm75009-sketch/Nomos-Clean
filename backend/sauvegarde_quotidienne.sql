-- ════════════════════════════════════════════════════════════════════════════
--  SAUVEGARDE QUOTIDIENNE — réglage PAR CLIENT (espace admin)
--  À coller tel quel dans Supabase → SQL Editor → Run. Sans danger, idempotent.
--
--  Rappel des 2 niveaux de contrôle :
--   • GLOBAL (tous les clients) : géré dans le code (constante SAUVEGARDE_QUOT_ACTIVE
--     en haut de script.js). Mettre à false = coupe tout le monde. Rien à faire ici.
--   • PAR CLIENT : géré ci-dessous + case à cocher dans l'admin (bouton « Modifier »).
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Flag par établissement.
--    false (défaut) = sauvegarde quotidienne ACTIVE pour ce client.
--    true            = sauvegarde quotidienne DÉSACTIVÉE pour ce client.
alter table public.etablissements
  add column if not exists sauvegarde_off boolean not null default false;

-- 2) Mini-fonction de lecture appelée par l'app cliente (avec la clé anonyme).
--    Renvoie true si la sauvegarde est désactivée pour ce code d'accès.
--    SECURITY DEFINER : ne lit qu'une seule colonne booléenne, jamais les mots de passe.
create or replace function public.get_sauvegarde_off(p_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select sauvegarde_off
       from public.etablissements
      where upper(code_acces) = upper(p_code)
      limit 1),
    false);
$$;

grant execute on function public.get_sauvegarde_off(text) to anon, authenticated;

-- ── Pour désactiver/réactiver MANUELLEMENT en SQL (optionnel) ──
-- update public.etablissements set sauvegarde_off = true  where code_acces = 'HACCP-XXXXX'; -- couper pour 1 client
-- update public.etablissements set sauvegarde_off = false where code_acces = 'HACCP-XXXXX'; -- réactiver
-- update public.etablissements set sauvegarde_off = true;  -- couper pour TOUS les clients (équivaut au coupe-circuit code)
