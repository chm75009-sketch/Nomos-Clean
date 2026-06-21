# État de la sécurisation — HACCP Pro / Nomos (projet kiknaxuzpovvivkjqzss)

> Suite aux 2 audits externes (21/06/2026). Bilan de ce qui est fait et de ce qu'il reste.

## ✅ FAIT — sécurisé et stable

| Élément | Détail |
|---|---|
| **Mots de passe hachés (bcrypt)** | `etablissements` + `comptes_clients` ; `login_etab` vérifie le hash et migre à la volée |
| **`etablissements` verrouillée** | RLS : policies `etab_insert/update/delete` (anon), **pas de SELECT** → emails/tél/adresses non lisibles en anonyme. Lecture admin via RPC. |
| **`comptes_clients` verrouillée** | SELECT anon coupé (policy `Allow public select on clients` supprimée) |
| **`historique_admin` verrouillée** | SELECT anon coupé |
| **`demandes_inscription` verrouillée** | INSERT public conservé (formulaire), reste coupé |
| **Opérations admin via RPC** (security definer, gardées par `admin_check`) | `admin_list_demandes/comptes/etablissements/historique`, `admin_validate_demande`, `admin_refuse_demande`, `admin_get_etab`, `admin_update_client` |
| **Flux publics via RPC** | `get_essai_config`, `eu3j_stats`, `reset_password` (mot de passe oublié = reset sécurisé) |
| **Consentement RGPD** | horodaté à l'inscription (`rgpd_accepte_le`), affiché dans l'admin |
| **Hébergement UE** | Supabase West EU (Irlande) |

→ **La fuite de données personnelles des 2 rapports est FERMÉE.**

## 🟡 À FAIRE — `controles_haccp` (session dédiée)

**État actuel : RLS DÉSACTIVÉ** (volontairement). Protégé en attendant par le **scellement SHA-256** (colonne `seal`, trigger `haccp_seal`) → toute falsification est détectable.

**Déjà préparé (en place, mais inerte tant que RLS off) :**
- `sync_auth_login(p_code, p_pwd, p_estid)` : synchronise le compte Supabase Auth (mot de passe + `app_metadata` avec `establishment_id` ET `code`) à chaque connexion. Appelée par `login_etab`.
- Policies `ch_select/ch_insert/ch_update` réécrites en **cloisonnement par CODE** : `upper(code_client) = upper(jwt.app_metadata.code)` (le code est présent sur les 279 contrôles, contrairement à `establishment_id` qui ne l'est que sur 18).

**Pourquoi pas activé :**
1. **L'équipe est stockée DANS `controles_haccp`** (ligne spéciale, colonne `contenu.equipe`). Activer le RLS bloque sa lecture pour tout compte sans JWT → équipe perdue + plus de nom proposé.
2. **Comptes démo locaux** (ex. `RTH75`, `CODES_LOCAUX`) : MODE_LOCAL, ne passent pas par `login_etab` → jamais de JWT → bloqués par le RLS.
3. Il faut **reconnecter tous les clients** une fois (pour obtenir leur JWT à jour).

**Plan pour finir :**
1. Sortir l'**équipe** dans sa propre table (ou un accès dédié non soumis au RLS controls), pour ne pas la bloquer.
2. Décider du sort des **comptes démo locaux** (les exclure de la synchro cloud, ou leur donner un accès).
3. Fenêtre de bascule : faire reconnecter les clients, puis `alter table public.controles_haccp enable row level security;`
4. Tester : un vrai compte (avec Auth) voit/écrit SES contrôles, pas ceux des autres.

**Rollback de secours** (si réactivé et que ça casse) :
```sql
alter table public.controles_haccp disable row level security;
```

## ⏭️ Secondaire (rapport audit, plus tard)
- Retirer les comptes test en clair du code (`RTH75`/`826700` dans `CODES_LOCAUX`).
- Pages légales accessibles (mentions / politique de confidentialité) + CSP `<meta>`.
- (Optionnel) Horodatage qualifié RFC 3161 pour les signatures.
