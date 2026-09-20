# Déploiement — Edge Function « envoyer-email » (OVH, remplace EmailJS)

Objectif : envoyer les e-mails de service via le **SMTP OVH (serveurs UE)** au lieu
d'EmailJS (USA). Le mot de passe SMTP reste **uniquement** dans les secrets Supabase.

## 1. Créer la fonction dans Supabase
Supabase → projet **kiknaxuzpovvivkjqzss** → **Edge Functions** → **Create a function**
→ nom : `envoyer-email` → coller le contenu de `index.ts`.

## 2. Renseigner les secrets (Settings → Edge Functions → Secrets)
| Secret | Valeur |
|---|---|
| `SMTP_HOST` | `ssl0.ovh.net` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | l'adresse OVH complète (ex. `contact@nomos-haccp.fr`) |
| `SMTP_PASS` | le mot de passe de la boîte OVH |
| `SMTP_FROM` | l'adresse expéditrice affichée (ex. `contact@nomos-haccp.fr`) |
| `SMTP_FROM_NAME` | `Nomos HACCP` |
| `ADMIN_EMAIL` | `lea@nomos-haccp.fr` |

## 3. Désactiver la vérification JWT (fonction appelée depuis le site public)
Fonction `envoyer-email` → **Details / Settings** → décocher **Verify JWT**.
(La fonction se protège elle-même par filtrage d'`Origin` + destinataire admin fixe.)

## 4. Tester (depuis un terminal ou la console)
```bash
curl -i -X POST \
  "https://kiknaxuzpovvivkjqzss.supabase.co/functions/v1/envoyer-email" \
  -H "content-type: application/json" \
  -H "origin: https://nomos-haccp.fr" \
  -d '{"type":"admin","params":{"etablissement":"TEST","message":"Test OVH depuis Nomos"}}'
```
Attendu : `{"ok":true}` et l'e-mail arrive sur `lea@nomos-haccp.fr`.

## 5. Basculer l'application
Une fois le test OK, on remplace les 6 appels `emailjs.send(...)` dans `script.js`
par un appel à cette fonction, **en gardant EmailJS en secours** si la fonction échoue.
EmailJS ne sera retiré qu'après validation en production.

## Notes SPF/délivrabilité
Le domaine `nomos-haccp.fr` inclut déjà `mx.ovh.com` dans son SPF : l'envoi via OVH
est donc reconnu. Vérifier le premier e-mail réel (pas de dossier spam).
