# DRILLS.ai

**Décroche tes premiers entretiens d’Agent Engineer.**

Importe ton CV, choisis une offre et prépare une candidature qui met ton parcours en valeur. Pour un stage, une alternance ou un premier emploi.

[Essayer en français](https://mialy333.github.io/drills.ai/fr/) · [Try in English](https://mialy333.github.io/drills.ai/en/)

Projet construit pendant le hackathon OpenAI Devday — **Impact → New Opportunities → Jobs**, en build in public.

## Pourquoi Drills ?

Quand on se reconvertit, on peut avoir des années d’expérience, des formations et des projets, sans savoir comment les présenter pour un premier poste dans l’IA. Faut-il encore apprendre un outil, ou mieux expliquer ce que l’on sait déjà faire ?

Drills rapproche un parcours d’une offre précise : ce qui est étayé, ce qui manque et la prochaine action utile. L’objectif est d’aider à préparer puis envoyer une candidature crédible. Le produit ne garantit ni entretien ni emploi.

## Le parcours actuel

1. **Profil** — importer un CV PDF ou saisir son parcours. Relire le texte extrait et ajouter, si utile, un dépôt GitHub public avec sa contribution personnelle. Le lieu de résidence et le droit de travailler sont des déclarations facultatives, distinctes.
2. **Opportunités** — chercher des offres publiques ou coller une annonce. Le profil est réutilisé. Une offre sélectionnée conserve son lien de candidature.
3. **Diagnostic** — examiner les compétences documentées, les points à clarifier et la prochaine action. Les conditions d’éligibilité sont séparées des compétences.
4. **Candidature** — relire et modifier un CV structuré et une présentation de son parcours, exporter le CV en PDF depuis l’aperçu d’impression, puis ouvrir le site de l’annonce pour postuler.

Le **suivi** conserve les offres analysées, les statuts renseignés par le candidat, les dates d’envoi et les notes. Ouvrir une annonce ou exporter un CV ne compte pas comme une candidature envoyée.

L’interface est disponible en français et en anglais. Changer de langue conserve le dossier ; cela ne traduit pas automatiquement les annonces, le CV ou les textes déjà rédigés.

**Périmètre final du hackathon : décrocher un entretien.** La préparation aux entretiens, les cours et les exercices Python ont été retirés du parcours public. Leur ancien code reste dans l’historique et, pour certains modules, dans le dépôt ; ce ne sont pas des fonctionnalités actives du MVP.

## OpenAI et les services connectés

| Usage | Implémentation actuelle |
| --- | --- |
| Lire un CV PDF | OpenAI Responses API, entrée PDF, extraction structurée ; fichier de 4 Mio maximum |
| Analyser un profil et une annonce | `ApplicationAgent`, Responses API et Structured Outputs validés avec Pydantic |
| Préparer les textes de candidature | Brouillons fondés sur le profil fourni, éditables avant export |
| Vérifier la provenance et calculer la couverture | Code Python : références vers les extraits originaux, validation et calcul déterministe |
| Trouver des offres | API publiques Greenhouse et Ashby, filtres junior/stage/alternance et localisation |
| Ajouter un projet | Métadonnées publiques GitHub, sans token ; prévisualisation et contribution personnelle confirmée |
| Exposer des outils | Serveur MCP optionnel : `search_jobs`, `get_job`, `score_documented_match` |

Les connecteurs d’offres interrogent une sélection limitée de tableaux d’entreprises. Ils peuvent ne retourner aucune offre adaptée ; ce n’est pas un moteur exhaustif du marché. L’import GitHub ne lit pas le code et ne prouve pas la maîtrise technique.

Le produit appelle **l’API OpenAI**, pas une session ChatGPT. Le serveur MCP permet à un client compatible d’utiliser ses outils, mais une connexion effective à ChatGPT doit être configurée et testée séparément. MCP n’est pas une base d’annonces.

L’ancien prototype coordonnait quatre agents pour produire des exercices. Le diagnostic actuel utilise `ApplicationAgent` et des vérifications déterministes ; il ne faut pas le présenter comme quatre agents autonomes collaborant en production. Agents SDK, Realtime et Web Search ne sont pas utilisés dans le parcours public actuel.

## Ce que signifie le diagnostic

Le pourcentage décrit la **couverture documentée des compétences extraites de cette annonce**, jamais une probabilité d’embauche. Les compétences sont pondérées par priorité (3/2/1) et par preuve (documentée : 1 ; partielle : 0,5 ; absente : 0). Le seuil de 60 % est une règle produit, pas une mesure validée auprès de recruteurs.

Les conditions d’éligibilité non résolues restent visibles même si la couverture des compétences est élevée. Une résidence en France ne prouve pas un droit de travailler ; une déclaration du candidat n’est pas une vérification juridique. Les rôles jugés hors périmètre n’obtiennent pas de score numérique.

Le modèle choisit des identifiants d’extraits originaux ; le serveur vérifie les références. Cela limite les citations inventées, mais ne garantit pas la pertinence de l’analyse ou la véracité du CV. Une seule tentative de correction est permise en cas de réponse invalide. Les textes doivent être relus avant envoi.

## Données et limites du MVP

- Un nouveau navigateur commence avec un dossier vide. Aucun CV réel de la créatrice n’est préchargé dans le site construit. L’exemple proposé est explicitement fictif et ne fabrique pas un diagnostic réussi.
- Le dossier, les coordonnées saisies pour le CV et le suivi sont conservés dans le navigateur : session avec expiration d’un jour, ou stockage local pendant 30 jours après modification si l’utilisateur choisit de le mémoriser. Pas de compte, de base de profils ni de synchronisation entre appareils.
- Avec son accord, le profil et l’annonce sont transmis au backend puis à OpenAI. Le PDF est traité en mémoire ; l’application ne l’enregistre pas sur disque. Les coordonnées ajoutées dans l’éditeur d’export ne sont pas envoyées séparément au modèle ; celles contenues dans le CV importé font partie de l’entrée.
- Les appels Responses utilisent `store=False`. Cela ne supprime pas toute politique de traitement ou de rétention du fournisseur.
- « Effacer mon dossier » supprime les données du dossier sur ce navigateur. Les fichiers téléchargés, les autres navigateurs et les traitements antérieurs du fournisseur ne sont pas effacés par ce bouton.
- Les endpoints de candidature ont des délais, des limites de fréquence et de concurrence. Ces protections de démonstration ne remplacent pas l’authentification, un plafond de dépenses ni une validation de sécurité de production.
- Aucun code candidat n’est exécuté et aucune candidature n’est envoyée automatiquement.

Pour repartir à zéro avant une démonstration, ouvrir [l’accueil avec remise à zéro](https://mialy333.github.io/drills.ai/fr/?reset=1) dans **le navigateur concerné**. Le lien public ordinaire convient aux nouveaux utilisateurs.

## Lancer le projet

Prérequis : Node.js 22, Python 3.12 et `uv` (ou un environnement Python équivalent).

```bash
git clone https://github.com/Mialy333/drills.ai.git
cd drills.ai
git switch main
npm ci
uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -r requirements-devday.txt -r requirements-mcp.txt
```

Configurer `OPENAI_API_KEY` dans un fichier `.env` ignoré par Git ou dans l’environnement du backend. Ne jamais placer cette clé dans une variable `PUBLIC_`. Le modèle est configurable avec `OPENAI_APPLICATION_MODEL` ; le défaut du code est `gpt-4o-2024-08-06`. L’accès au modèle dépend du projet OpenAI utilisé.

Terminal backend :

```bash
source .venv/bin/activate
python -m uvicorn api.main:app --reload --port 8000
```

Terminal frontend :

```bash
npm run dev -- --port 4321 --strictPort
```

Ouvrir <http://localhost:4321/drills.ai/fr/>. Pour activer MCP localement, ajouter `DRILLS_ENABLE_MCP=true` au lancement du backend ; son endpoint est `/mcp/`.

## Vérifier et déployer

```bash
python -m pytest -q
npm run test:contracts
npm run build
npm run test:ui
```

Le build contrôle notamment l’absence de routes de cours/exercices et de références connues aux données personnelles de démonstration. Les tests API utilisent des réponses OpenAI simulées : ils ne prouvent pas la qualité des réponses réelles, la disponibilité du modèle ou le rendu sur chaque navigateur.

- **Frontend : GitHub Pages**, base Astro `/drills.ai/`. Le workflow `Deploy to GitHub Pages` démarre sur un push de `main` ou manuellement. La variable GitHub Actions `DRILLS_API_URL` devient `PUBLIC_DRILLS_API_URL` au build. L’environnement `github-pages` doit autoriser la branche publiée.
- **Backend : Render**, configuration dans `render.yaml`, secret `OPENAI_API_KEY` côté serveur. URL configurée : <https://drills-ai-api.onrender.com>. `/health` vérifie la disponibilité du service et la présence de configuration, pas une réponse réelle d’OpenAI.
- **Transition des branches :** `main` est la référence du produit final. La branche `feat/hackathon-mvp` reste temporairement un miroir de compatibilité pour le service Render existant. Voir [la consolidation de l’historique](docs/BRANCHES.md) avant de changer ou supprimer une branche de déploiement.

## Du prototype au produit

Le samedi 24 octobre 2026, le travail portait encore sur les exercices, les agents spécialisés, les contrôles et le service FastAPI. Le dimanche, le produit a pivoté vers un besoin plus précis : transformer un parcours existant en candidature crédible pour un premier poste d’Agent Engineer.

Le week-end a ajouté l’import PDF, le diagnostic, les offres publiques, l’import GitHub, le CV éditable, les liens pour postuler et le suivi. Les retours d’usage ont conduit à simplifier le parcours, séparer éligibilité et compétences, puis retirer la préparation aux entretiens pour se concentrer sur l’obtention du premier entretien.

[Scénario de démo — 1 min 40](docs/DEMO.md)

## Ensuite

La priorité est de tester le parcours avec des personnes en reconversion et de faire relire les diagnostics par des recruteurs ou des ingénieurs. Mesurer le temps gagné, les corrections nécessaires et les candidatures effectivement envoyées avant d’élargir le produit.

Comptes sécurisés, davantage de sources d’offres, recherche de contacts et préparation aux entretiens sont des pistes, pas des fonctions livrées.

## Repères dans le code

- `src/pages/[lang]/` : pages françaises et anglaises.
- `src/scripts/application.ts` : parcours candidat et éditeur.
- `src/lib/application-state.ts`, `application-history.ts` : stockage local et suivi.
- `src/ai_generator/application.py` : analyse, validation et score.
- `api/main.py` : API et endpoints retirés.
- `tests/` : contrats, tests Python et parcours UI.
