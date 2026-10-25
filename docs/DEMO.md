# Démo DRILLS.ai — cible 1 min 40

## Format recommandé

Capturer le vrai navigateur avec OBS, puis couper les temps morts dans CapCut. Une capture macOS simple convient aussi si OBS n’est pas déjà prêt. Remotion est pertinent pour une vidéo animée programmée en React, mais n’est pas nécessaire pour cette démonstration de produit.

Utiliser un profil fictif clairement identifié ou son propre profil avec les coordonnées masquées. Ne pas présenter une annonce fictive comme une offre réelle. Ne pas présenter un résultat préparé à l’avance comme un calcul instantané.

## Préparer la prise

- Vérifier la dernière version publiée, puis ouvrir `/fr/?reset=1` pour vider le dossier de ce navigateur. Pour un second test sans toucher à sa session, utiliser une fenêtre privée.
- Désactiver les notifications, fermer les onglets personnels et masquer les favoris sensibles.
- Faire un vrai diagnostic avant la prise pour vérifier le backend ; le bilan de santé seul ne teste pas OpenAI.
- Préparer une annonce publique encore accessible et son URL. Les résultats des flux peuvent être vides : le collage d’annonce est un parcours normal.
- Enregistrer une première séquence d’accueil/import, puis le résultat réellement obtenu. Couper l’attente avec une transition « Analyse terminée » ; ne pas inventer de chiffres.
- Vérifier le micro avec une prise de 10 secondes. Capturer à 1080p, texte lisible, curseur lent.
- Conserver quelques secondes de marge : viser 1 min 40, jamais plus de 2 minutes.

## Déroulé et voix off

| Temps | À montrer | Voix off proposée |
| --- | --- | --- |
| 0–12 s | Accueil, titre puis profil | « Quand on se reconvertit vers l’IA, on peut avoir des projets et des années d’expérience sans savoir si son profil correspond à une offre. Je connais ce doute : c’est pour ça que j’ai créé Drills. » |
| 12–27 s | Import du CV, texte relu, GitHub brièvement | « Drills aide à décrocher ses premiers entretiens d’Agent Engineer. J’importe mon CV, je vérifie mon parcours et je peux ajouter un projet GitHub en précisant ma contribution. » |
| 27–42 s | Opportunités, sélection ou collage | « Je cherche une opportunité ou je colle une annonce que j’ai trouvée. Mon profil est déjà là : je n’ai pas à raconter mon parcours une deuxième fois. » |
| 42–60 s | Diagnostic, preuve et prochaine action | « Le diagnostic distingue ce que mon parcours démontre, ce qui manque et les conditions à vérifier. Le pourcentage mesure la couverture des compétences, pas mes chances d’être recrutée. Et je sais sur quoi agir ensuite. » |
| 60–74 s | CV structuré, édition, bouton Postuler | « Je prépare un CV adapté, je garde la main sur le texte, puis je retrouve directement l’annonce pour postuler. Le suivi m’aide à garder une trace de mes candidatures. » |
| 74–88 s | Petit carton technique ou interface en arrière-plan | « L’API OpenAI extrait le CV et produit une analyse structurée. Le code vérifie les références et calcule la couverture. Les offres viennent de Greenhouse et Ashby ; des outils sont aussi exposés par MCP. » |
| 88–100 s | Accueil, lien public et bref avant/après | « Samedi, je construisais encore un outil d’exercices. Dimanche, j’ai recentré le produit sur un besoin concret : transformer ce qu’on sait déjà faire en candidature crédible. La prochaine étape : le tester avec d’autres personnes en reconversion. » |

Lire naturellement et raccourcir si nécessaire ; ne pas accélérer artificiellement pour faire entrer chaque mot. Le script représente une proposition de narration, pas une mesure de performance ou d’impact.

## Dire précisément ce qui utilise OpenAI

Dans le produit : Responses API, entrée PDF, Structured Outputs et génération des brouillons. Le score et les contrôles de références sont calculés par le code. MCP expose des outils ; il ne prouve pas que ChatGPT est connecté. Ne pas annoncer Agents SDK, Realtime ou quatre agents actifs dans le diagnostic actuel.

Pour le processus de création : on peut dire « J’ai itéré avec ChatGPT/Codex pour développer, tester et simplifier le parcours », si cela reflète bien son usage. Distinguer cette aide au développement des appels API exécutés pour les utilisateurs.

## Dernière vérification

Relire les sous-titres, vérifier le son, la durée et les données visibles. Ne pas enregistrer de clé API, de terminal contenant des secrets ou d’écran de facturation. Le lien final doit ouvrir le site public, pas localhost ou seulement le backend Render.
