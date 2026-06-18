# Durées de conservation & purge

> HACCP Pro (HACCP17-FACILE). Dernière mise à jour : 2026-06-07.

## Principe
On ne conserve les données que le temps nécessaire à leur finalité, puis on
les purge. La durée « preuve HACCP » est alignée sur les attentes d'un contrôle
DDPP (le Pack DDPP mentionne une conservation de l'ordre de 3 ans).

| Donnée | Durée de conservation | Déclencheur de purge |
|---|---|---|
| Contrôles d'autocontrôle (T°, réception, nettoyage…) | Année en cours + **{{1 à 3}}** ans | Job de purge programmé |
| Photos de traçabilité | Idem contrôle associé | Purge en cascade |
| Non-conformités / actions correctives | Idem contrôles | Purge programmée |
| Compte établissement (identité) | Durée du contrat + 3 ans | Résiliation + délai |
| Mot de passe (haché) | Durée du contrat | Suppression du compte |
| Logs techniques / IP | 12 mois | Purge automatique |
| Session locale (navigateur) | 12 h (payant) / durée d'essai ; **login hors-ligne ≤ 7 j** | Expiration |

## Mise en œuvre technique (à implémenter côté Supabase)
- **Purge programmée** : tâche `pg_cron` (ou Edge Function planifiée) supprimant
  `controles_haccp` et les objets Storage associés au-delà de la durée retenue.
- **Exemple** (à adapter à la durée légale choisie) :
  ```sql
  -- Purge des contrôles de plus de 3 ans (exécution mensuelle via pg_cron)
  delete from public.controles_haccp
   where recorded_at < now() - interval '3 years';
  -- (prévoir la suppression des objets Storage liés en amont)
  ```
- **À décider** : durée exacte (1, 2 ou 3 ans) selon l'avis de votre conseil et
  la nature des contrôles → remplacer `{{1 à 3}}` ci-dessus.
