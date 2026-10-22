# Refactoring R1-R6 and code reading L1-L5.
DRILLS = []
def drill(**kw):
    DRILLS.append(kw)

TWO_CALLS = '''def turn(phrase, market):
    action = decider.ask(phrase, context=market)   # about 350 ms
    panic = decider.ask(phrase, context=None)      # about 350 ms
    return action, panic
'''

drill(
    id="r1", cat="refactor", order=1, minutes=20,
    title={"fr": "Paralléliser deux appels lents", "en": "Run two slow calls in parallel"},
    source={"fr": "Black Monday 1987 : chaque tour appelle un modèle de décision local deux fois", "en": "Black Monday 1987: each turn calls a local decision model twice"},
    context={"fr": f"""Dans un jeu, chaque tour interroge deux fois un modèle de décision qui tourne en local, sur la même machine :

```python
{TWO_CALLS}```

Un tour prend 708 ms. Les deux appels ne dépendent pas l'un de l'autre. Ton lead te demande s'il faut les lancer en parallèle.""",
             "en": f"""In a game, each turn queries a decision model running locally, on the same machine, twice:

```python
{TWO_CALLS}```

A turn takes 708 ms. The two calls do not depend on each other. Your lead asks whether to run them in parallel."""},
    mission={"fr": "Estimer le gain, identifier la condition qui peut l'annuler, et dire comment tu le prouverais.", "en": "Estimate the gain, identify the condition that can cancel it, and say how you would prove it."},
    criteria={"fr": ["L'estimation est juste.", "Le piège du serveur qui traite une requête à la fois est vu.", "La mesure proposée est fiable."],
              "en": ["The estimate is right.", "The trap of a server handling one request at a time is spotted.", "The proposed measurement is reliable."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Si le serveur traite les deux requêtes en même temps, combien prend un tour ?", "en": "If the server handles both requests at the same time, how long does a turn take?"},
             options={"fr": ["Environ 700 ms, rien ne change", "Environ 350 ms, la durée du plus long", "Environ 175 ms", "Environ 0 ms"], "en": ["About 700 ms, nothing changes", "About 350 ms, the longer of the two", "About 175 ms", "About 0 ms"]},
             answer=1, why={"fr": "En parallèle, on attend le plus long des deux au lieu de la somme.", "en": "In parallel you wait for the longer one instead of the sum."}),
        dict(id="q2", type="choice", prompt={"fr": "Le modèle local ne traite qu'une requête à la fois. Que gagne-t-on à paralléliser côté client ?", "en": "The local model handles one request at a time. What does client-side parallelism gain?"},
             options={"fr": ["La moitié du temps", "Rien : les requêtes attendent leur tour côté serveur", "Le double du temps", "Ça dépend du GIL de Python"], "en": ["Half the time", "Nothing: the requests queue on the server", "Twice the time", "It depends on Python's GIL"]},
             answer=1, why={"fr": "Le goulot est le serveur. On garde alors le code simple, et on note pourquoi.", "en": "The bottleneck is the server. Keep the simple code then, and write down why."}),
        dict(id="q3", type="text", prompt={"fr": "Comment mesures-tu le gain de façon fiable avant de garder le changement ?", "en": "How do you measure the gain reliably before keeping the change?"},
             concepts=[
                 {"label": {"fr": "Plusieurs tours, pas un seul", "en": "Many turns, not just one"}, "any": [r"\d+ (tours|appels|mesures|fois|runs|turns|calls|times)", r"plusieurs", r"several", r"many", r"repet", r"repeat", r"boucle", r"loop"]},
                 {"label": {"fr": "La médiane, pas la moyenne", "en": "The median, not the mean"}, "any": [r"median", r"p50", r"percentile"]},
                 {"label": {"fr": "Avant et après, dans les mêmes conditions", "en": "Before and after, under the same conditions"}, "any": [r"avant.{0,20}apres", r"before.{0,20}after", r"comparer", r"compare"]},
                 {"label": {"fr": "Un chronomètre précis (`time.perf_counter`)", "en": "A precise timer (`time.perf_counter`)"}, "any": [r"perf_counter", r"timeit", r"chronom", r"timer", r"monotonic"]},
             ],
             hints={"fr": ["Pourquoi le premier appel est-il souvent plus lent que les autres ?"], "en": ["Why is the first call often slower than the others?"]},
             model={"fr": "Je chronomètre 20 tours avec `time.perf_counter`, avant puis après le changement, dans les mêmes conditions. Je compare les médianes, pas les moyennes, car le démarrage à froid du premier appel fausse la moyenne. Si le gain est nul, je garde le code simple.",
                    "en": "I time 20 turns with `time.perf_counter`, before then after the change, under the same conditions. I compare medians, not means, because the first call's cold start skews the mean. If there is no gain, I keep the simple code."}),
    ],
)

BAND = '''def band_for(action, confidence):
    if action == "sell":
        if confidence >= 0.75:
            return "execute"
        if confidence >= 0.5:
            return "hesitate"
        return "say_again"
    if action == "buy":
        if confidence >= 0.75:
            return "execute"
        if confidence >= 0.5:
            return "hesitate"
        return "say_again"
    if confidence >= 0.2:
        return "execute"
    return "say_again"
'''

drill(
    id="r2", cat="refactor", order=2, minutes=25,
    title={"fr": "Les seuils dans une table", "en": "Thresholds in a table"},
    source={"fr": "Black Monday 1987 : seuils de confiance par action", "en": "Black Monday 1987: confidence thresholds per action"},
    context={"fr": f"""Un modèle de décision renvoie une action et une confiance entre 0 et 1. Le jeu exige plus de confiance avant une action qui coûte cher si elle est fausse (vendre, acheter) qu'avant une action sans risque (demander un conseil).

```python
{BAND}```

Le product owner veut pouvoir changer un seuil sans toucher à la logique.""",
             "en": f"""A decision model returns an action and a confidence between 0 and 1. The game requires more confidence before an action that is costly if wrong (sell, buy) than before a safe one (asking for advice).

```python
{BAND}```

The product owner wants to change a threshold without touching the logic."""},
    mission={"fr": "Remplacer les `if` par une table de seuils lue par une seule fonction, sans changer le comportement.", "en": "Replace the `if`s with a threshold table read by a single function, without changing behaviour."},
    criteria={"fr": ["Le comportement est identique sur tous les cas.", "Les seuils vivent dans une table `THRESHOLDS`.", "L'intérêt pour le métier est expliqué."],
              "en": ["Behaviour is identical on every case.", "Thresholds live in a `THRESHOLDS` table.", "The benefit for the business is explained."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `THRESHOLDS` (action vers `(seuil_exécute, seuil_hésite)`), une valeur `DEFAULT` pour les autres actions, et `band_for` qui lit la table.",
                                           "en": "Write `THRESHOLDS` (action to `(execute_threshold, hesitate_threshold)`), a `DEFAULT` for other actions, and `band_for` that reads the table."},
             starter=BAND,
             tests=r'''
CASES = [("sell", 0.9, "execute"), ("sell", 0.75, "execute"), ("sell", 0.6, "hesitate"), ("sell", 0.4, "say_again"),
         ("buy", 0.8, "execute"), ("buy", 0.5, "hesitate"), ("buy", 0.1, "say_again"),
         ("ask_advice", 0.44, "execute"), ("ask_advice", 0.1, "say_again"), ("get_info", 0.2, "execute")]
def test_same_behaviour():
    for action, conf, band in CASES:
        assert band_for(action, conf) == band, f"{action} {conf}"
def test_table_exists():
    assert isinstance(THRESHOLDS, dict) and "sell" in THRESHOLDS and "buy" in THRESHOLDS
def test_table_drives_logic():
    old = THRESHOLDS["sell"]
    THRESHOLDS["sell"] = (0.9, 0.5)
    try:
        assert band_for("sell", 0.8) == "hesitate"
    finally:
        THRESHOLDS["sell"] = old
def test_new_action_by_data_only():
    THRESHOLDS["short"] = (0.95, 0.8)
    try:
        assert band_for("short", 0.9) == "hesitate"
    finally:
        del THRESHOLDS["short"]
''',
             labels={
                 "test_same_behaviour": {"fr": "Même résultat que l'ancien code sur 10 cas", "en": "Same result as the old code on 10 cases"},
                 "test_table_exists": {"fr": "Une table `THRESHOLDS` existe", "en": "A `THRESHOLDS` table exists"},
                 "test_table_drives_logic": {"fr": "Changer un seuil dans la table change le résultat", "en": "Changing a threshold in the table changes the result"},
                 "test_new_action_by_data_only": {"fr": "Une nouvelle action s'ajoute par la table seule", "en": "A new action is added through the table alone"},
             },
             hints={"fr": ["`execute, hesitate = THRESHOLDS.get(action, DEFAULT)`", "Pour les actions sans risque, les deux seuils valent 0,2."], "en": ["`execute, hesitate = THRESHOLDS.get(action, DEFAULT)`", "For safe actions, both thresholds are 0.2."]},
             model='''THRESHOLDS = {"sell": (0.75, 0.5), "buy": (0.75, 0.5)}  # (execute, hesitate)
DEFAULT = (0.2, 0.2)  # safe actions

def band_for(action, confidence):
    execute, hesitate = THRESHOLDS.get(action, DEFAULT)
    if confidence >= execute:
        return "execute"
    if confidence >= hesitate:
        return "hesitate"
    return "say_again"
''', broken_check=True),
        dict(id="q2", type="text", prompt={"fr": "Qu'est-ce que ce changement apporte au product owner ?", "en": "What does this change give the product owner?"},
             concepts=[
                 {"label": {"fr": "La règle devient une donnée lisible sans coder", "en": "The rule becomes data readable without coding"}, "any": [r"donnee", r"\bdata\b", r"lisible", r"readable", r"sans (savoir )?coder", r"without coding", r"tableau", r"table"]},
                 {"label": {"fr": "On change un seuil sans toucher à la logique, donc moins de risque", "en": "A threshold changes without touching logic, so less risk"}, "any": [r"sans toucher", r"without touching", r"(une|1) ligne", r"one line", r"risque", r"risk", r"logique", r"logic"]},
             ],
             hints={"fr": ["Qui peut relire `THRESHOLDS` sans connaître Python ?"], "en": ["Who can read `THRESHOLDS` without knowing Python?"]},
             model={"fr": "La règle métier devient une donnée lisible par quelqu'un qui ne code pas. Changer un seuil, c'est changer une ligne de la table, sans toucher à la logique : moins de risque de casser autre chose.",
                    "en": "The business rule becomes data a non-developer can read. Changing a threshold means changing one line of the table, without touching the logic: less risk of breaking something else."}),
    ],
)

UPDATE = '''def update_state(table, session_id, updates, expected_version):
    expr = "SET " + ", ".join(f"{k} = :{k}" for k in updates) + ", version = :new_version"
    values = {f":{k}": v for k, v in updates.items()}
    values[":new_version"] = expected_version + 1
    values[":expected_version"] = expected_version
    table.update_item(
        Key={"session_id": session_id},
        UpdateExpression=expr,
        ConditionExpression="version = :expected_version",
        ExpressionAttributeValues=values,
    )
'''

drill(
    id="r3", cat="refactor", order=3, minutes=30,
    title={"fr": "Extraire l'expression DynamoDB", "en": "Extract the DynamoDB expression"},
    source={"fr": "NovaMart : état partagé entre agents, avec verrouillage optimiste", "en": "NovaMart: state shared by agents, with optimistic locking"},
    context={"fr": f"""Plusieurs agents écrivent l'état d'une session client dans DynamoDB. Chaque écriture n'est acceptée que si la version n'a pas bougé depuis la lecture (verrouillage optimiste).

```python
{UPDATE}```

Pour l'instant, on ne peut tester cette fonction qu'avec une vraie table. Et l'agent de remboursement vient d'ajouter une colonne `status` : ses écritures échouent avec `ValidationException: reserved keyword: status`.""",
             "en": f"""Several agents write a customer session's state to DynamoDB. A write is accepted only if the version has not moved since the read (optimistic locking).

```python
{UPDATE}```

Right now this function can only be tested against a real table. And the refund agent just added a `status` column: its writes fail with `ValidationException: reserved keyword: status`."""},
    mission={"fr": "Extraire une fonction pure qui construit l'expression, testable sans base, et qui règle le problème des mots réservés.",
             "en": "Extract a pure function that builds the expression, testable without a database, and that fixes the reserved-word problem."},
    criteria={"fr": ["La fonction est pure : elle ne touche à aucune base.", "Chaque nom de colonne passe par un alias `#nom`.", "La cause de l'erreur est expliquée."],
              "en": ["The function is pure: it touches no database.", "Each column name goes through a `#name` alias.", "The cause of the error is explained."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `build_update(updates, expected_version)`. Elle renvoie un tuple `(expression, names, values)` : l'expression `SET` avec un alias `#colonne` pour chaque nom, le dictionnaire `ExpressionAttributeNames`, et `ExpressionAttributeValues` avec `:new_version` et `:expected_version`.",
                                           "en": "Write `build_update(updates, expected_version)`. It returns a tuple `(expression, names, values)`: the `SET` expression with a `#column` alias for each name, the `ExpressionAttributeNames` dict, and `ExpressionAttributeValues` including `:new_version` and `:expected_version`."},
             starter="def build_update(updates, expected_version):\n    ...\n",
             tests=r'''
def test_shape():
    expr, names, values = build_update({"status": "approved"}, 3)
    assert isinstance(expr, str) and isinstance(names, dict) and isinstance(values, dict)
def test_alias_for_reserved_word():
    expr, names, values = build_update({"status": "approved"}, 3)
    assert "#status = :status" in expr and names["#status"] == "status"
    assert " status =" not in expr.replace("#status", "")
def test_version_bump():
    expr, names, values = build_update({"refund_agent": "ok"}, 3)
    assert "version = :new_version" in expr
    assert values[":new_version"] == 4 and values[":expected_version"] == 3
def test_values():
    _, _, values = build_update({"a": 1, "b": "x"}, 0)
    assert values[":a"] == 1 and values[":b"] == "x"
def test_starts_with_set():
    expr, _, _ = build_update({"a": 1}, 0)
    assert expr.startswith("SET ")
def test_several_columns():
    expr, names, _ = build_update({"a": 1, "status": 2}, 0)
    assert names == {"#a": "a", "#status": "status"}
    assert expr.count("=") == 3
''',
             labels={
                 "test_shape": {"fr": "Renvoie `(expression, names, values)`", "en": "Returns `(expression, names, values)`"},
                 "test_alias_for_reserved_word": {"fr": "`status` passe par l'alias `#status`", "en": "`status` goes through the `#status` alias"},
                 "test_version_bump": {"fr": "La version passe de 3 à 4", "en": "The version goes from 3 to 4"},
                 "test_values": {"fr": "Les valeurs sont dans `:colonne`", "en": "Values sit in `:column`"},
                 "test_starts_with_set": {"fr": "L'expression commence par `SET `", "en": "The expression starts with `SET `"},
                 "test_several_columns": {"fr": "Plusieurs colonnes, chacune avec son alias", "en": "Several columns, each with its alias"},
             },
             hints={"fr": ["`names = {f\"#{k}\": k for k in updates}`", "`version` n'est pas un mot réservé : tu peux la laisser telle quelle dans l'expression."],
                    "en": ["`names = {f\"#{k}\": k for k in updates}`", "`version` is not a reserved word: you can leave it as is in the expression."]},
             model='''def build_update(updates, expected_version):
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    sets = [f"#{k} = :{k}" for k in updates] + ["version = :new_version"]
    values[":new_version"] = expected_version + 1
    values[":expected_version"] = expected_version
    return "SET " + ", ".join(sets), names, values
'''),
        dict(id="q2", type="text", prompt={"fr": "Pourquoi l'écriture de la colonne `status` échouait-elle, et qu'apporte la fonction extraite ?", "en": "Why did writing the `status` column fail, and what does the extracted function bring?"},
             concepts=[
                 {"label": {"fr": "`status` est un mot réservé de DynamoDB", "en": "`status` is a DynamoDB reserved word"}, "any": [r"(mot|mots) reserve", r"reserved (word|keyword)", r"reserve"]},
                 {"label": {"fr": "Un alias `#nom` via `ExpressionAttributeNames` le contourne", "en": "A `#name` alias via `ExpressionAttributeNames` gets around it"}, "any": [r"alias", r"expressionattributenames", r"#status", r"#nom", r"#name", r"#k"]},
                 {"label": {"fr": "Une fonction pure se teste sans base de données", "en": "A pure function is tested without a database"}, "any": [r"pure", r"sans (base|aws|table|dynamo)", r"without (a )?(database|aws|table|dynamo)", r"teste?r? (facilement|seule?|isole)", r"unit"]},
             ],
             hints={"fr": ["Lis le message d'erreur mot à mot : `reserved keyword`."], "en": ["Read the error message word by word: `reserved keyword`."]},
             model={"fr": "`status` fait partie des centaines de mots réservés de DynamoDB : on ne peut pas l'écrire tel quel dans une expression. On passe par un alias `#status` déclaré dans `ExpressionAttributeNames`. Extraire une fonction pure permet aussi de tester la construction de l'expression sans aucune base.",
                    "en": "`status` is one of DynamoDB's hundreds of reserved words: it cannot be written as is in an expression. Use a `#status` alias declared in `ExpressionAttributeNames`. Extracting a pure function also lets you test how the expression is built without any database."}),
    ],
)

CHECKS = '''def check_price(intent, prepared):
    if prepared.price_raw is None:
        return refuse("price_raw", "a known price", None)   # unknown price: never agree
    if prepared.price_raw > intent.budget_raw:
        return refuse("price_raw", intent.budget_raw, prepared.price_raw)
    return agree("price_raw", prepared.price_raw)

def check_mint(intent, prepared):
    if prepared.mint != intent.mint:                        # compared as an address
        return refuse("mint", intent.mint, prepared.mint)
    return agree("mint", prepared.mint)

def check_store(intent, prepared):
    expected = store_address(intent.store)                  # derived, never read from the answer
    if prepared.store != expected:
        return refuse("store", expected, prepared.store)
    return agree("store", expected)
'''

drill(
    id="r4", cat="refactor", order=4, minutes=15,
    title={"fr": "Savoir ne pas refactorer", "en": "Knowing when not to refactor"},
    source={"fr": "my-gecko-buyer : un agent qui paie sur Solana et refuse ce qu'il n'a pas vérifié", "en": "my-gecko-buyer: an agent that pays on Solana and refuses what it has not checked"},
    context={"fr": f"""Avant de signer un paiement, un agent compare chaque champ de la transaction préparée à ce qu'on lui a demandé. Voici trois des cinq vérifications :

```python
{CHECKS}```

En revue de code, un collègue propose : « Ces fonctions se ressemblent, remplaçons-les par une table de règles `(champ, comparateur)` et une seule boucle. »""",
             "en": f"""Before signing a payment, an agent compares each field of the prepared transaction with what it was asked for. Here are three of the five checks:

```python
{CHECKS}```

In code review, a colleague suggests: "These functions look alike, let's replace them with a table of `(field, comparator)` rules and a single loop.\""""},
    mission={"fr": "Décider s'il faut refactorer, et défendre ta décision comme dans une note d'architecture.", "en": "Decide whether to refactor, and defend your decision as in an architecture note."},
    criteria={"fr": ["La décision est tranchée.", "Les arguments portent sur le sens du code, pas sur sa forme."], "en": ["The decision is clear-cut.", "The arguments are about the code's meaning, not its shape."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Que réponds-tu ?", "en": "What do you answer?"},
             options={"fr": ["Oui, une table de règles, c'est plus court", "Non, on garde les fonctions séparées", "Oui, mais seulement pour `check_mint` et `check_store`", "On fusionne tout dans une classe"],
                      "en": ["Yes, a rule table is shorter", "No, keep the functions separate", "Yes, but only for `check_mint` and `check_store`", "Merge everything into a class"]},
             answer=1, why={"fr": "Les fonctions se ressemblent par la forme, pas par le sens : chacune a sa règle particulière.", "en": "The functions look alike in shape, not in meaning: each has its own rule."}),
        dict(id="q2", type="text", prompt={"fr": "Défends ta décision en 3 arguments.", "en": "Defend your decision with 3 arguments."},
             concepts=[
                 {"label": {"fr": "Même forme, sens différent : chaque vérification a un cas particulier", "en": "Same shape, different meaning: each check has a special case"}, "any": [r"sens", r"meaning", r"cas particulier", r"special case", r"(prix|price).{0,40}(none|absent|inconnu|missing|unknown)", r"derive", r"adresse", r"address", r"different"]},
                 {"label": {"fr": "Le code de sécurité doit se lire d'un coup d'œil", "en": "Security code must read at a glance"}, "any": [r"securite", r"security", r"lisib", r"readab", r"lire", r"read", r"coup d'oeil", r"glance", r"explicite", r"explicit"]},
                 {"label": {"fr": "Une mauvaise abstraction coûte plus cher que la duplication", "en": "A wrong abstraction costs more than duplication"}, "any": [r"(mauvaise|fausse) abstraction", r"wrong abstraction", r"duplication", r"sandi metz", r"troisieme", r"third", r"rule of three", r"regle de trois"]},
             ],
             hints={"fr": ["Où, dans une table, mettrais-tu « un prix inconnu est un refus » ?"], "en": ["Where, in a table, would you put \"an unknown price is a refusal\"?"]},
             model={"fr": "Non. 1. Les fonctions se ressemblent par la forme, pas par le sens : un prix inconnu est un refus, une adresse se compare telle quelle, une autre se recalcule. 2. C'est du code de sécurité, qui doit se lire d'un coup d'œil ; une table cacherait ces cas particuliers dans des options. 3. La duplication coûte moins cher qu'une mauvaise abstraction : on factorise à la troisième répétition du même sens.",
                    "en": "No. 1. The functions look alike in shape, not meaning: an unknown price is a refusal, one address is compared as is, another is recomputed. 2. It is security code, which must read at a glance; a table would hide these special cases in options. 3. Duplication is cheaper than the wrong abstraction: factor out at the third repetition of the same meaning."}),
    ],
)

PICK_LONG = '''def answer_from(numbered, numbers, trace):
    chosen = [numbered[n - 1] for n in numbers]
    source = chosen[0][0]
    if any(doc_id != source for doc_id, _ in chosen):
        trace.append(("decision", f"kept only paragraphs from {source}"))
        chosen = [p for p in chosen if p[0] == source]
    citations = list(dict.fromkeys(doc_id for doc_id, _ in chosen))
    trace.append(("decision", f"copied {numbers} from {citations}"))
    return {"answer": " ".join(text for _, text in chosen), "citations": citations}
'''

drill(
    id="r5", cat="refactor", order=5, minutes=25,
    title={"fr": "Extraire la sélection des paragraphes", "en": "Extract paragraph selection"},
    source={"fr": "grounded-research-agent : le modèle choisit, l'application recopie", "en": "grounded-research-agent: the model picks, the app copies"},
    context={"fr": f"""Un agent de recherche garde une seule source par réponse : si le modèle choisit des paragraphes de deux documents, on ne garde que ceux du premier. Cette méthode mêle la sélection, les citations, la réponse et la trace :

```python
{PICK_LONG}```

Les numéros ont déjà été validés en amont par `parse_selection` (entiers entre 1 et `count`, sans doublon).""",
             "en": f"""A research agent keeps a single source per answer: if the model picks paragraphs from two documents, only those of the first are kept. This method mixes selection, citations, the answer and the trace:

```python
{PICK_LONG}```

The numbers were already validated upstream by `parse_selection` (integers between 1 and `count`, no duplicates)."""},
    mission={"fr": "Extraire la règle « une seule source » dans une fonction pure, et dire où vit chaque garantie.", "en": "Extract the \"single source\" rule into a pure function, and say where each guarantee lives."},
    criteria={"fr": ["La fonction est pure et passe les tests.", "La place de la validation est justifiée."], "en": ["The function is pure and passes the tests.", "Where validation lives is justified."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `pick_paragraphs(numbered, numbers)` : elle renvoie les paragraphes choisis, en ne gardant que ceux du document du premier paragraphe choisi.",
                                           "en": "Write `pick_paragraphs(numbered, numbers)`: it returns the chosen paragraphs, keeping only those from the first chosen paragraph's document."},
             starter="def pick_paragraphs(numbered, numbers):\n    ...\n",
             tests=r'''
N = [("rag", "A"), ("rag", "B"), ("agents", "C"), ("rag", "D")]
def test_single_source():
    assert pick_paragraphs(N, [1, 2]) == [("rag", "A"), ("rag", "B")]
def test_drops_other_source():
    assert pick_paragraphs(N, [1, 3, 4]) == [("rag", "A"), ("rag", "D")]
def test_first_choice_decides():
    assert pick_paragraphs(N, [3, 1]) == [("agents", "C")]
def test_order_kept():
    assert pick_paragraphs(N, [4, 1]) == [("rag", "D"), ("rag", "A")]
def test_pure():
    before = list(N)
    pick_paragraphs(N, [1, 3])
    assert N == before
''',
             labels={
                 "test_single_source": {"fr": "Une seule source : tout est gardé", "en": "One source: everything is kept"},
                 "test_drops_other_source": {"fr": "Les paragraphes d'un autre document sont retirés", "en": "Paragraphs from another document are dropped"},
                 "test_first_choice_decides": {"fr": "Le premier choix décide de la source", "en": "The first choice decides the source"},
                 "test_order_kept": {"fr": "L'ordre du modèle est gardé", "en": "The model's order is kept"},
                 "test_pure": {"fr": "La liste d'entrée n'est pas modifiée", "en": "The input list is not modified"},
             },
             hints={"fr": ["La source, c'est `numbered[numbers[0] - 1][0]`."], "en": ["The source is `numbered[numbers[0] - 1][0]`."]},
             model='''def pick_paragraphs(numbered, numbers):
    chosen = [numbered[n - 1] for n in numbers]
    source = chosen[0][0]
    return [p for p in chosen if p[0] == source]
'''),
        dict(id="q2", type="text", prompt={"fr": "`pick_paragraphs` ne revérifie pas les numéros. Pourquoi est-ce acceptable ?", "en": "`pick_paragraphs` does not check the numbers again. Why is that acceptable?"},
             concepts=[
                 {"label": {"fr": "La validation est faite une fois, à la frontière (`parse_selection`)", "en": "Validation happens once, at the boundary (`parse_selection`)"}, "any": [r"frontiere", r"boundary", r"parse_selection", r"en amont", r"upstream", r"(deja|already) (valide|verifie|validated|checked)"]},
                 {"label": {"fr": "Le reste du code fait confiance à un type déjà sûr", "en": "The rest of the code trusts an already safe type"}, "any": [r"confiance", r"trust", r"(type|donnee) (sur|sure|fiable)", r"safe (type|data)", r"parse,? don'?t validate", r"partout", r"everywhere", r"une (seule )?fois", r"\bonce\b"]},
             ],
             hints={"fr": ["Où les numéros entrent-ils dans le programme ?"], "en": ["Where do the numbers enter the program?"]},
             model={"fr": "Parce que la validation est faite une fois, à la frontière, par `parse_selection`. Ensuite, les numéros sont un type sûr et le reste du code peut leur faire confiance. Revérifier partout disperserait la règle et la rendrait plus facile à oublier.",
                    "en": "Because validation happens once, at the boundary, in `parse_selection`. After that, the numbers are a safe type and the rest of the code can trust them. Checking again everywhere would scatter the rule and make it easier to forget."}),
    ],
)

AI_FILE = '''import json, os

def get_user(db, user_id):
    data = db.query(f"SELECT * FROM users WHERE id = {user_id}")
    db.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (user_id,))
    return data

def format_name(u):
    return u["first"] + " " + u["last"]

def old_format_name(u):
    return u["first"].title() + " " + u["last"].title()

def load_settings():
    try:
        return json.load(open(os.environ["SETTINGS"]))
    except:
        return {}
'''

drill(
    id="r6", cat="refactor", order=6, minutes=20,
    title={"fr": "Relire un fichier écrit par l'IA", "en": "Review a file the AI wrote"},
    source={"fr": "Réflexe à prendre sur tous tes repos", "en": "A reflex for every one of your repos"},
    context={"fr": f"""Un assistant IA a écrit ce fichier pour une petite API. Il marche en démo. Tu dois le relire avant de l'accepter.

```python
{AI_FILE}```""",
             "en": f"""An AI assistant wrote this file for a small API. It works in the demo. You must review it before accepting it.

```python
{AI_FILE}```"""},
    mission={"fr": "Trouver ce qui ne va pas, puis dire dans quel ordre tu relis un fichier écrit par l'IA.", "en": "Find what is wrong, then say in what order you review a file the AI wrote."},
    criteria={"fr": ["Les quatre problèmes sont trouvés.", "La méthode commence par les outils automatiques."], "en": ["All four problems are found.", "The method starts with automated tools."]},
    questions=[
        dict(id="q1", type="text", prompt={"fr": "Liste les problèmes de ce fichier, du plus grave au moins grave.", "en": "List the problems in this file, most serious first."},
             concepts=[
                 {"label": {"fr": "Injection SQL : la requête est construite avec une f-string", "en": "SQL injection: the query is built with an f-string"}, "any": [r"injection", r"f-?string", r"sql", r"parametr"]},
                 {"label": {"fr": "`get_user` écrit en base : le nom ment", "en": "`get_user` writes to the database: the name lies"}, "any": [r"(nom|name).{0,30}(ment|lie|trompe|mislead)", r"get_user.{0,60}(ecrit|update|write|modifie|effet)", r"effet de bord", r"side effect"]},
                 {"label": {"fr": "`old_format_name` est du code mort", "en": "`old_format_name` is dead code"}, "any": [r"code mort", r"dead code", r"old_format_name", r"inutilise", r"unused"]},
                 {"label": {"fr": "Le `except:` nu avale toutes les erreurs", "en": "The bare `except:` swallows every error"}, "any": [r"except", r"avale", r"swallow", r"silenc", r"masque", r"hide"]},
             ],
             hints={"fr": ["Que se passe-t-il si `user_id` vaut `\"1 OR 1=1\"` ?", "Que fait `get_user`, à part lire ?"], "en": ["What happens if `user_id` is `\"1 OR 1=1\"`?", "What does `get_user` do besides reading?"]},
             model={"fr": "1. Injection SQL : la première requête est construite avec une f-string ; il faut une requête paramétrée comme la seconde. 2. `get_user` écrit en base (`last_seen`) : son nom ment, et lire devient un effet de bord. 3. Le `except:` nu avale toutes les erreurs, même un fichier de réglages corrompu, et renvoie `{}` sans rien dire. 4. `old_format_name` est du code mort. Bonus : le fichier ouvert n'est jamais fermé.",
                    "en": "1. SQL injection: the first query is built with an f-string; it needs a parameterised query like the second. 2. `get_user` writes to the database (`last_seen`): its name lies, and reading becomes a side effect. 3. The bare `except:` swallows every error, even a corrupt settings file, and returns `{}` silently. 4. `old_format_name` is dead code. Bonus: the opened file is never closed."}),
        dict(id="q2", type="choice", prompt={"fr": "Par quoi commences-tu la relecture d'un fichier écrit par l'IA ?", "en": "What do you start with when reviewing a file the AI wrote?"},
             options={"fr": ["Lire chaque ligne à voix haute", "Lancer les outils automatiques (`ruff`, `mypy`) et les tests", "Demander à l'IA de se relire", "Renommer les variables"], "en": ["Read every line out loud", "Run the automated tools (`ruff`, `mypy`) and the tests", "Ask the AI to review itself", "Rename the variables"]},
             answer=1, why={"fr": "L'outil trouve en une seconde ce qu'il sait trouver ; ton attention va ensuite au sens, aux noms et aux effets de bord.", "en": "The tool finds in a second what it can find; your attention then goes to meaning, names and side effects."}),
    ],
)

LOCK = '''def update_state(session_id, updates, expected_version, max_retries=3):
    for attempt in range(max_retries):
        try:
            write_if_version(session_id, updates, expected_version)   # fails if version moved
            return read_state(session_id)
        except VersionConflict:
            if attempt == max_retries - 1:
                raise RuntimeError("too many concurrent writes")
            expected_version = read_state(session_id)["version"]
            time.sleep(0.1 * (attempt + 1))
'''

drill(
    id="l1", cat="read", order=1, minutes=10,
    title={"fr": "Le verrouillage optimiste sous pression", "en": "Optimistic locking under pressure"},
    source={"fr": "NovaMart : état partagé entre quatre agents", "en": "NovaMart: state shared by four agents"},
    context={"fr": f"""Quatre agents écrivent dans le même état de session. Chacun n'écrit que ses propres colonnes (`inventory_agent`, `refund_agent`…).

```python
{LOCK}```

Deux agents appellent `update_state` au même moment, avec la même `expected_version`.""",
             "en": f"""Four agents write into the same session state. Each one writes only its own columns (`inventory_agent`, `refund_agent`…).

```python
{LOCK}```

Two agents call `update_state` at the same moment, with the same `expected_version`."""},
    mission={"fr": "Lire le code sans l'exécuter et prédire son comportement en cas de conflit.", "en": "Read the code without running it and predict its behaviour under conflict."},
    criteria={"fr": ["Les trois prédictions sont justes.", "Le vocabulaire est précis."], "en": ["All three predictions are right.", "The vocabulary is precise."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Que se passe-t-il ?", "en": "What happens?"},
             options={"fr": ["Les deux écritures réussissent", "La première arrivée réussit ; l'autre reçoit un conflit, relit la version, attend, réessaie", "Les deux échouent", "La seconde écrase la première"],
                      "en": ["Both writes succeed", "The first one in wins; the other gets a conflict, rereads the version, waits, retries", "Both fail", "The second overwrites the first"]},
             answer=1, why={"fr": "C'est le principe du compare-and-swap : l'écriture n'est acceptée que si la version est celle attendue.", "en": "That is compare-and-swap: a write is accepted only if the version is the expected one."}),
        dict(id="q2", type="choice", prompt={"fr": "Au réessai, le code renvoie les mêmes `updates`. Dans quel cas perd-on une donnée ?", "en": "On retry, the code sends the same `updates`. In which case is data lost?"},
             options={"fr": ["Jamais", "Quand chaque agent écrit ses propres colonnes", "Quand la valeur écrite est calculée à partir de l'état lu, comme un compteur", "Quand le réseau est lent"],
                      "en": ["Never", "When each agent writes its own columns", "When the value written is computed from the state read, like a counter", "When the network is slow"]},
             answer=2, why={"fr": "Le réessai écrase alors avec un calcul fait sur une lecture périmée : c'est une mise à jour perdue. Il faut recalculer `updates` après la relecture.", "en": "The retry then overwrites with a computation based on a stale read: a lost update. Recompute `updates` after rereading."}),
        dict(id="q3", type="text", prompt={"fr": "Après le troisième échec, que voit l'utilisateur ? Que réponds-tu en entretien si tu n'as pas le reste du code ?", "en": "After the third failure, what does the user see? What do you answer in an interview without the rest of the code?"},
             concepts=[
                 {"label": {"fr": "Une `RuntimeError` est levée", "en": "A `RuntimeError` is raised"}, "any": [r"runtimeerror", r"exception", r"erreur est levee", r"error is raised", r"raise"]},
                 {"label": {"fr": "Ça dépend de qui l'attrape : je vérifierais l'appelant", "en": "It depends on who catches it: I would check the caller"}, "any": [r"depend", r"qui (l')?attrape", r"who catches", r"appelant", r"caller", r"je (verifierais|regarderais)", r"i would (check|look)"]},
             ],
             hints={"fr": ["Que fait la dernière ligne du `except` au dernier essai ?"], "en": ["What does the `except` block do on the last attempt?"]},
             model={"fr": "Le code lève une `RuntimeError`. Ce que voit l'utilisateur dépend de qui l'attrape : l'outil de l'agent, l'orchestrateur ou rien. En entretien : « Je ne sais pas d'ici, je vérifierais l'appelant. » C'est une bonne réponse.",
                    "en": "The code raises a `RuntimeError`. What the user sees depends on who catches it: the agent's tool, the orchestrator or nothing. In an interview: \"I can't tell from here, I would check the caller.\" That is a good answer."}),
    ],
)

drill(
    id="l2", cat="read", order=2, minutes=12,
    title={"fr": "Le pin et la vérification", "en": "The pin and the check"},
    source={"fr": "my-gecko-buyer : un agent qui paie et refuse ce qu'il n'a pas vérifié", "en": "my-gecko-buyer: an agent that pays and refuses what it has not checked"},
    context={"fr": f"""Avant de signer, un agent d'achat compare la transaction préparée par un service tiers à la demande initiale, enregistrée avant (le « pin »). Les montants sont des entiers dans la plus petite unité du jeton (`price_raw` : 1 USDC = 1 000 000).

```python
{CHECKS}```""",
             "en": f"""Before signing, a buying agent compares the transaction prepared by a third-party service with the original request, saved beforehand (the "pin"). Amounts are integers in the token's smallest unit (`price_raw`: 1 USDC = 1,000,000).

```python
{CHECKS}```"""},
    mission={"fr": "Expliquer deux choix de sécurité, puis écrire la conversion de montant qui ne trompe pas.", "en": "Explain two security choices, then write the amount conversion that does not mislead."},
    criteria={"fr": ["Les deux principes sont nommés.", "La conversion passe tous les tests, sans `float`."], "en": ["Both principles are named.", "The conversion passes every test, without `float`."]},
    questions=[
        dict(id="q1", type="text", prompt={"fr": "Pourquoi un prix inconnu (`None`) est-il un refus plutôt qu'un accord ?", "en": "Why is an unknown price (`None`) a refusal rather than an agreement?"},
             concepts=[
                 {"label": {"fr": "En cas de doute, on refuse (fail closed)", "en": "When in doubt, refuse (fail closed)"}, "any": [r"fail.?closed", r"(en cas de |dans le )doute", r"in doubt", r"par defaut.{0,20}(refus|non)", r"by default.{0,20}(refus|no)"]},
                 {"label": {"fr": "Un prix inconnu n'est pas un prix sous le budget", "en": "An unknown price is not a price under budget"}, "any": [r"inconnu", r"unknown", r"(pas|not).{0,20}(sous|under).{0,10}budget", r"ne prouve", r"doesn'?t prove", r"argent", r"money"]},
             ],
             hints={"fr": ["Que coûte une erreur dans chaque sens ?"], "en": ["What does an error cost in each direction?"]},
             model={"fr": "Un prix inconnu n'est pas un prix sous le budget : rien ne prouve que l'achat est sûr. Un système qui déplace de l'argent refuse en cas de doute (fail closed) : un refus à tort coûte un nouvel essai, un accord à tort coûte de l'argent.",
                    "en": "An unknown price is not a price under budget: nothing proves the purchase is safe. A system that moves money refuses when in doubt (fail closed): a wrong refusal costs a retry, a wrong agreement costs money."}),
        dict(id="q2", type="text", prompt={"fr": "Pourquoi `check_store` recalcule-t-il l'adresse au lieu de la lire dans la réponse du service ?", "en": "Why does `check_store` recompute the address instead of reading it from the service's answer?"},
             concepts=[
                 {"label": {"fr": "Ce qu'on vérifie ne doit jamais fournir la réponse attendue", "en": "What is being checked must never supply the expected answer"}, "any": [r"(fournir|donner) (la|sa) (propre )?reponse", r"supply (the|its)", r"se valider (elle-meme|lui-meme|seul)", r"validate itself", r"juge et partie", r"(meme|same) source"]},
                 {"label": {"fr": "Une réponse falsifiée se validerait elle-même", "en": "A forged answer would validate itself"}, "any": [r"falsifi", r"forg", r"tamper", r"modifi", r"attaqu", r"malveill", r"malicious", r"pirat"]},
             ],
             hints={"fr": ["Si l'adresse attendue venait de la réponse, que vérifierait-on vraiment ?"], "en": ["If the expected address came from the answer, what would we really be checking?"]},
             model={"fr": "Parce que ce qu'on vérifie ne doit jamais fournir la réponse attendue. Si l'adresse venait de la réponse du service, une réponse falsifiée se validerait elle-même. On recalcule donc l'adresse à partir du nom demandé.",
                    "en": "Because the thing being checked must never supply the expected answer. If the address came from the service's answer, a forged answer would validate itself. So the address is recomputed from the requested name."}),
        dict(id="q3", type="code", prompt={"fr": "Écris `to_raw(amount, decimals)`. `amount` est une chaîne comme `\"2.01\"`, `decimals` le nombre de décimales du jeton. Renvoie l'entier en plus petite unité, exact. Lève une `TypeError` si `amount` n'est pas une `str`, et une `ValueError` si le montant a plus de décimales que le jeton.",
                                           "en": "Write `to_raw(amount, decimals)`. `amount` is a string such as `\"2.01\"`, `decimals` the token's number of decimals. Return the exact integer in the smallest unit. Raise a `TypeError` if `amount` is not a `str`, and a `ValueError` if the amount has more decimals than the token."},
             starter="from decimal import Decimal\n\ndef to_raw(amount, decimals):\n    ...\n",
             tests=r'''
def test_simple():
    assert to_raw("2", 6) == 2_000_000
def test_float_trap():
    assert to_raw("2.01", 6) == 2_010_000
def test_small():
    assert to_raw("0.000001", 6) == 1
def test_is_int():
    assert type(to_raw("1.5", 6)) is int
def test_float_refused():
    try:
        to_raw(2.01, 6)
    except TypeError:
        return
    assert False, "a float must raise TypeError"
def test_too_precise_refused():
    try:
        to_raw("0.0000001", 6)
    except ValueError:
        return
    assert False, "7 decimals on a 6-decimal token must raise ValueError"
''',
             labels={
                 "test_simple": {"fr": "`\"2\"` donne 2 000 000", "en": "`\"2\"` gives 2,000,000"},
                 "test_float_trap": {"fr": "`\"2.01\"` donne 2 010 000, pas 2 009 999", "en": "`\"2.01\"` gives 2,010,000, not 2,009,999"},
                 "test_small": {"fr": "La plus petite unité donne 1", "en": "The smallest unit gives 1"},
                 "test_is_int": {"fr": "Le résultat est un `int`", "en": "The result is an `int`"},
                 "test_float_refused": {"fr": "Un `float` en entrée est refusé", "en": "A `float` input is refused"},
                 "test_too_precise_refused": {"fr": "Trop de décimales est refusé", "en": "Too many decimals is refused"},
             },
             hints={"fr": ["`int(2.01 * 10**6)` donne 2009999. Pourquoi ?", "`Decimal(\"2.01\") * 10**decimals` est exact.", "Si `value != value.to_integral_value()`, il reste des décimales en trop."],
                    "en": ["`int(2.01 * 10**6)` gives 2009999. Why?", "`Decimal(\"2.01\") * 10**decimals` is exact.", "If `value != value.to_integral_value()`, there are decimals left over."]},
             model='''from decimal import Decimal

def to_raw(amount, decimals):
    if not isinstance(amount, str):
        raise TypeError("amount must be a string, never a float")
    value = Decimal(amount) * (10 ** decimals)
    if value != value.to_integral_value():
        raise ValueError("more decimals than the token allows")
    return int(value)
'''),
    ],
)

SCOPE = '''def check_scope(bound_customer, requested_customer):
    """Called by every database tool. Returns None if access is allowed, else a refusal."""
    if bound_customer and requested_customer != bound_customer:
        return {"access_denied": True}
    return None
'''

drill(
    id="l3", cat="read", order=3, minutes=12,
    title={"fr": "Isolation des clients", "en": "Customer isolation"},
    source={"fr": "NovaMart : un agent ne doit voir que les données du client de la session", "en": "NovaMart: an agent must only see the session customer's data"},
    context={"fr": f"""Dans un support client multi-agents, l'orchestrateur lie chaque session à un client. Les outils de base de données vérifient qu'on ne demande pas les données d'un autre client :

```python
{SCOPE}```""",
             "en": f"""In multi-agent customer support, the orchestrator binds each session to a customer. The database tools check that nobody asks for another customer's data:

```python
{SCOPE}```"""},
    mission={"fr": "Trouver le cas dangereux, le nommer, et réécrire la règle.", "en": "Find the dangerous case, name it, and rewrite the rule."},
    criteria={"fr": ["Le cas sans client lié est identifié.", "Le principe est nommé.", "La nouvelle règle refuse par défaut."], "en": ["The no-customer-bound case is identified.", "The principle is named.", "The new rule refuses by default."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Que renvoie `check_scope(None, \"C42\")` ?", "en": "What does `check_scope(None, \"C42\")` return?"},
             options={"fr": ["`{\"access_denied\": True}`", "`None` : l'accès est autorisé", "Une `TypeError`"], "en": ["`{\"access_denied\": True}`", "`None`: access is allowed", "A `TypeError`"]},
             answer=1, why={"fr": "`None` est faux en Python : la condition saute, tout client est accessible.", "en": "`None` is falsy in Python: the condition is skipped, any customer is reachable."}),
        dict(id="q2", type="text", prompt={"fr": "Pourquoi est-ce un risque en production, même si aujourd'hui l'orchestrateur lie toujours un client ?", "en": "Why is this a production risk, even if today the orchestrator always binds a customer?"},
             concepts=[
                 {"label": {"fr": "C'est du fail open : sans information, l'accès est ouvert", "en": "It fails open: without information, access is open"}, "any": [r"fails? ?.?open", r"ouvert par defaut", r"open by default", r"autorise par defaut", r"allowed by default"]},
                 {"label": {"fr": "Une future route qui oublie de lier le client exposerait tout le monde", "en": "A future route that forgets to bind would expose everyone"}, "any": [r"oubli", r"forget", r"futur", r"future", r"nouvelle route", r"new route", r"tous les clients", r"every customer", r"all customers"]},
             ],
             hints={"fr": ["Que se passe-t-il le jour où quelqu'un ajoute un nouvel agent et oublie une ligne ?"], "en": ["What happens the day someone adds a new agent and forgets one line?"]},
             model={"fr": "La règle échoue en position ouverte (fail open) : sans client lié, tout est autorisé. Le jour où une nouvelle route oublie de lier le client, tous les clients sont exposés, sans aucune erreur. La sécurité ne doit pas dépendre de la discipline de chaque appelant.",
                    "en": "The rule fails open: with no customer bound, everything is allowed. The day a new route forgets to bind the customer, every customer is exposed, with no error. Security must not depend on every caller's discipline."}),
        dict(id="q3", type="code", prompt={"fr": "Réécris `check_scope` pour qu'elle refuse par défaut : l'accès n'est autorisé que si un client est lié et que c'est celui demandé.", "en": "Rewrite `check_scope` so it refuses by default: access is allowed only if a customer is bound and it is the one requested."},
             starter=SCOPE,
             tests=r'''
def test_same_customer_allowed():
    assert check_scope("C42", "C42") is None
def test_other_customer_denied():
    assert check_scope("C42", "C7") == {"access_denied": True}
def test_no_customer_denied():
    assert check_scope(None, "C42") == {"access_denied": True}
def test_empty_customer_denied():
    assert check_scope("", "C42") == {"access_denied": True}
''',
             labels={
                 "test_same_customer_allowed": {"fr": "Le bon client est autorisé", "en": "The right customer is allowed"},
                 "test_other_customer_denied": {"fr": "Un autre client est refusé", "en": "Another customer is denied"},
                 "test_no_customer_denied": {"fr": "Sans client lié, c'est refusé", "en": "With no customer bound, it is denied"},
                 "test_empty_customer_denied": {"fr": "Une chaîne vide est refusée", "en": "An empty string is denied"},
             },
             hints={"fr": ["Écris d'abord la seule condition qui autorise, puis refuse tout le reste."], "en": ["Write the only condition that allows first, then refuse everything else."]},
             model='''def check_scope(bound_customer, requested_customer):
    """Called by every database tool. Returns None if access is allowed, else a refusal."""
    if bound_customer and requested_customer == bound_customer:
        return None
    return {"access_denied": True}
''', broken_check=True),
    ],
)

APP = '''# api/routes/users.py
@router.post("/users", response_model=UserPublic)
def create_user(user_in: UserCreate, session: SessionDep, current: AdminDep):
    if crud.get_user_by_email(session, user_in.email):
        raise HTTPException(400, "Email already registered")
    return crud.create_user(session, user_in)

# api/deps.py
def get_current_user(session: SessionDep, token: TokenDep) -> User:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return session.get(User, payload["sub"])

def get_current_admin(current: CurrentUser) -> User:
    if not current.is_superuser:
        raise HTTPException(403, "Not enough privileges")
    return current

AdminDep = Annotated[User, Depends(get_current_admin)]

# models.py
class UserCreate(SQLModel):
    email: EmailStr
    password: str = Field(min_length=8)

# crud.py
def create_user(session, user_in):
    user = User.model_validate(user_in, update={"hashed_password": hash_password(user_in.password)})
    session.add(user)
    session.commit()
    return user
'''

drill(
    id="l4", cat="read", order=4, minutes=15,
    title={"fr": "Suivre une requête dans un repo inconnu", "en": "Follow a request through an unknown repo"},
    source={"fr": "Inspiré de full-stack-fastapi-template (FastAPI)", "en": "Inspired by full-stack-fastapi-template (FastAPI)"},
    context={"fr": f"""Tu découvres une API FastAPI. Voici les extraits utiles de quatre fichiers. FastAPI exécute les dépendances (`Depends`) avant le corps de la route, et valide le corps JSON avec le modèle annoté (`UserCreate`).

```python
{APP}```""",
             "en": f"""You are discovering a FastAPI API. Here are the useful parts of four files. FastAPI runs the dependencies (`Depends`) before the route body, and validates the JSON body with the annotated model (`UserCreate`).

```python
{APP}```"""},
    mission={"fr": "Suivre `POST /users` de la requête jusqu'à la ligne en base, sans exécuter le code.", "en": "Follow `POST /users` from the request down to the database row, without running the code."},
    criteria={"fr": ["L'ordre des étapes est juste.", "Chaque garde-fou est situé dans le bon fichier."], "en": ["The order of steps is right.", "Each safeguard is placed in the right file."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Dans quel ordre la requête traverse-t-elle le code ?", "en": "In what order does the request go through the code?"},
             options={"fr": ["`crud.create_user` → `UserCreate` → `get_current_admin` → `create_user`", "Validation `UserCreate` et dépendances (`get_current_user` puis `get_current_admin`) → corps de `create_user` → `crud.create_user`", "`create_user` → `get_current_admin` → `UserCreate` → base", "`get_current_user` → `crud.create_user` → `UserCreate`"],
                      "en": ["`crud.create_user` → `UserCreate` → `get_current_admin` → `create_user`", "`UserCreate` validation and dependencies (`get_current_user` then `get_current_admin`) → `create_user` body → `crud.create_user`", "`create_user` → `get_current_admin` → `UserCreate` → database", "`get_current_user` → `crud.create_user` → `UserCreate`"]},
             answer=1, why={"fr": "FastAPI valide le corps et résout les dépendances avant d'appeler la route ; la route appelle ensuite le CRUD qui écrit.", "en": "FastAPI validates the body and resolves dependencies before calling the route; the route then calls the CRUD that writes."}),
        dict(id="q2", type="choice", prompt={"fr": "Un mot de passe de 5 caractères : où est-il refusé, et avec quel code ?", "en": "A 5-character password: where is it refused, and with which code?"},
             options={"fr": ["Dans `crud.create_user`, code 500", "Par la validation de `UserCreate`, code 422, avant la route", "Dans `get_current_user`, code 401", "Il n'est pas refusé"], "en": ["In `crud.create_user`, code 500", "By `UserCreate` validation, code 422, before the route", "In `get_current_user`, code 401", "It is not refused"]},
             answer=1, why={"fr": "`Field(min_length=8)` est vérifié à la frontière : la route n'est jamais appelée.", "en": "`Field(min_length=8)` is checked at the boundary: the route is never called."}),
        dict(id="q3", type="choice", prompt={"fr": "Un utilisateur connecté mais pas administrateur appelle la route. Que reçoit-il ?", "en": "A logged-in user who is not an admin calls the route. What do they get?"},
             options={"fr": ["201, l'utilisateur est créé", "403 « Not enough privileges »", "400 « Email already registered »", "422"], "en": ["201, the user is created", "403 \"Not enough privileges\"", "400 \"Email already registered\"", "422"]},
             answer=1, why={"fr": "`AdminDep` appelle `get_current_admin`, qui lève 403 avant le corps de la route.", "en": "`AdminDep` calls `get_current_admin`, which raises 403 before the route body."}),
        dict(id="q4", type="text", prompt={"fr": "Où le mot de passe est-il haché, et pourquoi pas dans la route ?", "en": "Where is the password hashed, and why not in the route?"},
             concepts=[
                 {"label": {"fr": "Dans `crud.create_user`", "en": "In `crud.create_user`"}, "any": [r"crud", r"create_user", r"couche (de )?donnees", r"data layer"]},
                 {"label": {"fr": "Une seule place pour la règle : toute création passe par là", "en": "One place for the rule: every creation goes through it"}, "any": [r"(une|un) seul", r"single", r"(un|une) (seul )?(endroit|place)", r"one place", r"toute(s)? (les )?(creation|route)", r"every (creation|route)", r"reutilis", r"reus", r"oubli", r"forget"]},
             ],
             hints={"fr": ["Combien de routes pourraient créer un utilisateur un jour ?"], "en": ["How many routes could create a user one day?"]},
             model={"fr": "Dans `crud.create_user`. Toute création d'utilisateur passe par cette fonction : la règle « on ne stocke jamais un mot de passe en clair » vit à un seul endroit, et une nouvelle route ne peut pas l'oublier.",
                    "en": "In `crud.create_user`. Every user creation goes through it: the rule \"never store a plain-text password\" lives in one place, and a new route cannot forget it."}),
    ],
)

drill(
    id="l5", cat="read", order=5, minutes=8,
    title={"fr": "Prédire la sortie, en flash", "en": "Predict the output, fast"},
    source={"fr": "Les bases de Python qu'on demande en entretien", "en": "The Python basics interviews ask about"},
    context={"fr": "Six extraits courts. Pour chacun, prédis la sortie sans exécuter, en moins d'une minute.", "en": "Six short snippets. For each, predict the output without running it, in under a minute."},
    mission={"fr": "Prédire juste et savoir nommer le mécanisme.", "en": "Predict right and be able to name the mechanism."},
    criteria={"fr": ["Au moins 5 bonnes réponses sur 6."], "en": ["At least 5 right answers out of 6."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "```python\nb = [1, 2]\na = b\na.append(3)\nprint(b)\n```", "en": "```python\nb = [1, 2]\na = b\na.append(3)\nprint(b)\n```"},
             options={"fr": ["`[1, 2]`", "`[1, 2, 3]`", "Une erreur"], "en": ["`[1, 2]`", "`[1, 2, 3]`", "An error"]},
             answer=1, why={"fr": "`a = b` crée un second nom pour le même objet ; `b[:]` aurait créé une copie.", "en": "`a = b` creates a second name for the same object; `b[:]` would have made a copy."}),
        dict(id="q2", type="choice", prompt={"fr": "```python\nx = [1, 2]\ny = [1, 2]\nprint(x == y, x is y)\n```", "en": "```python\nx = [1, 2]\ny = [1, 2]\nprint(x == y, x is y)\n```"},
             options={"fr": ["`True True`", "`True False`", "`False False`"], "en": ["`True True`", "`True False`", "`False False`"]},
             answer=1, why={"fr": "`==` compare les valeurs, `is` l'identité : deux listes égales mais distinctes.", "en": "`==` compares values, `is` compares identity: two equal but distinct lists."}),
        dict(id="q3", type="choice", prompt={"fr": "```python\ng = (n * 2 for n in range(3))\nprint(sum(g), sum(g))\n```", "en": "```python\ng = (n * 2 for n in range(3))\nprint(sum(g), sum(g))\n```"},
             options={"fr": ["`6 6`", "`6 0`", "Une erreur"], "en": ["`6 6`", "`6 0`", "An error"]},
             answer=1, why={"fr": "Un générateur ne se parcourt qu'une fois : il est vide au second passage.", "en": "A generator can be walked only once: it is empty on the second pass."}),
        dict(id="q4", type="choice", prompt={"fr": "```python\ndef f():\n    try:\n        return \"try\"\n    finally:\n        print(\"finally\")\nprint(f())\n```", "en": "```python\ndef f():\n    try:\n        return \"try\"\n    finally:\n        print(\"finally\")\nprint(f())\n```"},
             options={"fr": ["`try` seulement", "`finally` puis `try`", "`try` puis `finally`"], "en": ["`try` only", "`finally` then `try`", "`try` then `finally`"]},
             answer=1, why={"fr": "`finally` s'exécute avant que la fonction rende la main, donc avant le `print` de l'appelant.", "en": "`finally` runs before the function returns, so before the caller's `print`."}),
        dict(id="q5", type="choice", prompt={"fr": "```python\nd = {\"a\": 1}\nprint(d.get(\"b\", 0), d.get(\"b\"))\n```", "en": "```python\nd = {\"a\": 1}\nprint(d.get(\"b\", 0), d.get(\"b\"))\n```"},
             options={"fr": ["`0 None`", "`0 0`", "Une `KeyError`"], "en": ["`0 None`", "`0 0`", "A `KeyError`"]},
             answer=0, why={"fr": "`get` ne lève jamais d'erreur : il renvoie la valeur par défaut donnée, sinon `None`.", "en": "`get` never raises: it returns the given default, otherwise `None`."}),
        dict(id="q6", type="choice", prompt={"fr": "```python\nwords = [\"kiwi\", \"fig\", \"banana\"]\nprint(sorted(words, key=len)[0])\n```", "en": "```python\nwords = [\"kiwi\", \"fig\", \"banana\"]\nprint(sorted(words, key=len)[0])\n```"},
             options={"fr": ["`banana`", "`fig`", "`kiwi`"], "en": ["`banana`", "`fig`", "`kiwi`"]},
             answer=1, why={"fr": "`key=len` trie par longueur : `fig` (3 lettres) passe en premier.", "en": "`key=len` sorts by length: `fig` (3 letters) comes first."}),
    ],
)
