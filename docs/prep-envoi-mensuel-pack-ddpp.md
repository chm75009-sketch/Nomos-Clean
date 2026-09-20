# Prép. clé en main — Envoi mensuel automatique (rappel Pack DDPP)

> But : envoyer **chaque mois, automatiquement**, à chaque client actif, un e-mail
> lui rappelant d'**exporter son Pack DDPP** (ses preuves). Via OVH (UE).
>
> Pourquoi un rappel et pas le PDF en pièce jointe ? Le Pack DDPP est généré **dans
> le navigateur** (jsPDF) à partir des données du client. Le serveur ne peut pas le
> régénérer sans une refonte lourde. Le **rappel automatique** est la 1ʳᵉ version
> utile et fiable ; la pièce jointe PDF serait une phase 2 (grosse).
>
> Ça complète le rappel **dans l'app** (déjà en place depuis v475) : ici, le client
> est prévenu **même s'il n'ouvre pas l'application**.

## Fichiers fournis
- `supabase/functions/rappel-mensuel/index.ts` — la fonction d'envoi.
- `supabase/functions/rappel-mensuel/rappel-mensuel.sql` — la RPC + la planification.

## Étapes de déploiement (≈ 15 min)

### 1. Créer le secret CRON_SECRET
Supabase → Edge Functions → **Secrets** → ajouter :
- `CRON_SECRET` = une longue chaîne aléatoire (ex. 32+ caractères). **Notez-la**,
  elle servira aussi dans le SQL.

### 2. Créer la fonction
Edge Functions → **Deploy a new function** → « Via editor » → nom **`rappel-mensuel`**
→ coller le contenu de `index.ts` → **Deploy**.
Puis **Settings → décocher « Verify JWT »** (la fonction se protège par `CRON_SECRET`).

### 3. Créer la RPC des destinataires
SQL Editor → coller la **partie (1)** de `rappel-mensuel.sql`.
⚠️ **Vérifier les noms** de table/colonnes (`comptes_clients`, `email`,
`etablissement`/`nom`, `date_expiration`) et adapter si votre schéma diffère.

### 4. Activer pg_cron + pg_net puis planifier
- Database → **Extensions** → activer **pg_cron** et **pg_net**.
- SQL Editor → coller la **partie (2)** de `rappel-mensuel.sql`, en remplaçant
  `<CRON_SECRET>` par la valeur du secret. Planning par défaut : **le 1er du mois à 8h UTC**.

### 5. Tester tout de suite
Lancer la commande de test en bas du fichier SQL (un `net.http_post` immédiat), ou :
```bash
curl -i -X POST "https://kiknaxuzpovvivkjqzss.supabase.co/functions/v1/rappel-mensuel" \
  -H "content-type: application/json" -H "x-cron-secret: <CRON_SECRET>" -d '{}'
```
Attendu : `{"ok":true,"total":N,"sent":N,"failed":0}`. Vérifier la réception.
> Astuce test : créer d'abord un seul client de test avec **votre** e-mail.

## Points d'attention
- **Volume SMTP OVH** : l'envoi est séquentiel (doux). Pour un grand nombre de
  clients, prévoir une pause / un lot (à ajuster plus tard si besoin).
- **RGPD** : e-mail lié à l'exécution du contrat (obligation de conservation des
  preuves), pas de prospection. À mentionner au registre si souhaité.
- **Anti-spam** : le pied de page indique pourquoi le client reçoit l'e-mail.

## Phase 2 (plus tard, optionnelle)
Envoi du **PDF réel** en pièce jointe : nécessiterait de générer le Pack DDPP côté
serveur (rapatrier les données `controles_haccp` + un générateur PDF serveur). Gros
chantier — à évaluer seulement si le simple rappel ne suffit pas.
