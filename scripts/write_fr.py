from pathlib import Path
OUT = Path(__file__).resolve().parent.parent / "src" / "drills" / "fr"
OUT.mkdir(parents=True, exist_ok=True)
GECKO = "https://github.com/Mialy333/my-gecko-buyer"
GRA = "https://github.com/Mialy333/grounded-research-agent"
NOVA = "https://github.com/Mialy333/novamart-multi-agent-support"

D = []
def add(id, cat, order, minutes, title, source, statement, solution):
    D.append((id, cat, order, minutes, title, source, statement.strip(), solution.strip()))

add("d1", "debug", 1, 15, "Le préfixe qui aveugle le scanner", f"[my-gecko-buyer]({GECKO}) · scripts/scan_secrets.py", r"""
La règle `ASSIGNED` du scanner de secrets attrape `PRIVATE_KEY=...` mais laissait passer `SOLANA_PRIVATE_KEY=...`, `OPENAI_API_KEY=...` et `AWS_SECRET_ACCESS_KEY=...`.

```python
ASSIGNED = re.compile(
    r"(?i)\b(private_key|secret_key|seed_phrase|mnemonic)\b\s*[:=]\s*[\"']?[^\s\"']{16,}"
)
```

- Trouve pourquoi le préfixe `SOLANA_` suffit à tout casser. Indice : ce que `\b` considère comme une frontière de mot.
- Écris d'abord 3 tests qui échouent, puis corrige.
- Question d'entretien : « Ton scanner a-t-il des faux négatifs ? Comment le sais-tu ? »

Ce bug était réel : il a été corrigé le 22 octobre 2026 dans la [PR #2]({GECKO}/pull/2). Refais-le de tête sur une copie avant de relire la PR.
""".replace("{GECKO}", GECKO), r"""
**Cause.** Un caractère de mot est une lettre, un chiffre ou `_`. `\b` marque le passage entre un caractère de mot et un caractère qui n'en est pas un. Entre `_` et `P`, les deux côtés sont des caractères de mot : pas de frontière, donc la regex ne peut pas commencer sur `PRIVATE_KEY`.

**Correctif** (celui de la PR) :

```
(?<![a-z0-9_])        le caractère d'avant n'est ni lettre, ni chiffre, ni _
(?:[a-z0-9]+_)*       zéro ou plusieurs préfixes comme SOLANA_ ou AWS_
(private_key|secret_key|secret_access_key|api_key|seed_phrase|mnemonic)
\b                    le nom s'arrête là
\s*[:=]\s*["']?[^\s"']{16,}   une valeur d'au moins 16 caractères
```

Le `(?<!...)` est un lookbehind négatif : il regarde ce qui précède sans le consommer.

**Ce qu'attend un CTO :**

- **L'arbitrage.** Un faux négatif coûte une clé fuitée ; un faux positif coûte un hook désactivé par l'équipe. Les tests négatifs comptent autant : `OPENAI_API_KEY=your-key-here` (moins de 16 caractères) et `API_KEY_ID=...` (le `\b` final échoue après `KEY`) ne sont pas signalés.
- **Un corpus de tests** : une liste « doit être attrapé », une liste « ne doit pas l'être ».
- **La défense en profondeur** : GitHub push protection, gitleaks ou trufflehog font mieux qu'un script maison, qu'on garde parce qu'il est sans dépendance et adapté aux clés Solana.
- **La limite assumée** : `password` et `token` ne sont pas couverts.
""")

add("d2", "debug", 2, 15, "Tous les secrets portent la même étiquette", "Dev3Pack, session 9 · fonction redact", r"""
Symptôme : une clé `sk-...` sort étiquetée `email`.

```python
PATTERNS = {"api_key": r"sk-[A-Za-z0-9]{20,}", "email": r"[\w.+-]+@[\w-]+\.[\w.]+"}

def redact(text):
    replacers = []
    for label, pattern in PATTERNS.items():
        replacers.append((re.compile(pattern),
            lambda m: f"[redacted:{label}:{sha8(m.group(0))}]"))
    for regex, repl in replacers:
        text = regex.sub(repl, text)
    return text
```

Explique à voix haute, sans exécuter, pourquoi. Puis donne 2 corrections différentes.
""", r"""
**Cause.** Une lambda capture la **variable** `label`, pas sa valeur. Elle la lit quand elle est appelée, et à ce moment la boucle est finie : `label` vaut `"email"` pour toutes.

**Trois correctifs** :

```python
# 1. Argument par défaut : évalué à la création de la lambda
lambda m, label=label: f"[redacted:{label}:{sha8(m.group(0))}]"

# 2. functools.partial : fige l'argument explicitement
partial(_replace, label)

# 3. Appliquer le remplacement dans la boucle, sans stocker la lambda
for label, pattern in PATTERNS.items():
    text = re.sub(pattern, lambda m: ..., text)
```

**Ce qu'attend un CTO :** le mot exact, *late binding* des closures, et la généralisation. Le même piège existe en JavaScript avec `var` dans une boucle, et dans les callbacks enregistrés en boucle. Le correctif 3 est souvent le meilleur : le bug vient de ce qu'on stocke une fonction pour plus tard.
""")

add("d3", "debug", 3, 15, "Le paragraphe zéro", f"[grounded-research-agent]({GRA}) · agent.py", r"""
La ligne `chosen = [numbered[n - 1] for n in numbers]` transforme le numéro choisi par le modèle en paragraphe. Si le modèle renvoie `0`, Python ne plante pas : il prend **le dernier paragraphe**, souvent d'un autre document, et le cite.

- Trouve dans le code la ligne qui empêche ce bug. Elle existe : où est-elle, et pourquoi est-ce le bon endroit ?
- Liste les 3 réponses pièges d'un petit modèle : `0`, un numéro trop grand, le même numéro deux fois.
- Question d'entretien : « Pourquoi un indice négatif est-il plus dangereux qu'une IndexError ? »
""", r"""
**Verdict.** Ce n'est pas un bug dans ce code : `_selection` refuse tout numéro hors de `1..count` (ligne 178) et retire les doublons. Aucun test ne le protégeait ; la [PR #2]({GRA}/pull/2) en ajoute 10, et retirer la ligne 178 en fait échouer 3.

**Pourquoi un indice négatif est pire qu'une IndexError :** une erreur bruyante se voit au premier test ; une erreur silencieuse produit une réponse plausible avec une citation fausse. Dans un agent qui cite ses sources, c'est la panne qu'on veut empêcher.

**Ce qu'attend un CTO :** le principe *parse, don't validate*. On transforme la sortie du modèle en type sûr à la frontière, et le reste du code n'a plus à se méfier. Toute sortie de LLM est une entrée non fiable. Bonus : tester une fonction interne comme `_selection` est d'habitude à éviter, mais c'est justifié ici parce que c'est la frontière de sécurité.
""".replace("{GRA}", GRA))

add("d4", "debug", 4, 15, "Le Decimal devenu texte", f"[NovaMart]({NOVA}) · _to_json_safe", r"""
`_to_json_safe` fait `json.loads(json.dumps(item, default=str))`. `total_orders` vaut alors `'7'`, et `total_orders > 5` lève une `TypeError`.

- Trouve dans NovaMart un endroit où un nombre sorti de DynamoDB est comparé ou additionné après ce passage.
- Propose un `default` qui garde les entiers en `int` et les décimaux en `float`, et dis ce que tu perds avec `float`.
""", r"""
**Cause.** `default=str` transforme chaque `Decimal` en chaîne. Le JSON est valide, mais le type a changé.

```python
def dynamo_default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"{type(o).__name__} is not JSON serializable")
```

**Ce que tu perds avec `float` :** l'exactitude, `0.1 + 0.2 != 0.3`. Pour un compteur, sans importance ; pour de l'argent, jamais de float. On garde `Decimal` dans le code, et des entiers en plus petite unité dans le JSON, comme `price_raw` dans le Gecko buyer.

**Ce qu'attend un CTO :** lever une `TypeError` pour un type inconnu plutôt que tout convertir en `str`. Ne jamais convertir en silence.
""")

add("d5", "debug", 5, 10, "Le panier partagé", "Black Monday 1987 · historique des tours", r"""
```python
def record_turn(phrase, history=[]):
    history.append(phrase)
    return history

game_1 = record_turn("sell")
game_2 = record_turn("buy")
```

Symptôme : la deuxième partie contient les phrases de la première. Prédis `game_1`, `game_2` et `game_1 is game_2`, puis corrige. C'est la question Python la plus posée en entretien junior.
""", r"""
**Prédiction :** `['sell', 'buy']`, `['sell', 'buy']`, `True`.

**Cause.** Les valeurs par défaut sont évaluées **une seule fois**, quand Python exécute la ligne `def`. Toutes les parties partagent la même liste.

```python
def record_turn(phrase, history=None):
    if history is None:
        history = []
    history.append(phrase)
    return history
```

**Ce qu'attend un CTO :** le lien avec D2 (même mécanisme d'évaluation), l'outil qui l'attrape (`ruff`, règle B006), et la remarque qu'une fonction qui modifie son argument et le renvoie a deux responsabilités.
""")

add("d6", "debug", 6, 15, "La commande livrée dans le futur", f"[NovaMart]({NOVA}) · _days_since", r"""
`_days_since("2026-10-25")`, appelé le 22 octobre, renvoie `-3`. Si l'éligibilité au retour est `days <= 30`, une commande à date future est remboursable.

- Décide ce que doit renvoyer la fonction pour une date future, et qui doit le décider.
- Ajoute la règle à `RULES.md` avec son test.
""", r"""
**Le vrai sujet n'est pas le code, c'est qui décide.** Une date de commande future est une donnée invalide. Deux réponses défendables :

- `_days_since` lève une `ValueError`, et l'appelant refuse le retour avec un message clair ;
- ou elle renvoie `None`, et l'éligibilité traite `None` comme « inéligible, à vérifier par un humain ».

Inacceptable : laisser `-3` passer le test `days <= 30`.

**Ce qu'attend un CTO :** que tu poses la question au métier au lieu de choisir seule, et que tu penses aux fuseaux horaires : une commande passée à Paris à 1 h du matin peut sembler « demain » en UTC.
""")

add("d7", "debug", 7, 10, "Une trace en 2 minutes", "Journal du runbook · vraies pannes", r"""
Quelqu'un te montre seulement la trace. Tu as 2 minutes pour dire la ligne qui compte et la cause :

1. `ensurepip` plante en créant un venv
2. `Could not import module "main"`
3. `OPTIONS /turn 405` dans les logs de l'API
4. `MissingDependencyException` avec `botocore[crt]`
""", r"""
**La méthode :** lire **de bas en haut**. La dernière ligne donne le type et le message ; remonter jusqu'à la première ligne de **ton** code. Si la trace contient « During handling of the above exception », la vraie cause est la première exception.

| Trace | Ligne qui compte | Cause |
| --- | --- | --- |
| `ensurepip` | `Symbol not found: _XML_SetAllocTrackerActivationThreshold` | Python Homebrew compilé pour une libexpat plus récente que celle de macOS ; ensurepip n'est que la victime |
| `Could not import module "main"` | Le message | uvicorn lancé hors du dossier `api/` |
| `OPTIONS /turn 405` | Le verbe `OPTIONS` | Preflight CORS non géré ; `CORSMiddleware` limité à l'origine du jeu |
| `MissingDependencyException` | `botocore[crt]` | Dépendance optionnelle d'`aws login` absente du venv |

**Ce qu'attend un CTO :** distinguer symptôme et cause, et dire ce que tu vérifies avant de toucher au code : `pwd`, `which python`, `uname -m`, les versions des paquets.
""")

add("r1", "refactor", 1, 45, "Paralléliser les deux appels à Decider", "Black Monday 1987 · api/main.py", r"""
Chaque tour appelle Decider deux fois, l'un après l'autre : 708 ms par tour.

Lance-les en parallèle (`asyncio.gather` ou un pool de threads), puis mesure. Preuve : latence médiane avant et après, tests verts.
""", r"""
Les deux appels sont indépendants. Client synchrone : un pool de 2 threads suffit, car le GIL est relâché pendant l'attente réseau. Client asynchrone : `asyncio.gather`. Attendu : le plus long des deux, environ 350 ms.

**Le piège qu'un CTO attend que tu voies :** le serveur Decider local fait tourner un seul modèle. S'il traite les requêtes une par une, paralléliser côté client ne gagne **rien**. D'où la mesure obligatoire : médiane sur 20 tours avec `time.perf_counter`. Gain nul : tu gardes le code simple et tu notes pourquoi.
""")

add("r2", "refactor", 2, 30, "Les seuils dans une table", "Black Monday 1987 · seuils de confiance", r"""
Les seuils par action (0,75 et 0,5 pour vendre et acheter ; 0,2 pour les actions sans risque) sont écrits dans des `if`.

Mets-les dans une table et une seule fonction qui la lit. Preuve : les 2 tests de non-régression passent sans être modifiés.
""", r"""
```python
THRESHOLDS = {"sell": (0.75, 0.5), "buy": (0.75, 0.5)}  # (exécute, hésite)
DEFAULT = (0.2, 0.2)  # actions sans risque

def band_for(action: str, confidence: float) -> str:
    execute, hesitate = THRESHOLDS.get(action, DEFAULT)
    if confidence >= execute:
        return "execute"
    return "hesitate" if confidence >= hesitate else "say_again"
```

Les noms de bandes sont à aligner sur ceux de ton `api/main.py`. Ce qu'un CTO apprécie : la règle métier devient une donnée lisible par quelqu'un qui ne code pas, et un seuil se change sans toucher à la logique.
""")

add("r3", "refactor", 3, 45, "Extraire l'expression DynamoDB", f"[NovaMart]({NOVA}) · _update_workflow_state", r"""
`_update_workflow_state` mélange dans une boucle la construction de l'expression, l'appel à DynamoDB et le réessai.

Extrais une fonction pure qui construit l'expression, et teste-la sans base. Que découvres-tu en l'extrayant ?
""", r"""
```python
def build_update(updates: dict, expected_version: int) -> tuple[str, dict, dict]:
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    sets = [f"#{k} = :{k}" for k in updates] + ["version = :new_version"]
    values |= {":new_version": expected_version + 1, ":expected_version": expected_version}
    return "SET " + ", ".join(sets), names, values
```

**Le vrai bug trouvé en extrayant :** le code actuel écrit les noms de colonnes directement dans l'expression. DynamoDB a des centaines de mots réservés (`status`, `name`, `data`…) : une colonne `status` ferait échouer l'écriture. `ExpressionAttributeNames` (les `#k`) règle ça. C'est ce genre de découverte qui justifie un refactoring en entretien.
""")

add("r4", "refactor", 4, 20, "Savoir ne pas refactorer", f"[my-gecko-buyer]({GECKO}) · buyer/check.py", r"""
Les 5 fonctions `check_*` ont le même squelette : comparer, puis refuser ou accepter.

Une table de règles serait-elle mieux, ou la répétition est-elle voulue ? Défends ton choix en 5 lignes, comme une note d'architecture.
""", r"""
**La bonne réponse : garder les 5 fonctions.**

- Elles se ressemblent par la forme, pas par le sens : `check_price` refuse un prix absent, `check_mint` compare des adresses, `check_store` recalcule une adresse dérivée.
- Une table cacherait ces cas particuliers dans des options, et le code de sécurité doit se lire d'un coup d'œil.
- Chaque fonction a ses tests et son message d'erreur.

La phrase à connaître : « la duplication coûte moins cher qu'une mauvaise abstraction » (Sandi Metz). On factorise à la 3e répétition **du même sens**, pas de la même forme. Savoir ne pas refactorer est un signal de séniorité.
""")

add("r5", "refactor", 5, 45, "Extraire la sélection des paragraphes", f"[grounded-research-agent]({GRA}) · agent.py", r"""
La méthode qui transforme la sélection du modèle en réponse mêle sélection, source unique, citations et trace.

Extrais « choisir les paragraphes » en fonction pure, et dis où vit chaque garantie.
""", r"""
```python
def pick_paragraphs(numbered: list[tuple[str, str]], numbers: list[int]) -> list[tuple[str, str]]:
    chosen = [numbered[n - 1] for n in numbers]
    source = chosen[0][0]
    return [p for p in chosen if p[0] == source]  # une seule source par réponse
```

La validation reste dans `_selection`, à la frontière : `pick_paragraphs` peut supposer des numéros valides. Un CTO attend que tu dises **où** vit chaque garantie, plutôt que de revérifier partout.
""")

add("r6", "refactor", 6, 45, "Relire un fichier écrit par l'IA", "N'importe lequel de tes repos", r"""
Choisis un fichier écrit par l'IA que tu n'as jamais relu ligne à ligne. Renomme, supprime le code mort, ajoute les annotations de type.

Preuve : `ruff` et `mypy` sans erreur, diff relu à voix haute.
""", r"""
L'ordre qui fonctionne :

1. `ruff check` et `mypy --strict` d'abord : l'outil trouve ce qu'il sait trouver.
2. Supprimer le code mort, en vérifiant chaque fonction avec `git grep`.
3. Renommer ce qui ment, par exemple une fonction `get_x` qui écrit en base.
4. Ajouter les annotations de type manquantes.
5. Relire le diff à voix haute, une ligne à la fois.

Ce qui impressionne : une liste écrite des choix de l'IA que tu as **gardés**, avec la raison.
""")

add("l1", "read", 1, 10, "Le verrouillage optimiste sous pression", f"[NovaMart]({NOVA}) · _update_workflow_state", r"""
Deux agents écrivent la même session en même temps.

1. Qui gagne, et que fait le perdant ?
2. Après un conflit, le code relit la version mais renvoie les **mêmes** `updates`. Quand est-ce correct, et quand perd-on une donnée ?
3. Que voit l'utilisateur après le 3e échec ?
""", r"""
1. **Le premier** `update_item` arrivé. Le second échoue sur `ConditionalCheckFailedException`, relit la nouvelle version, attend 0,1 s puis 0,2 s, et réessaie.
2. **Correct** quand chaque agent écrit ses propres colonnes sans les calculer depuis l'état lu, ce qui est le cas de NovaMart. **Donnée perdue** si deux agents écrivent la même colonne, ou si la valeur dépend de la lecture (un compteur) : le réessai écrase avec un calcul périmé. Réflexe : recalculer `updates` depuis l'état relu, dans la boucle.
3. **Une `RuntimeError`.** Ce que voit l'utilisateur dépend de qui l'attrape : à vérifier dans le code. En entretien, « je ne sais pas, je vérifierais ici » est une bonne réponse.

**Vocabulaire attendu :** compare-and-swap, lost update, et pourquoi l'optimiste convient quand les conflits sont rares.
""")

add("l2", "read", 2, 10, "Le pin et la vérification", f"[my-gecko-buyer]({GECKO}) · check_price, check_store", r"""
1. Pourquoi `price_raw is None` est-il un refus et pas un accord ?
2. Pourquoi l'adresse du magasin est-elle recalculée au lieu d'être lue dans la réponse de Gecko ?
3. Que se passe-t-il si `budget_raw` est un `float` ? Un test protège-t-il ce cas ?
""", r"""
1. **Fail closed** : un prix inconnu n'est pas un prix sous le budget. Un système qui déplace de l'argent dit non en cas de doute.
2. **La chose vérifiée ne doit jamais fournir la réponse attendue.** Lue dans la réponse de Gecko, une adresse falsifiée se validerait elle-même.
3. **L'annotation `int` n'est pas vérifiée à l'exécution**, et aucun test ne refuse un `budget_raw` float (`test_a_float_price_is_refused` protège la construction d'instruction, pas le budget). Le danger est en amont : `2.01 * 10**6` vaut `2009999.9999999998`, donc `int()` donne un budget faux d'une unité, alors que `Decimal("2.01")` donne `2010000`. Réponse attendue : valider le type à la frontière (`__post_init__` ou Pydantic) et ajouter le test.
""")

add("l3", "read", 3, 10, "Isolation des clients", f"[NovaMart]({NOVA}) · _check_customer_scope", r"""
Le commentaire dit : sans client lié, l'accès est autorisé.

1. Dans quelle situation réelle aucun client n'est lié ?
2. Est-ce un risque en production ? Propose ta règle.
""", r"""
1. Dans les tests et les scripts qui appellent les outils directement, sans orchestrateur.
2. **Oui, c'est du fail open.** Une future route qui oublie de lier le client donnerait accès à tous les clients, sans erreur. La règle : refuser quand aucun client n'est lié, et que les tests lient un client explicitement. La sécurité par défaut ne doit pas dépendre de la discipline de chaque appelant.
""")

add("l4", "read", 4, 20, "Suivre une requête dans un repo inconnu", "[full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template)", r"""
Sans IA, en 20 minutes : suis le `POST` de création d'un utilisateur jusqu'à la ligne en base. Cite chaque fichier traversé et dessine le chemin.
""", r"""
Pas de solution à recopier : la preuve est ton schéma. Points de contrôle : le routeur (`backend/app/api/routes/`), la dépendance qui injecte la session et l'utilisateur courant, le modèle SQLModel, la fonction CRUD qui écrit, la migration Alembic qui a créé la table. Si ton schéma n'a ni la validation d'entrée ni l'authentification, il manque deux étapes.
""")

add("l5", "read", 5, 10, "Prédire la sortie, en flash", "Bases de Python", r"""
Dix extraits de 3 à 6 lignes, 1 minute chacun. Demande-les à Claude, différents à chaque fois, sur ces thèmes : copie de liste, `is` contre `==`, portée d'une variable, `dict.get`, compréhension avec condition, `sorted` avec `key`, générateur consommé deux fois, `try / except / else / finally`, `*args` et `**kwargs`, f-string avec format.
""", r"""
Chaque réponse doit nommer le mécanisme, pas seulement la sortie :

- `a = b` crée un second nom pour le même objet ; `b[:]` une copie superficielle ;
- `is` compare l'identité, `==` l'égalité ;
- un générateur est vide au second parcours ;
- `finally` s'exécute même après un `return`.
""")

add("f1", "formats", 1, 20, "Écrire les tests d'une fonction", f"[NovaMart]({NOVA}) · _days_since", r"""
Écris 6 tests de `_days_since` avec `pytest.mark.parametrize` : date valide, date future, `None`, chaîne vide, 30 février, mauvais format.
""", r"""
Le point qui fait la différence : **rendre l'horloge injectable**, sinon le test dépend du jour où il tourne.

```python
NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)

@pytest.mark.parametrize("date_str, expected", [
    ("2026-10-22", 0),
    ("2026-09-22", 30),     # la limite de retour, pile
    ("2026-09-21", 31),
    ("2026-10-25", -3),     # date future : documente le comportement actuel
    ("2026-02-30", None),
    ("", None),
    (None, None),
    ("22/10/2026", None),
])
def test_days_since(date_str, expected):
    assert _days_since(date_str, now=NOW) == expected
```

Ce qu'un CTO regarde : les bornes (29, 30, 31) et le test qui documente un comportement douteux au lieu de le cacher.
""")

add("f2", "formats", 2, 25, "Revue d'une PR générée par l'IA", "Une PR de 60 lignes sur un de tes repos", r"""
Demande à Claude une PR de 60 lignes sur un de tes repos, avec 3 défauts cachés : un bug, une faille, un choix discutable. Rends une revue en commentaires, polie et précise.
""", r"""
Une bonne revue, dans l'ordre :

1. **Bloquant** : ce qui casse ou ouvre une faille, avec la ligne et un scénario concret.
2. **À discuter** : un choix défendable mais discutable, formulé en question.
3. **Détails** : nommage, style, regroupés en un seul commentaire.

Chaque commentaire dit quoi, pourquoi, et propose une piste. On critique le code, jamais la personne.
""")

add("f3", "formats", 3, 45, "Étendre un code existant", f"[NovaMart]({NOVA}) et [my-gecko-buyer]({GECKO})", r"""
Au choix : ajouter une tranche client « Gold » (90 jours de retour) dans NovaMart sans casser les tests, ou un 6e check sur la quantité maximale dans le Gecko buyer.
""", r"""
La démarche attendue :

1. Lire avant d'écrire : trouver où la règle actuelle (30 et 60 jours) est décidée et testée.
2. Écrire le test de la nouvelle règle, qui échoue.
3. Suivre le style du repo : même forme de message, même façon de refuser.
4. Faire passer tous les tests, anciens compris.

Ce qu'un CTO regarde : que tu n'aies pas dupliqué la règle à un deuxième endroit.
""")

add("f4", "formats", 4, 30, "Pannes d'un LLM : réessai borné", "Black Monday 1987 · voix du courtier", r"""
Écris de tête `call_with_retry(fn, tries=3)` avec attente exponentielle, plus ses tests avec un faux client.
""", r"""
```python
class TransientError(Exception): ...

def call_with_retry(fn, *, tries=3, base_delay=0.5, sleep=time.sleep):
    if tries < 1:
        raise ValueError("tries must be >= 1")
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except TransientError:
            if attempt == tries:
                raise
            sleep(base_delay * 2 ** (attempt - 1) * (1 + random.random() * 0.1))
```

Cinq points à dire à voix haute :

1. On ne réessaie que les erreurs **transitoires** (limitation de débit, délai, 503).
2. L'attente double, avec un peu de hasard (*jitter*).
3. `sleep` est injecté : le test tourne en 0 seconde.
4. On ne réessaie une écriture que si elle est **idempotente**.
5. Le dernier échec remonte, et le mode de secours écrit la raison.
""")

add("f5", "formats", 5, 25, "Sortie structurée avec Pydantic", f"[grounded-research-agent]({GRA}) · _selection", r"""
Valide une réponse de modèle avec Pydantic et teste 5 réponses pièges : liste vide, `0`, confiance à 1,7, une chaîne au lieu d'une liste, un champ manquant.
""", r"""
```python
class Selection(BaseModel):
    paragraphs: list[int] = Field(min_length=1, max_length=3)
    confidence: float = Field(ge=0, le=1)

    @field_validator("paragraphs")
    @classmethod
    def positive(cls, v):
        if any(n < 1 for n in v):
            raise ValueError("paragraph numbers start at 1")
        return v
```

À dire : on ne répare pas en silence une sortie fausse, on la refuse et on la trace. Ton `_selection` le fait à la main ; savoir quand une bibliothèque vaut mieux est la vraie question.
""")

add("f6", "formats", 6, 30, "Petit jeu d'évaluation", "Black Monday 1987 · test des 20 phrases", r"""
Refais de tête le test des 20 phrases de Decider : justesse, répétabilité, latence médiane.
""", r"""
Trois mesures, toujours ensemble : la justesse (bonnes réponses sur le total), la répétabilité (même entrée deux fois, même sortie ?) et la latence en **médiane**, car un démarrage à froid fausse la moyenne. Et la règle déjà appliquée : un seuil réglé sur un jeu se valide sur un autre, jamais vu.
""")

add("f7", "formats", 7, 20, "Données sans pandas", "Black Monday 1987 · results_v2.csv", r"""
Lis `results_v2.csv`, groupe par action attendue et affiche la précision par action, avec le nombre d'exemples.
""", r"""
```python
from collections import Counter
import csv

total, good = Counter(), Counter()
with open("results_v2.csv", newline="") as f:
    for row in csv.DictReader(f):
        total[row["expected"]] += 1
        good[row["expected"]] += row["action"] == row["expected"]
for action in sorted(total):
    print(f"{action:12} {good[action] / total[action]:.0%}  ({total[action]})")
```

Noms de colonnes à adapter. À dire : on groupe par action **attendue** pour voir quelles intentions le modèle rate, et on affiche l'effectif, car 100 % sur 2 phrases ne veut rien dire.
""")

add("f8", "formats", 8, 20, "Algorithmique de base", "Test en ligne junior", r"""
Une série par semaine, en disant la complexité avant de coder : dictionnaire de fréquences, deux pointeurs, fenêtre glissante, pile, recherche dichotomique.
""", r"""
| Motif | Exercice type | Complexité |
| --- | --- | --- |
| Dictionnaire de fréquences | Deux nombres dont la somme vaut X | O(n) au lieu de O(n²) |
| Deux pointeurs | Paire dans un tableau trié ; palindrome | O(n) |
| Fenêtre glissante | Plus longue sous-chaîne sans répétition | O(n) |
| Pile | Parenthèses bien formées | O(n) |
| Recherche dichotomique | Premier élément ≥ X dans un tableau trié | O(log n) |
""")

add("f9", "formats", 9, 2, "Raconter un bug de l'IA en 2 minutes", "Dev3Pack · chapitre final", r"""
Raconte en 2 minutes, à voix haute, un bug introduit par l'IA dans un de tes projets : comment tu l'as vu, ce que tu vérifies depuis.
""", r"""
Structure : **contexte**, **symptôme** (le chiffre), **comment tu l'as vu**, **cause**, **ce que tu vérifies depuis**.

> Sur mon agent de recherche, un score est passé à 4/10 après un changement censé l'améliorer. Le grader lisait `agent.py`, alors que la nouvelle version avait été copiée sous `agent-2.py` : je mesurais l'ancien code. Depuis, avant de lire un score, je vérifie quel fichier tourne, avec un `grep` sur une phrase propre à la nouvelle version.

Ce qu'un CTO entend : tu ne crois pas un chiffre avant de savoir ce qu'il mesure.
""")

for id, cat, order, minutes, title, source, st, sol in D:
    body = f"---\nid: {id}\ncat: {cat}\norder: {order}\nminutes: {minutes}\ntitle: {title}\nsource: {source}\n---\n{st}\n\n<!-- solution -->\n\n{sol}\n"
    (OUT / f"{id}.md").write_text(body, encoding="utf-8")
print(len(D), "fichiers FR")
