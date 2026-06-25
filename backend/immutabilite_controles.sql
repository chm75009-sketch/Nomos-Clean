-- ============================================================================
-- IMMUTABILITÉ DES CONTRÔLES VALIDÉS (preuve légale DDPP)
-- À EXÉCUTER UNE FOIS dans Supabase → SQL Editor (projet kiknaxuzpovvivkjqzss).
--
-- But : une fois un contrôle SIGNÉ (validé), ses champs de preuve ne peuvent plus
-- être modifiés (contenu, signature, module, date, client). SEUL le rattachement
-- des PHOTOS reste permis (l'app rattache les photos après coup — vérifié dans le
-- code : c'est le seul UPDATE légitime sur controles_haccp).
--
-- La SUPPRESSION par un client est déjà interdite (RLS : aucune policy DELETE anon),
-- donc on ne touche pas au DELETE ici (sinon on casserait la maintenance/dédup).
-- ============================================================================

create or replace function public.controles_haccp_immutable()
returns trigger language plpgsql as $$
begin
  -- Ne verrouille que les contrôles RÉELLEMENT validés (avec signature).
  if OLD.signature is not null and OLD.signature <> '' then
    if NEW.contenu       is distinct from OLD.contenu
    or NEW.signature     is distinct from OLD.signature
    or NEW.module        is distinct from OLD.module
    or NEW.date_controle is distinct from OLD.date_controle
    or NEW.code_client   is distinct from OLD.code_client then
      raise exception 'Contrôle validé : modification interdite (preuve légale). Seules les photos peuvent être ajoutées.';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_controles_haccp_immutable on public.controles_haccp;
create trigger trg_controles_haccp_immutable
  before update on public.controles_haccp
  for each row execute function public.controles_haccp_immutable();

-- Test (doit échouer) :
--   update public.controles_haccp set contenu = '{}'::jsonb
--   where signature is not null limit 1;
-- Test (doit réussir — rattachement photo) :
--   update public.controles_haccp set photos = photos
--   where signature is not null limit 1;
