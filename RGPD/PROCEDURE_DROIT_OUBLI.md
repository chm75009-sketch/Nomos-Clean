# Procédure — Droit à l'effacement & résiliation

> HACCP Pro (HACCP17-FACILE). Dernière mise à jour : 2026-06-07.

## 1. Réception de la demande
- Canal : {{EMAIL CONTACT RGPD}}.
- Vérifier l'identité du demandeur (responsable de l'établissement).
- Enregistrer la date (délai de réponse RGPD : **1 mois**).

## 2. Réserve légale
Les enregistrements d'autocontrôle peuvent relever d'une **obligation légale de
conservation** (traçabilité sanitaire). Dans ce cas, l'effacement immédiat peut
être **différé** jusqu'à la fin de la durée légale, en informant le demandeur.
Les autres données (compte, contact) sont effaçables sans délai.

## 3. Suppression technique (à exécuter côté Supabase)
> Remplacer `:estab` par l'`establishment_id` concerné.

```sql
-- 1. Objets Storage (photos) — lister puis supprimer le préfixe de l'établissement
--    via l'API Storage : storage.from('haccp-photos').remove([... chemins :estab/... ])

-- 2. Contrôles
delete from public.controles_haccp where establishment_id = :estab;

-- 3. Enregistrements annexes éventuels
delete from public.enregistrements where etab_id = :estab;

-- 4. Membres Auth liés
--    (Authentication → Users → supprimer les comptes liés via memberships)
delete from public.memberships where establishment_id = :estab;

-- 5. Établissement
delete from public.etablissements where establishment_id = :estab;
```

## 4. Confirmation
- Confirmer par écrit au demandeur la suppression effectuée (ou le différé légal).
- Conserver une **trace de la demande et de la réponse** (preuve de conformité),
  sans conserver les données supprimées.

## 5. Délai cible
- Données non soumises à obligation légale : **30 jours** après résiliation.
- Données soumises à obligation : à l'issue de la durée de conservation
  (cf. `DUREES_CONSERVATION.md`).
