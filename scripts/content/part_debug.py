# Debugging drills D1-D7: assessment-center briefs, questions, tests, hints.
# Text in both languages; code and tests shared. Concepts are regexes run on
# lower-case, accent-free answers (French or English both accepted).

DRILLS = []

def drill(**kw):
    DRILLS.append(kw)

SCAN_RULE = r'''ASSIGNED = re.compile(
    r"(?i)\b(private_key|secret_key|seed_phrase|mnemonic)\b\s*[:=]\s*[\"']?[^\s\"']{16,}"
)'''

drill(
    id="d1", cat="debug", order=1, minutes=15,
    title={"fr": "Le préfixe qui aveugle le scanner", "en": "The prefix that blinds the scanner"},
    source={"fr": "my-gecko-buyer, scripts/scan_secrets.py (bug réel, corrigé le 22 oct. 2026)",
            "en": "my-gecko-buyer, scripts/scan_secrets.py (real bug, fixed on 22 Oct 2026)"},
    context={
        "fr": f"""Une équipe protège ses dépôts avec un hook *pre-commit* : avant chaque commit, un script cherche des secrets dans les fichiers et refuse le commit s'il en trouve. Une de ses règles repère une variable au nom de secret suivie d'une longue valeur :

```python
import re

{SCAN_RULE}
```

Un audit montre que cette ligne d'un fichier `.env` passe sans alerte :

```
SOLANA_PRIVATE_KEY=4kX9vQ2mL7pR8sT1wY3zA6bC5dE0fG
```""",
        "en": f"""A team protects its repositories with a *pre-commit* hook: before each commit, a script looks for secrets in the files and refuses the commit if it finds one. One of its rules spots a variable with a secret-looking name followed by a long value:

```python
import re

{SCAN_RULE}
```

An audit shows this line from a `.env` file goes through without an alert:

```
SOLANA_PRIVATE_KEY=4kX9vQ2mL7pR8sT1wY3zA6bC5dE0fG
```""",
    },
    mission={
        "fr": "Diagnostiquer pourquoi la règle laisse passer cette clé, la corriger sans créer de fausse alerte, puis expliquer le compromis.",
        "en": "Diagnose why the rule lets this key through, fix it without creating false alarms, then explain the trade-off.",
    },
    criteria={
        "fr": ["La cause est nommée avec le bon vocabulaire.", "La nouvelle règle passe tous les tests, positifs et négatifs.", "Le compromis faux positif / faux négatif est expliqué."],
        "en": ["The cause is named with the right vocabulary.", "The new rule passes every test, positive and negative.", "The false positive / false negative trade-off is explained."],
    },
    questions=[
        dict(id="q1", type="text",
             prompt={"fr": "Explique en 2 ou 3 phrases pourquoi `SOLANA_PRIVATE_KEY=...` n'est pas détecté.",
                     "en": "Explain in 2 or 3 sentences why `SOLANA_PRIVATE_KEY=...` is not detected."},
             concepts=[
                 {"label": {"fr": "Le `_` est un caractère de mot", "en": "`_` is a word character"},
                  "any": [r"underscore", r"_ (est|is)", r"tiret bas", r"caractere de mot", r"word char", r"\\w"]},
                 {"label": {"fr": "Pas de frontière de mot entre `_` et `P`", "en": "No word boundary between `_` and `P`"},
                  "any": [r"(pas|aucune?) de frontiere", r"no (word )?boundar", r"frontiere.{0,30}(pas|jamais|aucune)", r"\\b.{0,40}(pas|never|not|ne )", r"boundary.{0,30}(not|never|no)"]},
             ],
             hints={"fr": ["Quels caractères `\\b` considère-t-il comme faisant partie d'un mot ?", "Regarde les deux caractères de part et d'autre de la position où `private_key` commence dans `SOLANA_PRIVATE_KEY`."],
                    "en": ["Which characters does `\\b` treat as part of a word?", "Look at the two characters on either side of where `private_key` starts in `SOLANA_PRIVATE_KEY`."]},
             model={"fr": "Pour une regex, `_` est un caractère de mot, comme les lettres et les chiffres. `\\b` exige le passage d'un caractère de mot à un caractère qui n'en est pas un. Entre `_` et `P`, il n'y a pas de frontière de mot, donc la règle ne peut jamais commencer sur `PRIVATE_KEY`.",
                    "en": "For a regex, `_` is a word character, like letters and digits. `\\b` needs a switch between a word character and a non-word character. Between `_` and `P` there is no word boundary, so the rule can never start on `PRIVATE_KEY`."}),
        dict(id="q2", type="code",
             prompt={"fr": "Réécris `ASSIGNED`. Elle doit reconnaître les noms `private_key`, `secret_key`, `secret_access_key`, `api_key`, `seed_phrase` et `mnemonic`, en majuscules ou minuscules, avec ou sans préfixe finissant par `_` (`SOLANA_`, `AWS_`…), suivis de `=` ou `:` et d'une valeur d'au moins 16 caractères. Elle ne doit pas signaler une valeur courte ni un nom plus long comme `API_KEY_ID`.",
                     "en": "Rewrite `ASSIGNED`. It must recognise the names `private_key`, `secret_key`, `secret_access_key`, `api_key`, `seed_phrase` and `mnemonic`, upper or lower case, with or without a prefix ending in `_` (`SOLANA_`, `AWS_`…), followed by `=` or `:` and a value of at least 16 characters. It must not flag a short value nor a longer name such as `API_KEY_ID`."},
             starter="import re\n\n" + SCAN_RULE + "\n",
             tests=r'''
V = "x" * 40
def test_plain():
    assert ASSIGNED.search("PRIVATE_KEY=" + V)
def test_solana():
    assert ASSIGNED.search("SOLANA_PRIVATE_KEY=" + V)
def test_aws():
    assert ASSIGNED.search("AWS_SECRET_ACCESS_KEY=" + V)
def test_openai():
    assert ASSIGNED.search("OPENAI_API_KEY=sk-" + V)
def test_lower_quoted():
    assert ASSIGNED.search('gecko_api_key = "' + V + '"')
def test_short_value_ignored():
    assert not ASSIGNED.search("OPENAI_API_KEY=your-key-here")
def test_longer_name_ignored():
    assert not ASSIGNED.search("API_KEY_ID=" + V)
def test_prose_ignored():
    assert not ASSIGNED.search("Set your private key in the dashboard, never here.")
''',
             labels={
                 "test_plain": {"fr": "Attrape `PRIVATE_KEY=…`", "en": "Catches `PRIVATE_KEY=…`"},
                 "test_solana": {"fr": "Attrape `SOLANA_PRIVATE_KEY=…`", "en": "Catches `SOLANA_PRIVATE_KEY=…`"},
                 "test_aws": {"fr": "Attrape `AWS_SECRET_ACCESS_KEY=…`", "en": "Catches `AWS_SECRET_ACCESS_KEY=…`"},
                 "test_openai": {"fr": "Attrape `OPENAI_API_KEY=…`", "en": "Catches `OPENAI_API_KEY=…`"},
                 "test_lower_quoted": {"fr": "Attrape `gecko_api_key = \"…\"`", "en": "Catches `gecko_api_key = \"…\"`"},
                 "test_short_value_ignored": {"fr": "Ignore une valeur de moins de 16 caractères", "en": "Ignores a value under 16 characters"},
                 "test_longer_name_ignored": {"fr": "Ignore `API_KEY_ID=…`", "en": "Ignores `API_KEY_ID=…`"},
                 "test_prose_ignored": {"fr": "Ignore une phrase qui parle de clé", "en": "Ignores a sentence about keys"},
             },
             hints={"fr": ["Remplace le premier `\\b` par une condition sur le caractère d'avant : `(?<!...)`.", "Un préfixe, c'est des lettres ou chiffres suivis de `_`, répété zéro fois ou plus : `(?:[a-z0-9]+_)*`.", "Garde le `\\b` après le nom : c'est lui qui écarte `API_KEY_ID`."],
                    "en": ["Replace the first `\\b` with a condition on the previous character: `(?<!...)`.", "A prefix is letters or digits followed by `_`, repeated zero or more times: `(?:[a-z0-9]+_)*`.", "Keep the `\\b` after the name: it is what rules out `API_KEY_ID`."]},
             model='''import re

ASSIGNED = re.compile(
    r"(?i)(?<![a-z0-9_])(?:[a-z0-9]+_)*"
    r"(private_key|secret_key|secret_access_key|api_key|seed_phrase|mnemonic)\\b"
    r"\\s*[:=]\\s*[\\"']?[^\\s\\"']{16,}"
)
''',
             broken_check=True),
        dict(id="q3", type="text",
             prompt={"fr": "Un collègue propose d'attraper toute ligne contenant le mot `key`. Que réponds-tu ? Parle des faux positifs et des faux négatifs.",
                     "en": "A colleague suggests catching any line that contains the word `key`. What do you answer? Talk about false positives and false negatives."},
             concepts=[
                 {"label": {"fr": "Un faux positif est une alerte pour rien", "en": "A false positive is an alert for nothing"},
                  "any": [r"faux positif", r"false positive", r"alerte.{0,20}(rien|inutile|a tort)", r"alert.{0,20}(nothing|wrong)"]},
                 {"label": {"fr": "Trop d'alertes : l'équipe désactive le hook", "en": "Too many alerts: the team disables the hook"},
                  "any": [r"desactiv", r"disable", r"contourn", r"bypass", r"ignor", r"--no-verify", r"skip"]},
                 {"label": {"fr": "Un faux négatif laisse fuiter une clé", "en": "A false negative lets a key leak"},
                  "any": [r"faux negatif", r"false negative", r"fuit", r"leak", r"passe (sans|inapercu)", r"slips? through"]},
             ],
             hints={"fr": ["Que fait une équipe qui reçoit dix fausses alertes par jour ?"],
                    "en": ["What does a team do after ten false alarms a day?"]},
             model={"fr": "Non : `key` apparaît partout (`api_key_id`, `keyboard`, la doc). On aurait beaucoup de faux positifs, des alertes pour rien, et l'équipe finirait par désactiver le hook avec `--no-verify`. Un faux négatif laisse fuiter une clé ; un faux positif tue l'outil. On garde une règle ciblée et un corpus de tests des deux côtés.",
                    "en": "No: `key` shows up everywhere (`api_key_id`, `keyboard`, the docs). We would get many false positives, alerts for nothing, and the team would end up disabling the hook with `--no-verify`. A false negative lets a key leak; a false positive kills the tool. Keep a targeted rule and a test corpus on both sides."}),
    ],
)

REDACT = r'''import re, hashlib

def sha8(s):
    return hashlib.sha256(s.encode()).hexdigest()[:8]

PATTERNS = {"api_key": r"sk-[A-Za-z0-9]{20,}", "email": r"[\w.+-]+@[\w-]+\.[\w.]+"}

def redact(text):
    replacers = []
    for label, pattern in PATTERNS.items():
        replacers.append((re.compile(pattern),
            lambda m: f"[redacted:{label}:{sha8(m.group(0))}]"))
    for regex, repl in replacers:
        text = regex.sub(repl, text)
    return text
'''

drill(
    id="d2", cat="debug", order=2, minutes=15,
    title={"fr": "Tous les secrets portent la même étiquette", "en": "Every secret gets the same label"},
    source={"fr": "Bootcamp Dev3Pack, session 9 : masquer les secrets dans les traces d'un agent",
            "en": "Dev3Pack bootcamp, session 9: masking secrets in an agent's traces"},
    context={
        "fr": f"""Un agent IA écrit des traces de ce qu'il fait. Avant d'écrire, une fonction remplace chaque secret par une étiquette qui dit son type et une empreinte (les 8 premiers caractères d'un hash). La même clé donne toujours la même empreinte : on peut la suivre dans les logs sans jamais la lire.

```python
{REDACT}```

En production, une clé `sk-...` apparaît dans les traces sous l'étiquette `email`.""",
        "en": f"""An AI agent writes traces of what it does. Before writing, a function replaces each secret with a label naming its type and a fingerprint (the first 8 characters of a hash). The same key always gives the same fingerprint: you can follow it through the logs without ever reading it.

```python
{REDACT}```

In production, an `sk-...` key shows up in the traces labelled `email`.""",
    },
    mission={"fr": "Prédire le comportement, nommer le mécanisme, puis corriger la fonction.",
             "en": "Predict the behaviour, name the mechanism, then fix the function."},
    criteria={"fr": ["La prédiction est juste.", "Le mécanisme est nommé précisément.", "La correction passe tous les tests."],
              "en": ["The prediction is right.", "The mechanism is named precisely.", "The fix passes every test."]},
    questions=[
        dict(id="q1", type="choice",
             prompt={"fr": "Que renvoie `redact(\"token sk-abcdefghijklmnopqrstuvwxyz\")` ?", "en": "What does `redact(\"token sk-abcdefghijklmnopqrstuvwxyz\")` return?"},
             options={"fr": ["`token [redacted:api_key:…]`", "`token [redacted:email:…]`", "`token sk-abcdefghijklmnopqrstuvwxyz`, rien n'est remplacé", "Une erreur `NameError`"],
                      "en": ["`token [redacted:api_key:…]`", "`token [redacted:email:…]`", "`token sk-abcdefghijklmnopqrstuvwxyz`, nothing is replaced", "A `NameError`"]},
             answer=1,
             why={"fr": "La lambda lit `label` au moment où elle est appelée ; la boucle est finie et `label` vaut `\"email\"`.",
                  "en": "The lambda reads `label` when it is called; the loop is over and `label` is `\"email\"`."}),
        dict(id="q2", type="text",
             prompt={"fr": "Nomme le mécanisme Python responsable, en une ou deux phrases.", "en": "Name the Python mechanism responsible, in one or two sentences."},
             concepts=[
                 {"label": {"fr": "Liaison tardive (late binding) des closures", "en": "Late binding of closures"},
                  "any": [r"late binding", r"liaison tardive", r"closure", r"fermeture"]},
                 {"label": {"fr": "La variable est lue à l'appel, pas à la création", "en": "The variable is read at call time, not at creation"},
                  "any": [r"(au moment de l'|a l')appel", r"quand (elle|la lambda) est appelee", r"(at|when) (it is )?call", r"call time", r"apres la boucle", r"after the loop", r"derniere valeur", r"last value", r"variable,? (et )?pas (sa )?valeur", r"variable,? not (its )?value"]},
             ],
             hints={"fr": ["La lambda contient-elle la valeur de `label`, ou une référence à la variable ?"], "en": ["Does the lambda hold the value of `label`, or a reference to the variable?"]},
             model={"fr": "C'est la liaison tardive des closures : la lambda capture la variable `label`, pas sa valeur, et la lit au moment de l'appel, quand la boucle est déjà finie.",
                    "en": "It is late binding of closures: the lambda captures the variable `label`, not its value, and reads it at call time, when the loop is already over."}),
        dict(id="q3", type="code",
             prompt={"fr": "Corrige `redact` pour que chaque secret porte la bonne étiquette.", "en": "Fix `redact` so each secret gets the right label."},
             starter=REDACT,
             tests=r'''
KEY = "sk-abcdefghijklmnopqrstuvwxyz"
def test_key_label():
    assert "[redacted:api_key:" in redact("token " + KEY)
def test_email_label():
    assert "[redacted:email:" in redact("mail a@b.com")
def test_both():
    out = redact(KEY + " and a@b.com")
    assert "api_key" in out and "email" in out
def test_same_secret_same_print():
    assert redact(KEY) == redact(KEY)
def test_secret_gone():
    assert KEY not in redact("x " + KEY)
def test_plain_text_kept():
    assert redact("nothing secret here") == "nothing secret here"
''',
             labels={
                 "test_key_label": {"fr": "Une clé `sk-…` est étiquetée `api_key`", "en": "An `sk-…` key is labelled `api_key`"},
                 "test_email_label": {"fr": "Un e-mail est étiqueté `email`", "en": "An email is labelled `email`"},
                 "test_both": {"fr": "Les deux dans le même texte", "en": "Both in the same text"},
                 "test_same_secret_same_print": {"fr": "Même secret, même empreinte", "en": "Same secret, same fingerprint"},
                 "test_secret_gone": {"fr": "Le secret n'apparaît plus", "en": "The secret no longer appears"},
                 "test_plain_text_kept": {"fr": "Le texte sans secret ne change pas", "en": "Text without secrets is unchanged"},
             },
             hints={"fr": ["Un argument par défaut est évalué une seule fois, à la création de la fonction.", "`lambda m, label=label: ...`"],
                    "en": ["A default argument is evaluated once, when the function is created.", "`lambda m, label=label: ...`"]},
             model=REDACT.replace("lambda m: f", "lambda m, label=label: f"),
             broken_check=True),
    ],
)

PICK = '''def pick(numbered, numbers):
    """numbered: list of (doc_id, text); numbers: paragraph numbers chosen by the model, from 1."""
    return [numbered[n - 1] for n in numbers]
'''

drill(
    id="d3", cat="debug", order=3, minutes=15,
    title={"fr": "Le paragraphe zéro", "en": "Paragraph zero"},
    source={"fr": "grounded-research-agent : un agent qui cite ses sources",
            "en": "grounded-research-agent: an agent that cites its sources"},
    context={
        "fr": f"""Un agent de recherche montre au modèle des paragraphes numérotés à partir de 1. Le modèle répond en JSON avec les numéros des paragraphes qui répondent à la question, puis l'application les recopie mot pour mot et cite leur document.

```python
{PICK}
numbered = [("rag", "P1 ..."), ("rag", "P2 ..."), ("agents", "P3 ...")]
```

Un petit modèle local renvoie parfois `{{"paragraphs": [0]}}`.""",
        "en": f"""A research agent shows the model paragraphs numbered from 1. The model replies in JSON with the numbers of the paragraphs that answer the question, then the app copies them word for word and cites their document.

```python
{PICK}
numbered = [("rag", "P1 ..."), ("rag", "P2 ..."), ("agents", "P3 ...")]
```

A small local model sometimes returns `{{"paragraphs": [0]}}`.""",
    },
    mission={"fr": "Prédire ce qui se passe, écrire la fonction qui protège la frontière entre le modèle et le code, et expliquer le risque.",
             "en": "Predict what happens, write the function that guards the boundary between the model and the code, and explain the risk."},
    criteria={"fr": ["La prédiction est juste.", "Le validateur refuse toutes les réponses pièges.", "Le risque d'une erreur silencieuse est expliqué."],
              "en": ["The prediction is right.", "The validator refuses every trap reply.", "The risk of a silent failure is explained."]},
    questions=[
        dict(id="q1", type="choice",
             prompt={"fr": "Que renvoie `pick(numbered, [0])` ?", "en": "What does `pick(numbered, [0])` return?"},
             options={"fr": ["`[(\"rag\", \"P1 ...\")]`", "`[(\"agents\", \"P3 ...\")]`", "Une `IndexError`", "`[]`"],
                      "en": ["`[(\"rag\", \"P1 ...\")]`", "`[(\"agents\", \"P3 ...\")]`", "An `IndexError`", "`[]`"]},
             answer=1,
             why={"fr": "`numbered[0 - 1]` est `numbered[-1]` : Python prend le dernier élément, sans erreur.",
                  "en": "`numbered[0 - 1]` is `numbered[-1]`: Python takes the last item, with no error."}),
        dict(id="q2", type="code",
             prompt={"fr": "Écris `parse_selection(raw, count)`. `raw` est la réponse texte du modèle, `count` le nombre de paragraphes. Renvoie la liste des numéros si `raw` est un objet JSON avec une clé `paragraphs` contenant entre 1 et 3 entiers, tous entre 1 et `count` ; garde l'ordre et retire les doublons. Dans tous les autres cas, renvoie `None`.",
                     "en": "Write `parse_selection(raw, count)`. `raw` is the model's text reply, `count` the number of paragraphs. Return the list of numbers if `raw` is a JSON object with a `paragraphs` key holding 1 to 3 integers, all between 1 and `count`; keep the order and drop duplicates. In every other case, return `None`."},
             starter="import json\n\ndef parse_selection(raw, count):\n    ...\n",
             tests=r'''
def test_valid():
    assert parse_selection('{"paragraphs": [2, 1]}', 3) == [2, 1]
def test_duplicates():
    assert parse_selection('{"paragraphs": [2, 2, 1]}', 3) == [2, 1]
def test_zero():
    assert parse_selection('{"paragraphs": [0]}', 3) is None
def test_negative():
    assert parse_selection('{"paragraphs": [-1]}', 3) is None
def test_too_big():
    assert parse_selection('{"paragraphs": [4]}', 3) is None
def test_one_bad_spoils():
    assert parse_selection('{"paragraphs": [1, 0]}', 3) is None
def test_empty():
    assert parse_selection('{"paragraphs": []}', 3) is None
def test_not_json():
    assert parse_selection("Paragraph 2 answers it.", 3) is None
def test_not_a_list():
    assert parse_selection('{"paragraphs": 2}', 3) is None
def test_not_int():
    assert parse_selection('{"paragraphs": ["two"]}', 3) is None
def test_bool_is_not_a_number():
    assert parse_selection('{"paragraphs": [true]}', 3) is None
''',
             labels={
                 "test_valid": {"fr": "Une sélection valide est renvoyée dans l'ordre", "en": "A valid selection is returned in order"},
                 "test_duplicates": {"fr": "Les doublons sont retirés", "en": "Duplicates are dropped"},
                 "test_zero": {"fr": "`0` est refusé", "en": "`0` is refused"},
                 "test_negative": {"fr": "`-1` est refusé", "en": "`-1` is refused"},
                 "test_too_big": {"fr": "Un numéro trop grand est refusé", "en": "A number too large is refused"},
                 "test_one_bad_spoils": {"fr": "Un seul mauvais numéro refuse tout", "en": "One bad number refuses all"},
                 "test_empty": {"fr": "Une liste vide est refusée", "en": "An empty list is refused"},
                 "test_not_json": {"fr": "Du texte sans JSON est refusé", "en": "Text without JSON is refused"},
                 "test_not_a_list": {"fr": "Un nombre au lieu d'une liste est refusé", "en": "A number instead of a list is refused"},
                 "test_not_int": {"fr": "Un mot au lieu d'un nombre est refusé", "en": "A word instead of a number is refused"},
                 "test_bool_is_not_a_number": {"fr": "`true` n'est pas un numéro", "en": "`true` is not a number"},
             },
             hints={"fr": ["Commence par `json.loads` dans un `try`, et vérifie que le résultat est un `dict`.", "En Python, `True` est un `int` : vérifie `type(n) is int`.", "Pour retirer les doublons en gardant l'ordre : parcours la liste et ajoute seulement ce que tu n'as pas déjà."],
                    "en": ["Start with `json.loads` inside a `try`, and check the result is a `dict`.", "In Python, `True` is an `int`: check `type(n) is int`.", "To drop duplicates and keep the order: walk the list and only add what you have not seen."]},
             model='''import json

def parse_selection(raw, count):
    try:
        data = json.loads(raw)
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    numbers = data.get("paragraphs")
    if not isinstance(numbers, list) or not 1 <= len(numbers) <= 3:
        return None
    result = []
    for n in numbers:
        if type(n) is not int or not 1 <= n <= count:
            return None
        if n not in result:
            result.append(n)
    return result
'''),
        dict(id="q3", type="text",
             prompt={"fr": "Pourquoi un indice négatif accepté en silence est-il plus dangereux qu'une `IndexError` ?",
                     "en": "Why is a silently accepted negative index more dangerous than an `IndexError`?"},
             concepts=[
                 {"label": {"fr": "Aucune erreur visible, le bug passe inaperçu", "en": "No visible error, the bug goes unnoticed"},
                  "any": [r"silenc", r"aucune erreur", r"pas d'erreur", r"sans (erreur|bruit|plant)", r"no (error|crash)", r"inapercu", r"unnoticed", r"ne plante pas", r"doesn'?t crash", r"ne se voit pas"]},
                 {"label": {"fr": "La réponse a l'air juste mais cite une mauvaise source", "en": "The answer looks right but cites a wrong source"},
                  "any": [r"plausible", r"(mauvais|faux|fausse|autre) (source|document|citation|paragraphe)", r"wrong (source|document|citation|paragraph)", r"cite", r"a l'air (juste|correct)", r"looks? (right|correct)"]},
                 {"label": {"fr": "Une erreur bruyante est détectée tout de suite", "en": "A loud error is caught at once"},
                  "any": [r"(tout de suite|immediat|des le premier|vite)", r"(right away|immediately|first test|at once)", r"bruyant", r"loud", r"test (echoue|la voit|l'attrape)", r"test (fails|catches)"]},
             ],
             hints={"fr": ["Compare ce que voit l'utilisateur dans les deux cas."], "en": ["Compare what the user sees in both cases."]},
             model={"fr": "Une `IndexError` fait planter le programme : on la voit tout de suite, dès le premier test. Un indice négatif ne produit aucune erreur : l'agent rend une réponse plausible qui cite une mauvaise source, et personne ne s'en rend compte. Pour un agent qui cite ses sources, c'est la panne la plus grave.",
                    "en": "An `IndexError` crashes the program: you see it at once, in the first test. A negative index produces no error: the agent returns a plausible answer that cites a wrong source, and nobody notices. For an agent that cites its sources, that is the worst failure."}),
    ],
)

drill(
    id="d4", cat="debug", order=4, minutes=15,
    title={"fr": "Le Decimal devenu texte", "en": "The Decimal that became text"},
    source={"fr": "NovaMart : support client multi-agents sur DynamoDB", "en": "NovaMart: multi-agent customer support on DynamoDB"},
    context={
        "fr": """Une base DynamoDB renvoie tous ses nombres en `Decimal`, que `json.dumps` ne sait pas écrire. Pour passer un enregistrement à un agent, le code fait :

```python
import json
from decimal import Decimal

def to_json_safe(item):
    return json.loads(json.dumps(item, default=str))

customer = to_json_safe({"id": "C42", "total_orders": Decimal("7"), "rating": Decimal("4.5")})
```

Plus loin, `if customer["total_orders"] > 5:` lève une erreur.""",
        "en": """A DynamoDB table returns every number as a `Decimal`, which `json.dumps` cannot write. To pass a record to an agent, the code does:

```python
import json
from decimal import Decimal

def to_json_safe(item):
    return json.loads(json.dumps(item, default=str))

customer = to_json_safe({"id": "C42", "total_orders": Decimal("7"), "rating": Decimal("4.5")})
```

Further down, `if customer["total_orders"] > 5:` raises an error.""",
    },
    mission={"fr": "Comprendre la conversion, écrire une conversion qui garde les types, et dire ce qu'on perd avec un `float`.",
             "en": "Understand the conversion, write one that keeps the types, and say what a `float` costs."},
    criteria={"fr": ["Le type obtenu est identifié.", "La nouvelle conversion passe tous les tests.", "La limite du `float` pour de l'argent est expliquée."],
              "en": ["The resulting type is identified.", "The new conversion passes every test.", "The limit of `float` for money is explained."]},
    questions=[
        dict(id="q1", type="choice",
             prompt={"fr": "Que vaut `customer[\"total_orders\"]` ?", "en": "What is `customer[\"total_orders\"]`?"},
             options={"fr": ["`7` (un `int`)", "`7.0` (un `float`)", "`'7'` (une `str`)", "`Decimal('7')`"], "en": ["`7` (an `int`)", "`7.0` (a `float`)", "`'7'` (a `str`)", "`Decimal('7')`"]},
             answer=2,
             why={"fr": "`default=str` transforme chaque `Decimal` en chaîne ; `json.loads` relit une chaîne. Et `'7' > 5` lève une `TypeError`.",
                  "en": "`default=str` turns each `Decimal` into a string; `json.loads` reads back a string. And `'7' > 5` raises a `TypeError`."}),
        dict(id="q2", type="code",
             prompt={"fr": "Écris `dynamo_default(o)`, à passer à `json.dumps(..., default=dynamo_default)`. Un `Decimal` entier devient un `int`, un `Decimal` à virgule devient un `float`. Tout autre type lève une `TypeError`.",
                     "en": "Write `dynamo_default(o)`, to pass to `json.dumps(..., default=dynamo_default)`. A whole `Decimal` becomes an `int`, a fractional `Decimal` becomes a `float`. Any other type raises a `TypeError`."},
             starter="import json\nfrom decimal import Decimal\n\ndef dynamo_default(o):\n    ...\n",
             tests=r'''
def roundtrip(item):
    return json.loads(json.dumps(item, default=dynamo_default))
def test_int():
    v = roundtrip({"n": Decimal("7")})["n"]
    assert v == 7 and type(v) is int
def test_float():
    v = roundtrip({"r": Decimal("4.5")})["r"]
    assert v == 4.5 and type(v) is float
def test_big_int():
    assert roundtrip({"n": Decimal("12345678901234567890")})["n"] == 12345678901234567890
def test_comparison_works():
    assert roundtrip({"n": Decimal("7")})["n"] > 5
def test_unknown_type_raises():
    try:
        json.dumps({"s": {1, 2}}, default=dynamo_default)
    except TypeError:
        return
    assert False, "a set should raise TypeError"
''',
             labels={
                 "test_int": {"fr": "`Decimal('7')` devient `7`, un `int`", "en": "`Decimal('7')` becomes `7`, an `int`"},
                 "test_float": {"fr": "`Decimal('4.5')` devient `4.5`, un `float`", "en": "`Decimal('4.5')` becomes `4.5`, a `float`"},
                 "test_big_int": {"fr": "Un grand entier reste exact", "en": "A big integer stays exact"},
                 "test_comparison_works": {"fr": "La comparaison `> 5` fonctionne", "en": "The `> 5` comparison works"},
                 "test_unknown_type_raises": {"fr": "Un type inconnu lève une `TypeError`", "en": "An unknown type raises a `TypeError`"},
             },
             hints={"fr": ["`o == o.to_integral_value()` dit si un `Decimal` est entier.", "Termine la fonction par `raise TypeError(...)` pour tout le reste."],
                    "en": ["`o == o.to_integral_value()` tells whether a `Decimal` is whole.", "End the function with `raise TypeError(...)` for everything else."]},
             model='''import json
from decimal import Decimal

def dynamo_default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"{type(o).__name__} is not JSON serializable")
'''),
        dict(id="q3", type="text",
             prompt={"fr": "Pour un montant en euros, pourquoi éviter le `float` ? Que fais-tu à la place ?", "en": "For an amount in euros, why avoid `float`? What do you do instead?"},
             concepts=[
                 {"label": {"fr": "Le `float` n'est pas exact (erreurs d'arrondi)", "en": "`float` is not exact (rounding errors)"},
                  "any": [r"arrondi", r"round", r"(pas |in)exact", r"precision", r"0\.1 ?\+ ?0\.2", r"binaire", r"binary"]},
                 {"label": {"fr": "Garder `Decimal` ou des entiers en plus petite unité (centimes)", "en": "Keep `Decimal` or integers in the smallest unit (cents)"},
                  "any": [r"decimal", r"centime", r"cent\b", r"cents", r"plus petite unite", r"smallest unit", r"entier", r"integer"]},
             ],
             hints={"fr": ["Que vaut `0.1 + 0.2` en Python ?"], "en": ["What is `0.1 + 0.2` in Python?"]},
             model={"fr": "Un `float` est stocké en binaire et n'est pas exact : `0.1 + 0.2` ne vaut pas `0.3`, et les erreurs d'arrondi s'accumulent. Pour de l'argent, on garde un `Decimal` dans le code, ou des entiers en centimes (la plus petite unité).",
                    "en": "A `float` is stored in binary and is not exact: `0.1 + 0.2` is not `0.3`, and rounding errors add up. For money, keep a `Decimal` in the code, or integers in cents (the smallest unit)."}),
    ],
)

TURN = '''def record_turn(phrase, history=[]):
    history.append(phrase)
    return history
'''

drill(
    id="d5", cat="debug", order=5, minutes=10,
    title={"fr": "Le panier partagé", "en": "The shared basket"},
    source={"fr": "Black Monday 1987 : un jeu de bourse piloté par la voix", "en": "Black Monday 1987: a voice-driven trading game"},
    context={
        "fr": f"""Dans un jeu, chaque partie garde l'historique des phrases du joueur :

```python
{TURN}
game_1 = record_turn("sell")
game_2 = record_turn("buy")
```

Un testeur signale que la deuxième partie contient les phrases de la première.""",
        "en": f"""In a game, each game keeps the history of the player's phrases:

```python
{TURN}
game_1 = record_turn("sell")
game_2 = record_turn("buy")
```

A tester reports that the second game holds the first game's phrases.""",
    },
    mission={"fr": "Prédire l'état exact des variables, expliquer la cause, corriger la fonction.", "en": "Predict the exact state of the variables, explain the cause, fix the function."},
    criteria={"fr": ["Les deux prédictions sont justes.", "La cause est expliquée.", "La correction passe tous les tests."],
              "en": ["Both predictions are right.", "The cause is explained.", "The fix passes every test."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Que vaut `game_1` après les deux appels ?", "en": "What is `game_1` after both calls?"},
             options={"fr": ["`['sell']`", "`['sell', 'buy']`", "`['buy']`", "`[]`"], "en": ["`['sell']`", "`['sell', 'buy']`", "`['buy']`", "`[]`"]},
             answer=1, why={"fr": "Les deux appels ajoutent à la même liste.", "en": "Both calls append to the same list."}),
        dict(id="q2", type="choice", prompt={"fr": "Que vaut `game_1 is game_2` ?", "en": "What is `game_1 is game_2`?"},
             options={"fr": ["`True`", "`False`"], "en": ["`True`", "`False`"]},
             answer=0, why={"fr": "C'est le même objet liste, créé une seule fois.", "en": "It is the same list object, created once."}),
        dict(id="q3", type="text", prompt={"fr": "Pourquoi les deux parties partagent-elles la même liste ?", "en": "Why do both games share the same list?"},
             concepts=[
                 {"label": {"fr": "La valeur par défaut est évaluée une seule fois", "en": "The default value is evaluated once"},
                  "any": [r"une (seule )?fois", r"\bonce\b", r"une seule liste", r"single list"]},
                 {"label": {"fr": "À la définition de la fonction (ligne `def`)", "en": "When the function is defined (the `def` line)"},
                  "any": [r"definition", r"defini", r"\bdef\b", r"defined", r"creation de la fonction", r"function is created"]},
             ],
             hints={"fr": ["Quand Python crée-t-il la liste `[]` de la valeur par défaut ?"], "en": ["When does Python create the default `[]` list?"]},
             model={"fr": "Une valeur par défaut est évaluée une seule fois, quand Python exécute la ligne `def`. La liste `[]` est donc créée une fois et partagée par tous les appels.",
                    "en": "A default value is evaluated once, when Python runs the `def` line. The `[]` list is created once and shared by every call."}),
        dict(id="q4", type="code", prompt={"fr": "Corrige `record_turn` pour que chaque partie ait son historique.", "en": "Fix `record_turn` so each game has its own history."},
             starter=TURN,
             tests=r'''
def test_independent_games():
    a = record_turn("sell")
    b = record_turn("buy")
    assert a == ["sell"] and b == ["buy"]
def test_not_same_object():
    assert record_turn("x") is not record_turn("y")
def test_explicit_history_kept():
    h = ["open"]
    assert record_turn("sell", h) == ["open", "sell"]
    assert h == ["open", "sell"]
''',
             labels={
                 "test_independent_games": {"fr": "Deux parties ont des historiques séparés", "en": "Two games have separate histories"},
                 "test_not_same_object": {"fr": "Chaque appel crée sa propre liste", "en": "Each call creates its own list"},
                 "test_explicit_history_kept": {"fr": "Un historique passé en argument est complété", "en": "A history passed in is extended"},
             },
             hints={"fr": ["Utilise `None` comme valeur par défaut, et crée la liste dans le corps de la fonction."], "en": ["Use `None` as the default, and create the list inside the function body."]},
             model='''def record_turn(phrase, history=None):
    if history is None:
        history = []
    history.append(phrase)
    return history
''', broken_check=True),
    ],
)

DAYS = '''from datetime import datetime, timezone

def days_since(date_str, now):
    try:
        start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None
    return (now - start).days

def is_returnable(order_date, now):
    days = days_since(order_date, now)
    return days is not None and days <= 30
'''

drill(
    id="d6", cat="debug", order=6, minutes=15,
    title={"fr": "La commande livrée dans le futur", "en": "The order delivered in the future"},
    source={"fr": "NovaMart : règles de retour des commandes", "en": "NovaMart: order return rules"},
    context={
        "fr": f"""Un agent de support décide si une commande peut être retournée. Le délai est de 30 jours pour un client standard. `now` est passé en paramètre pour que les tests ne dépendent pas du jour.

```python
{DAYS}```

Une commande saisie avec une date erronée, le 25 octobre alors qu'on est le 22, est déclarée remboursable. Après discussion, l'équipe produit tranche : **une date future est une donnée invalide**. `days_since` doit renvoyer `None`, et une commande sans durée valide n'est pas retournable.""",
        "en": f"""A support agent decides whether an order can be returned. The window is 30 days for a standard customer. `now` is passed in so the tests do not depend on the day.

```python
{DAYS}```

An order entered with a wrong date, 25 October when today is the 22nd, is declared refundable. After discussion, the product team decides: **a future date is invalid data**. `days_since` must return `None`, and an order without a valid duration is not returnable.""",
    },
    mission={"fr": "Corriger la fonction selon la règle décidée, la tester aux bornes, et dire ce qui ne relève pas du code.",
             "en": "Fix the function according to the agreed rule, test it at the boundaries, and say what is not a coding decision."},
    criteria={"fr": ["La règle est appliquée exactement.", "Les bornes 30 et 31 jours sont justes.", "Le rôle du métier et le piège des fuseaux horaires sont cités."],
              "en": ["The rule is applied exactly.", "The 30 and 31 day boundaries are right.", "The business's role and the time-zone trap are mentioned."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Corrige `days_since` et `is_returnable` selon la règle de l'équipe produit.", "en": "Fix `days_since` and `is_returnable` according to the product team's rule."},
             starter=DAYS,
             tests=r'''
NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
def test_today():
    assert days_since("2026-10-22", NOW) == 0
def test_thirty():
    assert days_since("2026-09-22", NOW) == 30
def test_future_is_none():
    assert days_since("2026-10-25", NOW) is None
def test_invalid_dates():
    assert days_since("2026-02-30", NOW) is None and days_since(None, NOW) is None and days_since("", NOW) is None
def test_returnable_at_thirty():
    assert is_returnable("2026-09-22", NOW) is True
def test_not_returnable_at_31():
    assert is_returnable("2026-09-21", NOW) is False
def test_future_not_returnable():
    assert is_returnable("2026-10-25", NOW) is False
''',
             labels={
                 "test_today": {"fr": "Aujourd'hui : 0 jour", "en": "Today: 0 days"},
                 "test_thirty": {"fr": "Il y a 30 jours : 30", "en": "30 days ago: 30"},
                 "test_future_is_none": {"fr": "Une date future renvoie `None`", "en": "A future date returns `None`"},
                 "test_invalid_dates": {"fr": "Les dates illisibles renvoient `None`", "en": "Unreadable dates return `None`"},
                 "test_returnable_at_thirty": {"fr": "Retournable à 30 jours", "en": "Returnable at 30 days"},
                 "test_not_returnable_at_31": {"fr": "Plus retournable à 31 jours", "en": "Not returnable at 31 days"},
                 "test_future_not_returnable": {"fr": "Une date future n'est pas retournable", "en": "A future date is not returnable"},
             },
             hints={"fr": ["Une seule condition suffit, avant le `return` : comparer `start` à `now`."], "en": ["One condition is enough, before the `return`: compare `start` with `now`."]},
             model=DAYS.replace("        return None\n    return (now - start).days", "        return None\n    if start > now:\n        return None\n    return (now - start).days"),
             broken_check=True),
        dict(id="q2", type="text", prompt={"fr": "Le code n'a pas choisi la règle. Qui l'a fait, et pourquoi est-ce important ? Cite aussi un piège lié aux dates.",
                                           "en": "The code did not choose the rule. Who did, and why does it matter? Also name one trap with dates."},
             concepts=[
                 {"label": {"fr": "La règle vient du métier ou du produit, pas du développeur", "en": "The rule comes from the business or product, not the developer"},
                  "any": [r"metier", r"produit", r"product", r"business", r"(pas|not) (au |a la |the )?(dev|code)", r"poser la question", r"ask"]},
                 {"label": {"fr": "Fuseau horaire : UTC contre l'heure locale", "en": "Time zone: UTC versus local time"},
                  "any": [r"fuseau", r"time ?zone", r"\butc\b", r"heure locale", r"local time", r"minuit", r"midnight"]},
             ],
             hints={"fr": ["Une commande passée à Paris à 1 h du matin, quel jour est-elle en UTC ?"], "en": ["An order placed in Paris at 1 a.m.: what day is it in UTC?"]},
             model={"fr": "C'est une règle métier : l'équipe produit décide de ce qu'est une date valide et de ce qu'on fait des cas douteux. Le développeur pose la question au lieu de choisir seul. Le piège : les fuseaux horaires. Une commande passée à Paris à 1 h du matin est encore la veille en UTC.",
                    "en": "It is a business rule: the product team decides what a valid date is and what to do with doubtful cases. The developer asks instead of choosing alone. The trap: time zones. An order placed in Paris at 1 a.m. is still the day before in UTC."}),
    ],
)

TRACES = {
    "t1": '''Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File ".../lib/python3.12/ensurepip/__init__.py", line 284, in _main
  File ".../lib/python3.12/plistlib.py", line 70, in <module>
    from xml.parsers.expat import ParserCreate
ImportError: dlopen(.../pyexpat.cpython-312-darwin.so, 0x0002):
  Symbol not found: _XML_SetAllocTrackerActivationThreshold
  Referenced from: .../pyexpat.cpython-312-darwin.so
  Expected in: /usr/lib/libexpat.1.dylib''',
    "t2": '''$ uvicorn main:app --reload
ERROR:    Error loading ASGI app. Could not import module "main".''',
    "t3": '''INFO:     127.0.0.1:52144 - "OPTIONS /turn HTTP/1.1" 405 Method Not Allowed''',
    "t4": '''botocore.exceptions.MissingDependencyException: Missing Dependency:
This operation requires an additional dependency.
Use pip install botocore[crt] before proceeding.''',
}

def trace_block(lang):
    names = {"fr": ["Trace 1 : création d'un environnement virtuel", "Trace 2 : lancement d'une API", "Trace 3 : logs d'une API appelée par une page web", "Trace 4 : premier appel à AWS"],
             "en": ["Trace 1: creating a virtual environment", "Trace 2: starting an API", "Trace 3: logs of an API called by a web page", "Trace 4: first call to AWS"]}[lang]
    return "\n\n".join(f"**{n}**\n\n```\n{TRACES[k]}\n```" for n, k in zip(names, ["t1", "t2", "t3", "t4"]))

drill(
    id="d7", cat="debug", order=7, minutes=10,
    title={"fr": "Une trace en 2 minutes", "en": "A traceback in 2 minutes"},
    source={"fr": "Quatre pannes réelles du journal d'apprentissage", "en": "Four real failures from the learning journal"},
    context={
        "fr": "En entretien, on te montre souvent une trace d'erreur seule, sans le code. Voici quatre traces réelles.\n\n" + trace_block("fr"),
        "en": "In interviews you are often shown a traceback alone, without the code. Here are four real ones.\n\n" + trace_block("en"),
    },
    mission={"fr": "Pour chaque trace, identifier la cause en moins de 30 secondes, puis décrire ta méthode de lecture.",
             "en": "For each trace, identify the cause in under 30 seconds, then describe your reading method."},
    criteria={"fr": ["Les quatre causes sont justes.", "La méthode distingue le symptôme de la cause."],
              "en": ["All four causes are right.", "The method separates symptom from cause."]},
    questions=[
        dict(id="q1", type="choice", prompt={"fr": "Trace 1 : quelle est la cause ?", "en": "Trace 1: what is the cause?"},
             options={"fr": ["ensurepip est cassé, il faut le réinstaller", "Le module XML de Python a été compilé pour une bibliothèque système plus récente que celle de la machine", "Il manque les droits administrateur", "Python 3.12 n'est pas compatible avec venv"],
                      "en": ["ensurepip is broken and needs reinstalling", "Python's XML module was built against a newer system library than the one on the machine", "Admin rights are missing", "Python 3.12 is not compatible with venv"]},
             answer=1, why={"fr": "La ligne qui compte est `Symbol not found` : pyexpat cherche une fonction absente de la libexpat du système. ensurepip n'est que la victime.",
                            "en": "The line that matters is `Symbol not found`: pyexpat looks for a function missing from the system's libexpat. ensurepip is only the victim."}),
        dict(id="q2", type="choice", prompt={"fr": "Trace 2 : quelle est la cause la plus probable ?", "en": "Trace 2: what is the most likely cause?"},
             options={"fr": ["Une erreur de syntaxe dans `main.py`", "uvicorn est lancé depuis un dossier qui ne contient pas `main.py`", "Le port est déjà utilisé", "FastAPI n'est pas installé"],
                      "en": ["A syntax error in `main.py`", "uvicorn is started from a folder that does not contain `main.py`", "The port is already in use", "FastAPI is not installed"]},
             answer=1, why={"fr": "Le chemin d'import dépend du dossier courant : premier réflexe, `pwd`.", "en": "The import path depends on the current folder: first reflex, `pwd`."}),
        dict(id="q3", type="choice", prompt={"fr": "Trace 3 : que s'est-il passé ?", "en": "Trace 3: what happened?"},
             options={"fr": ["Le navigateur a envoyé une requête de vérification CORS (preflight) que l'API ne sait pas traiter", "La route `/turn` n'existe pas", "Le serveur est surchargé", "Le JSON envoyé est mal formé"],
                      "en": ["The browser sent a CORS check request (preflight) the API cannot handle", "The `/turn` route does not exist", "The server is overloaded", "The JSON sent is malformed"]},
             answer=0, why={"fr": "Le verbe `OPTIONS` trahit le preflight CORS : il faut un middleware CORS limité à l'origine du front.", "en": "The `OPTIONS` verb gives away the CORS preflight: add a CORS middleware limited to the front end's origin."}),
        dict(id="q4", type="choice", prompt={"fr": "Trace 4 : que fais-tu ?", "en": "Trace 4: what do you do?"},
             options={"fr": ["Je change de région AWS", "J'installe la dépendance optionnelle `botocore[crt]` dans l'environnement du projet", "Je régénère mes clés d'accès", "Je mets à jour Python"],
                      "en": ["Change AWS region", "Install the optional `botocore[crt]` dependency in the project's environment", "Regenerate my access keys", "Upgrade Python"]},
             answer=1, why={"fr": "Le message nomme le paquet manquant ; il faut l'ajouter aussi au `requirements.txt`.", "en": "The message names the missing package; add it to `requirements.txt` too."}),
        dict(id="q5", type="text", prompt={"fr": "Décris ta méthode pour lire une trace inconnue, en 3 étapes.", "en": "Describe your method for reading an unknown traceback, in 3 steps."},
             concepts=[
                 {"label": {"fr": "Lire de bas en haut : la dernière ligne donne le type et le message", "en": "Read bottom up: the last line gives the type and message"},
                  "any": [r"bas en haut", r"bottom", r"(derniere|last) ligne", r"last line", r"fin de la trace", r"end of the trace"]},
                 {"label": {"fr": "Remonter jusqu'à la première ligne de ton propre code", "en": "Climb to the first line of your own code"},
                  "any": [r"(mon|ton|notre|son) (propre )?code", r"(my|your|our) (own )?code", r"premiere ligne", r"first line"]},
                 {"label": {"fr": "Distinguer le symptôme de la cause (première exception)", "en": "Separate symptom from cause (first exception)"},
                  "any": [r"symptome", r"symptom", r"premiere exception", r"first exception", r"during handling", r"cause (racine|reelle|profonde)", r"root cause", r"victime", r"victim"]},
             ],
             hints={"fr": ["Où se trouve le message d'erreur dans une trace Python ?"], "en": ["Where is the error message in a Python traceback?"]},
             model={"fr": "1. Je lis de bas en haut : la dernière ligne donne le type d'erreur et le message. 2. Je remonte jusqu'à la première ligne qui est dans mon propre code. 3. Je distingue le symptôme de la cause : si la trace dit « During handling of the above exception », la vraie cause est la première exception. Avant de toucher au code, je vérifie `pwd`, `which python` et les versions.",
                    "en": "1. I read bottom up: the last line gives the error type and message. 2. I climb to the first line that is in my own code. 3. I separate symptom from cause: if the trace says \"During handling of the above exception\", the real cause is the first exception. Before touching code, I check `pwd`, `which python` and the versions."}),
    ],
)
