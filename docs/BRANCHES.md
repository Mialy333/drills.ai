# Consolidation du hackathon — 25 octobre 2026

`main` devient la référence du produit final. La consolidation conserve le contenu du MVP final, et rattache les lignées de développement antérieures sans réintroduire leur ancien produit de cours ou d’exercices. C’est une décision explicite de remplacement fonctionnel, pas une fusion automatique de toutes les versions du code.

## Audit avant consolidation

| Branche distante | Pointe auditée | Commits non accessibles depuis le MVP |
| --- | --- | ---: |
| main | c60b69c | 0 |
| devday-codex | 341d733 | 0 |
| feat/agent-orchestration | 87534bc | 14 |
| feat/behavioral-validator-tests | 4a5f86a | 27 |
| feat/drills-ai-ux-refactor | 47a18a7 | 0 |
| feat/fastapi-multi-agent-backend | 52d0bd7 | 1 |
| feat/hackathon-mvp | 0298741 | 0 |
| feat/offline-first-session | a9422b4 | 0 |
| feat/ux-journey-audit | 06f13dd | 1 |
| feat/validator-hardening | b9a4ac1 | 24 |

Les chiffres se recouvrent : **31 commits distincts** étaient absents de l’ascendance du MVP. Le commit de consolidation conserve ces commits comme ancêtres avec leurs auteurs et dates d’origine. Aucun squash, rebase, antidatage ou force-push n’est nécessaire. Le contenu retenu est celui du MVP testé, avec le nettoyage et la documentation finale.

## Une branche de travail, transition des déploiements

Utiliser désormais `main` pour le développement. Les anciennes branches sont conservées temporairement comme points de retour ; elles ne sont plus des versions concurrentes à développer.

Render est actuellement configuré sur `feat/hackathon-mvp`. La consolidation met aussi cette branche au même commit que `main` afin de ne pas interrompre ce déploiement. Avant de supprimer cette branche :

1. Passer la branche du service Render à `main` dans ses paramètres.
2. Mettre `branch: main` dans `render.yaml`.
3. Autoriser `main` dans l’environnement GitHub `github-pages` et vérifier un déploiement réussi.
4. Vérifier le parcours sur le site publié, puis supprimer les anciennes branches depuis GitHub si souhaité.

Ne pas supprimer les worktrees du Mac avant d’avoir sauvegardé leurs modifications non commitées. La consolidation distante ne récupère pas les fichiers restés seulement sur le Mac.

## Contributions GitHub

Les auteurs inspectés utilisent l’adresse noreply GitHub de Mialy333. GitHub compte les commits selon ses critères, notamment leur présence dans la branche par défaut et l’association de l’adresse d’auteur au compte. Ce sont les commits, pas chaque opération de push, qui comptent. Le recalcul n’est pas nécessairement immédiat.

Référence : https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference
