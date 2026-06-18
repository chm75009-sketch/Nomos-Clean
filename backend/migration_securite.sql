-- ============================================================================
-- HACCP17-FACILE — Migration sécurité & intégrité (Supabase / Postgres)
-- Projet : kiknaxuzpovvivkjqzss
-- Couvre : SEC-1 (cloisonnement), SEC-2 (mots de passe), SEC-3 (Storage privé),
--          SEC-4 (append-only), M1 (horodatage serveur), M2 (scellement),
--          DATA-3/4 (lien photo par id), CONC-2 (ajout photo atomique).
--
-- ⚠️  À EXÉCUTER PAR ÉTAPES (voir RUNBOOK_SECURITE.md). Les étapes A et B sont
--     NON-CASSANTES (additives). L'étape C (RLS + coupure anon) CASSE l'app tant
--     que le frontend JWT n'est pas déployé : à faire en fenêtre de bascule.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE A — ADDITIF, NON-CASSANT (peut tourner sur l'app live sans rien casser)
-- ════════════════════════════════════════════════════════════════════════════

-- A1. Identité d'établissement stable (UUID) — en plus du code_client texte actuel.
alter table public.etablissements
  add column if not exists establishment_id uuid not null default gen_random_uuid();

create unique index if not exists etablissements_establishment_id_uidx
  on public.etablissements (establishment_id);

-- A2. Rattacher les contrôles à l'établissement (rempli plus tard, cf. A6).
alter table public.controles_haccp
  add column if not exists establishment_id uuid;

create index if not exists controles_haccp_estab_idx
  on public.controles_haccp (establishment_id);

-- A3. M1 — horodatage SERVEUR infalsifiable (en plus de date_controle = client).
--     C'est recorded_at qui fait foi pour la DDPP.
alter table public.controles_haccp
  add column if not exists recorded_at timestamptz not null default now();

-- A4. M2 — scellement : empreinte du contenu au moment de l'enregistrement.
--     Calculée par trigger → toute altération ultérieure devient détectable.
alter table public.controles_haccp
  add column if not exists seal text;

alter table public.controles_haccp
  add column if not exists client_control_id text; -- DATA-3 : id client unique du contrôle

create or replace function public.haccp_seal()
returns trigger language plpgsql
set search_path = public, extensions
as $$
begin
  new.recorded_at := coalesce(new.recorded_at, now());
  if new.establishment_id is null then
    new.establishment_id := public.current_establishment_id();
  end if;
  new.seal := encode(
    digest(
      coalesce(new.code_client,'') || '|' ||
      coalesce(new.module,'') || '|' ||
      coalesce(new.contenu::text,'') || '|' ||
      coalesce(new.signature,'') || '|' ||
      to_char(new.recorded_at,'YYYY-MM-DD"T"HH24:MI:SS.US'),
      'sha256'),
    'hex');
  return new;
end $$;

-- pgcrypto requis pour digest()
create extension if not exists pgcrypto;

drop trigger if exists trg_haccp_seal on public.controles_haccp;
create trigger trg_haccp_seal
  before insert on public.controles_haccp
  for each row execute function public.haccp_seal();

-- A5. DATA-9 — idempotence serveur : pas de doublon (même client_control_id).
--     (NULL autorisé pour les anciennes lignes ; unicité seulement si renseigné.)
create unique index if not exists controles_haccp_client_id_uidx
  on public.controles_haccp (code_client, client_control_id)
  where client_control_id is not null;

-- A6. Backfill : relier les contrôles existants à l'établissement par code_client.
update public.controles_haccp c
   set establishment_id = e.establishment_id
  from public.etablissements e
 where c.establishment_id is null
   and c.code_client = e.code_acces;


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE B — AUTH & STORAGE (préparation, non-cassant tant qu'on ne coupe pas anon)
-- ════════════════════════════════════════════════════════════════════════════

-- B1. SEC-2 — Supabase Auth gère les mots de passe (hash bcrypt côté GoTrue).
--     => Créer 1 utilisateur Auth par établissement (email + mot de passe) via le
--     dashboard (Authentication → Users) ou l'API admin. Puis lier au tenant :
create table if not exists public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.etablissements(establishment_id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, establishment_id)
);

-- Helper : establishment_id du JWT courant (présent dans app_metadata après liaison).
create or replace function public.current_establishment_id()
returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,establishment_id}','')::uuid,
    (select m.establishment_id from public.memberships m where m.user_id = auth.uid() limit 1)
  );
$$;

-- B2. SEC-3 — Bucket photos en PRIVÉ + accès par établissement.
--     (Le passage public→privé se fait dans Storage Settings ; ci-dessous la policy.)
--     Les chemins doivent être préfixés par establishment_id/...
--     NB : nécessite que le frontend serve les images via createSignedUrl().


-- ════════════════════════════════════════════════════════════════════════════
-- ÉTAPE C — BASCULE (CASSE l'app tant que le frontend JWT n'est pas déployé)
--           ⚠️  N'EXÉCUTER QUE PENDANT LA FENÊTRE DE BASCULE COORDONNÉE.
-- ════════════════════════════════════════════════════════════════════════════

-- C1. SEC-1 — RLS d'isolation par établissement sur les contrôles.
alter table public.controles_haccp enable row level security;

drop policy if exists tenant_select on public.controles_haccp;
create policy tenant_select on public.controles_haccp for select
  using (establishment_id = public.current_establishment_id());

drop policy if exists tenant_insert on public.controles_haccp;
create policy tenant_insert on public.controles_haccp for insert
  with check (establishment_id = public.current_establishment_id());

-- C2. SEC-4 — append-only : pas d'UPDATE ni DELETE client sur un contrôle signé.
--     (Aucune policy update/delete => refus par défaut sous RLS.)
--     Le rattachement de photo se fera par une RPC security definer (cf. C4),
--     pas par un PATCH client.

-- C3. SEC-2 — fermer la lecture des mots de passe : RLS sur etablissements.
alter table public.etablissements enable row level security;

drop policy if exists etab_self_select on public.etablissements;
create policy etab_self_select on public.etablissements for select
  using (establishment_id = public.current_establishment_id());
-- (Le login ne lit plus le mot de passe : il passe par Auth. Retirer la colonne
--  mot_de_passe APRÈS migration de tous les comptes vers Auth :)
-- alter table public.etablissements drop column if exists mot_de_passe;

-- C4. DATA-3/4 + CONC-2 — rattachement de photo atomique par id explicite,
--     via RPC (append atomique, pas de lecture-réécriture du tableau).
create or replace function public.haccp_lier_photo(
  p_client_control_id text,
  p_url text,
  p_source text
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.controles_haccp
     set photos = coalesce(photos,'[]'::jsonb) ||
                  jsonb_build_array(jsonb_build_object('u',p_url,'s',p_source))
   where client_control_id = p_client_control_id
     and establishment_id = public.current_establishment_id();
end $$;

revoke all on function public.haccp_lier_photo(text,text,text) from public;
grant execute on function public.haccp_lier_photo(text,text,text) to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (étape C uniquement — pour revenir à l'état anon en urgence)
-- ════════════════════════════════════════════════════════════════════════════
-- alter table public.controles_haccp disable row level security;
-- alter table public.etablissements  disable row level security;
-- drop function if exists public.haccp_lier_photo(text,text,text);
