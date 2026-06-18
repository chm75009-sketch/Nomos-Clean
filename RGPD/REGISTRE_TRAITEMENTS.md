# Registre des activités de traitement (art. 30 RGPD)

> HACCP Pro (HACCP17-FACILE) — Responsable : {{RAISON SOCIALE}}.
> Dernière mise à jour : 2026-06-07.

## Traitement 1 — Gestion des comptes établissements
- **Finalité** : créer et authentifier les comptes clients, facturer.
- **Base légale** : exécution du contrat.
- **Personnes** : responsables d'établissement.
- **Données** : nom commercial, SIRET, adresse, e-mail, code d'accès, mot de passe (haché).
- **Destinataires** : éditeur, hébergeur (Supabase).
- **Conservation** : durée du contrat + 3 ans (preuve, prescription commerciale).
- **Transferts hors UE** : non (hébergement UE — {{À CONFIRMER}}).
- **Sécurité** : Auth (hash bcrypt), HTTPS, RLS.

## Traitement 2 — Enregistrements d'autocontrôle HACCP
- **Finalité** : tenue de la traçabilité sanitaire obligatoire.
- **Base légale** : obligation légale (Paquet Hygiène) + exécution du contrat.
- **Personnes** : employés signataires des contrôles.
- **Données** : relevés (T°, réception, nettoyage…), non-conformités, nom du
  signataire, signature, horodatage.
- **Destinataires** : l'établissement ; sur sa demande, la DDPP.
- **Conservation** : voir `DUREES_CONSERVATION.md`.
- **Sécurité** : cloisonnement RLS, horodatage serveur, scellement (hash).

## Traitement 3 — Médias de traçabilité (photos)
- **Finalité** : preuve documentaire (bons de livraison, étiquettes, véhicules).
- **Base légale** : intérêt légitime / obligation légale de traçabilité.
- **Données** : images pouvant contenir des données personnelles (plaques, noms).
- **Destinataires** : l'établissement ; DDPP sur demande.
- **Conservation** : alignée sur les contrôles associés.
- **Sécurité** : bucket privé, URL signées à durée courte, préfixe par établissement.

## Traitement 4 — Données techniques & sécurité
- **Finalité** : sécurité, prévention de la fraude, support.
- **Base légale** : intérêt légitime.
- **Données** : IP, logs serveur, identifiant d'appareil.
- **Destinataires** : éditeur, hébergeur.
- **Conservation** : 12 mois (logs).

## Sous-traitants (art. 28)
| Sous-traitant | Rôle | Localisation | Garanties |
|---|---|---|---|
| Supabase | Base de données + stockage | {{RÉGION UE à confirmer}} | DPA, hébergement UE |
| EmailJS | Envoi d'e-mails | {{À CONFIRMER}} | DPA |
| GitHub Pages | Hébergement de l'app statique | {{À CONFIRMER}} | — |
