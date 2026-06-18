# Politique de confidentialité — HACCP Pro (HACCP17-FACILE)

> Dernière mise à jour : 2026-06-07.
> Champs à personnaliser repérés par `{{À COMPLÉTER}}`.

## 1. Responsable du traitement
- **Éditeur** : {{RAISON SOCIALE}} — {{FORME JURIDIQUE}}, SIRET {{SIRET}}.
- **Adresse** : {{ADRESSE}}.
- **Contact / délégué** : {{EMAIL CONTACT RGPD}} (ou DPO si désigné).

## 2. Données que nous traitons
HACCP Pro est un outil d'autocontrôle sanitaire pour les professionnels des
métiers de bouche. Nous traitons :

| Catégorie | Exemples | Finalité |
|---|---|---|
| Identification établissement | Nom commercial, SIRET, adresse, e-mail, code d'accès | Fourniture du service, facturation |
| Authentification | Mot de passe (haché), session | Sécuriser l'accès au compte |
| Données d'autocontrôle | Relevés de température, réception, nettoyage, cuisson, non-conformités | Traçabilité réglementaire HACCP |
| Données personnelles employés | Nom/prénom du signataire, signature manuscrite | Preuve d'autocontrôle (qui a contrôlé) |
| Médias de traçabilité | Photos (bons de livraison, étiquettes, plaques véhicule) | Preuve en cas de contrôle DDPP |
| Données techniques | Adresse IP, logs, identifiant d'appareil | Sécurité, prévention de la fraude |

Nous **ne vendons jamais** vos données et ne les utilisons pas à des fins
publicitaires.

## 3. Bases légales (art. 6 RGPD)
- **Exécution du contrat** : fourniture de l'outil d'autocontrôle.
- **Obligation légale** : tenue de la traçabilité HACCP (Paquet Hygiène,
  règlement (CE) 852/2004 ; arrêté du 21/12/2009).
- **Intérêt légitime** : sécurité du service, prévention de la fraude.

## 4. Destinataires
- L'établissement client lui-même (cloisonnement par compte).
- **Sous-traitant d'hébergement** : Supabase (base de données et stockage),
  région **{{RÉGION UE — à confirmer, ex. eu-central-1}}**.
- **Envoi d'e-mails** : EmailJS (souscription / contact), le cas échéant.
- Sur réquisition : autorités de contrôle (DDPP) à la demande de l'établissement.

## 5. Durées de conservation
Voir `DUREES_CONSERVATION.md`. En synthèse : les contrôles HACCP sont conservés
pour la durée nécessaire à la preuve réglementaire (de l'ordre de l'année en
cours + 1 à 3 ans selon la nature), puis purgés. Compte résilié : suppression
définitive sous 30 jours (cf. `PROCEDURE_DROIT_OUBLI.md`).

## 6. Vos droits (art. 15 à 22 RGPD)
Vous disposez des droits d'**accès**, **rectification**, **effacement**,
**limitation**, **opposition** et **portabilité**. Pour les exercer :
{{EMAIL CONTACT RGPD}}. Réponse sous 1 mois. Réclamation possible auprès de la
**CNIL** (cnil.fr).

## 7. Sécurité
Mesures appliquées : chiffrement en transit (HTTPS), authentification par compte,
cloisonnement des données par établissement (RLS), stockage des médias en accès
restreint (URL signées), mots de passe hachés. Voir le détail technique dans
`../DIAGNOSTIC_SECURITE.md`.

## 8. Cookies / stockage local
L'application utilise le **stockage local du navigateur** (localStorage /
IndexedDB) pour fonctionner hors-ligne et conserver votre session. Aucun cookie
publicitaire ou de pistage tiers n'est déposé.

## 9. Modifications
Cette politique peut évoluer ; la date en tête fait foi. Les changements
substantiels sont signalés dans l'application.
