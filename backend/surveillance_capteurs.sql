-- ════════════════════════════════════════════════════════════════════════
--  GARDE-FOU — SURVEILLANCE DES CAPTEURS (alerte ADMIN si relevés arrêtés)
--  HACCP Pro
-- ════════════════════════════════════════════════════════════════════════
--  But : si un capteur configuré chez un client n'a plus enregistré de relevé
--  depuis > 26 h (capteur en panne, WiFi/courant coupé, ou enregistrement qui
--  a cessé pour une raison quelconque), envoyer un E-MAIL D'ALERTE à l'admin.
--  → tu es prévenu AVANT que le client ait un trou dans ses preuves DDPP.
--
--  C'est le « filet serveur », complémentaire de l'alerte hors-ligne UbiBot
--  (temps réel) : ici on surveille le RÉSULTAT (les relevés réellement écrits).
--
--  Une seule alerte par capteur et par jour (pas de spam).
--  E-mail envoyé via EmailJS (REST) — même service que l'app.
--
--  ⚠️ PRÉ-REQUIS (2 étapes côté EmailJS, à faire une fois) :
--    A) Dans ton compte EmailJS → Account → Security → coche
--       « Allow EmailJS API for non-browser applications ».
--    B) Récupère ta clé PRIVÉE : EmailJS → Account → API Keys → « Private Key ».
--       Puis colle-la dans le Vault à l'ÉTAPE 2 ci-dessous.
-- ════════════════════════════════════════════════════════════════════════


-- ── ÉTAPE 1 — Extensions + table anti-spam ──────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.ubibot_alertes_admin (
  code_client text not null,
  channel     text not null,
  jour        date not null,
  envoye_le   timestamptz not null default now(),
  primary key (code_client, channel, jour)
);


-- ── ÉTAPE 2 — Clé privée EmailJS dans le Vault (à faire UNE fois) ────────
-- Remplace COLLE_TA_CLE_PRIVEE_EMAILJS par ta clé privée EmailJS.
select vault.create_secret(
  'COLLE_TA_CLE_PRIVEE_EMAILJS',
  'emailjs_private_key',
  'Clé privée EmailJS — alertes admin surveillance capteurs'
);


-- ── ÉTAPE 3 — La fonction de surveillance ───────────────────────────────
create or replace function public.ubibot_surveiller()
returns integer
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  ek    text;
  cap   record;
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  n     integer := 0;
begin
  select decrypted_secret into ek from vault.decrypted_secrets
  where name = 'emailjs_private_key' limit 1;

  for cap in
    with cfg as (
      select distinct on (cc.code_client) cc.code_client, cc.contenu->'sondes' as sondes
      from public.controles_haccp cc
      where cc.module = '__sondes_config__'
      order by cc.code_client, cc.created_at desc
    ),
    capt as (
      select cfg.code_client, (s->>'channel') as channel,
             coalesce(s->>'enceinte', s->>'nom', 'Capteur') as frigo
      from cfg cross join lateral jsonb_array_elements(cfg.sondes) as s
      where coalesce(s->>'channel','') <> ''
    ),
    der as (
      select distinct on (c.code_client, (c.contenu->>'channel'))
             c.code_client, (c.contenu->>'channel') as channel, c.recorded_at
      from public.controles_haccp c
      where c.module = 'Températures enceintes'
        and c.contenu->>'source' = 'ubibot'
        and c.contenu->>'channel' is not null
      order by c.code_client, (c.contenu->>'channel'), c.recorded_at desc
    )
    select capt.code_client, capt.channel, capt.frigo,
           coalesce(e.nom, capt.code_client) as etab,
           der.recorded_at as derniere
    from capt
    left join public.etablissements e on e.code_acces = capt.code_client
    left join der on der.code_client = capt.code_client and der.channel = capt.channel
    where der.recorded_at is null or der.recorded_at < now() - interval '26 hours'
  loop
    -- déjà alerté aujourd'hui pour ce capteur ? → on saute
    if exists (select 1 from public.ubibot_alertes_admin
               where code_client = cap.code_client and channel = cap.channel and jour = v_jour) then
      continue;
    end if;

    if ek is not null then
      perform net.http_post(
        url := 'https://api.emailjs.com/api/v1.0/email/send',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object(
          'service_id',  'service_8cctnrr',
          'template_id', 'template_admin_haccp',
          'user_id',     '4D454C9uGm-zWE0Hp',
          'accessToken', ek,
          -- NOTE plan gratuit EmailJS (2 modèles max) : on réutilise le modèle admin.
          -- Pour que l'alerte soit RECONNAISSABLE malgré le sujet « inscription », on
          -- préfixe l'établissement par « 🚨 ALERTE CAPTEUR » (visible dans le sujet)
          -- et le message détaille tout (établissement, frigo, canal, dernier relevé).
          'template_params', jsonb_build_object(
            'to_email',      'r.t.h@orange.fr',
            'etablissement', '🚨 ALERTE CAPTEUR — ' || cap.etab,
            'message',       '🚨 ALERTE CAPTEUR HORS LIGNE 🚨' || chr(10) || chr(10)
                             || 'Établissement : ' || cap.etab || chr(10)
                             || 'Enceinte / frigo : ' || cap.frigo || chr(10)
                             || 'Canal du capteur : ' || cap.channel || chr(10)
                             || 'Dernier relevé reçu : '
                             || coalesce(to_char(cap.derniere at time zone 'Europe/Paris','DD/MM/YYYY à HH24:MI'), 'AUCUN') || chr(10) || chr(10)
                             || 'Ce capteur n''a plus transmis de relevé depuis plus de 26 h. '
                             || 'À vérifier : alimentation du capteur, WiFi, ou faire un relevé manuel '
                             || 'pour ne pas laisser de trou dans les preuves DDPP.'
          )
        )
      );
    end if;

    insert into public.ubibot_alertes_admin (code_client, channel, jour, envoye_le)
    values (cap.code_client, cap.channel, v_jour, now())
    on conflict do nothing;
    n := n + 1;
  end loop;

  return n;
end;
$$;


-- ── ÉTAPE 4 — Planifier la surveillance (toutes les heures) ─────────────
select cron.schedule(
  'ubibot-surveillance',
  '0 * * * *',
  $$ select public.ubibot_surveiller(); $$
);


-- ════════════════════════════════════════════════════════════════════════
--  TEST : forcer une vérif maintenant (n = nb d'alertes envoyées)
--    select public.ubibot_surveiller();
--  Voir les alertes déjà envoyées :
--    select * from public.ubibot_alertes_admin order by envoye_le desc;
--  Pour re-tester un envoi (efface la trace du jour) :
--    delete from public.ubibot_alertes_admin where jour = current_date;
-- ════════════════════════════════════════════════════════════════════════
