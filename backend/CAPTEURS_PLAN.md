# Capteurs de température — plan de mise en service

Objectif : le client installe un capteur, et la température de ses frigos s'enregistre
toute seule (preuve DDPP), avec supervision à distance par l'administrateur et alertes
en cas de température critique ou de panne.

Matériel de test : UbiBot WS1 (WiFi) — capteur de température intégré (sonde externe
DS18B20 en option, plus tard).

## Deja fait (cote application — v176)
- Page Capteurs (Reglages -> Capteurs), lisible, accessible.
- Saisie de la cle UbiBot (cle de compte).
- Association sonde <-> frigo + seuils min/max repris automatiquement du parametrage des enceintes.
- Planning des releves : nombre/jour (1 a 6) + heures (matin/soir par defaut), synchronise cloud.
- Lecture a la demande des temperatures (bouton Lire).
- Invisible pour les clients (sauf le bouton, a masquer avant vente).

## Brique 1 — Enregistrement automatique (serveur)
Aux heures reglees, le serveur lit le capteur et ecrit une preuve dans controles_haccp
-> apparait dans Mes Rapports et Pack DDPP, sans action du client (meme app fermee).
Comment : pg_cron + pg_net (comme la purge photos). Pour chaque client (config
__sondes_config__), si l'heure correspond a un creneau et pas deja fait aujourd'hui :
appeler api.ubibot.com/channels?account_key=..., lire la T° par canal, inserer un controle
temperatures cloisonne.
Pre-requis (vendredi) : confirmer avec le vrai capteur quel champ porte la temperature
(field1 = capteur interne ; la sonde externe peut etre un autre champ).

## Brique 2 — Supervision a distance (administrateur)
Vue admin "Capteurs clients" : par client, dernier releve, temperature, voyant vert/rouge,
et "hors service" si plus aucun releve (capteur debranche / WiFi ou courant coupe).
Pre-requis : acces lecture multi-clients (cle service_role cote serveur ou policy RLS
dediee). Service facturable.

## Brique 3 — Alertes (temperature critique / panne)
Deux signaux : la T° derive, ou plus de donnees du capteur.
Niveau 1 (temps reel, simple) : alertes natives UbiBot (incluses) -> e-mail / SMS / notif.
Rien a developper, a configurer dans le compte UbiBot.
Niveau 2 (nos alertes serveur) : e-mail gratuit (EmailJS) pour tous ; SMS ~5 cts/message
via fournisseur (Twilio, OVH, Brevo) en option premium.

## Checklist du jour J (reception du capteur)
1. Allumer le WS1, le connecter au WiFi 2,4 GHz via l'app UbiBot.
2. Recuperer cle de compte + n° de canal.
3. Dans HACCP Pro -> Capteurs : coller la cle, associer la sonde au frigo, regler les heures.
4. Bouton Lire -> verifier que la T° correspond (frigo vs ambiant) et noter le format exact.
5. Je finalise et livre le SQL de la Brique 1 (enregistrement auto).
6. Tester un releve automatique (verifier dans Mes Rapports / Pack DDPP).
7. Construire la Brique 2 (supervision admin).
8. Activer les alertes (Brique 3 : UbiBot natif + e-mail, SMS en option).

## Journal du jour J (12/06/2026) — UbiBot WS1 Pro
- Capteur déballé, activé (QR au dos), **connecté au WiFi (Bbox) et EN LIGNE**
  (date synchronisée 2026, « AP » disparu, données T°/humidité dans le cloud).
- Canal confirmé : **ID de la chaîne = 130779** (Info du canal). Capteur intégré
  (1 seul câble = alimentation), donc **température = field1**.
- Constat important : le **bouton « Lire » du téléphone ne peut PAS** lire l'API
  UbiBot directement → bloqué par **CORS** (sécurité navigateur). Côté HACCP tout
  est bon (clé OK, canal OK) ; la lecture doit passer par le **serveur**.
- **Brique 1 LIVRÉE** : `backend/releves_auto_ubibot.sql` (pg_cron + pg_net, en
  2 phases : lancer la requête → traiter la réponse → insérer le contrôle
  « Températures enceintes » cloisonné, idempotent). Le serveur n'a pas la limite
  CORS → c'est lui qui enregistre les relevés aux heures réglées, app fermée.
- À FAIRE avec le client : coller le SQL dans Supabase, puis valider le 1ᵉʳ relevé
  automatique (vérifier l'affichage dans « Mes Rapports / Pack DDPP » et ajuster
  si besoin le format `contenu.temperatures`). Puis Brique 2 (supervision admin)
  et Brique 3 (alertes).
