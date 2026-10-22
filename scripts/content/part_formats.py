# Interview formats F1-F9.
DRILLS = []
def drill(**kw):
    DRILLS.append(kw)

SPEC_DAYS = '''# Provided, do not rewrite it: your tests will be run against it and against broken versions.
# days_since(date_str, now) returns the whole days between date_str ("YYYY-MM-DD", UTC)
# and now, or None if date_str is unreadable or in the future.
from datetime import datetime, timezone

NOW = datetime(2026, 10, 22, 12, 0, tzinfo=timezone.utc)
'''

drill(
    id="f1", cat="formats", order=1, minutes=20,
    title={"fr": "Écrire les tests d'une fonction", "en": "Write the tests for a function"},
    source={"fr": "Format « écris les tests » : très fréquent en entretien junior", "en": "\"Write the tests\" format: very common in junior interviews"},
    context={"fr": """On te donne la spécification d'une fonction, pas son code. Tes tests seront lancés contre la vraie fonction, puis contre trois versions cassées. De bons tests passent sur la vraie et échouent sur chaque version cassée.

Spécification de `days_since(date_str, now)` :

- elle renvoie le nombre de jours entiers entre `date_str` (format `AAAA-MM-JJ`, en UTC) et `now` ;
- elle renvoie `None` si la date est illisible (`None`, chaîne vide, 30 février, mauvais format) ;
- elle renvoie `None` si la date est dans le futur.""",
             "en": """You get a function's specification, not its code. Your tests will run against the real function, then against three broken versions. Good tests pass on the real one and fail on each broken version.

Specification of `days_since(date_str, now)`:

- it returns the whole number of days between `date_str` (`YYYY-MM-DD`, UTC) and `now`;
- it returns `None` if the date is unreadable (`None`, empty string, 30 February, wrong format);
- it returns `None` if the date is in the future."""},
    mission={"fr": "Écrire des fonctions `test_...` qui couvrent la spécification, bornes comprises.", "en": "Write `test_...` functions that cover the specification, boundaries included."},
    criteria={"fr": ["Tes tests passent sur la vraie fonction.", "Chacune des trois versions cassées est attrapée par au moins un test."], "en": ["Your tests pass on the real function.", "Each of the three broken versions is caught by at least one test."]},
    questions=[
        dict(id="q1", type="code", mode="tests",
             prompt={"fr": "Écris tes tests ci-dessous. `days_since` et `NOW` sont fournis : n'écris pas la fonction. Utilise des `assert`.", "en": "Write your tests below. `days_since` and `NOW` are provided: do not write the function. Use `assert`."},
             starter=SPEC_DAYS + "\n\ndef test_today():\n    assert days_since(\"2026-10-22\", NOW) == 0\n",
             tests=r'''
from datetime import datetime, timezone

def real(date_str, now):
    try:
        start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None
    if start > now:
        return None
    return (now - start).days

def no_future_check(date_str, now):
    try:
        start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None
    return (now - start).days

def off_by_one(date_str, now):
    d = real(date_str, now)
    return None if d is None else d + (1 if d >= 30 else 0)

def crashes_on_none(date_str, now):
    start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    if start > now:
        return None
    return (now - start).days

def run_user_tests(impl):
    ns = {"days_since": impl}
    exec(__user_code__, ns)
    ns["days_since"] = impl
    tests = [v for k, v in ns.items() if k.startswith("test_") and callable(v)]
    assert tests, "no test_ function found"
    failures = 0
    for t in tests:
        try:
            t()
        except Exception:
            failures += 1
    return len(tests), failures

def test_pass_on_real():
    n, failed = run_user_tests(real)
    assert failed == 0, f"{failed} of your {n} tests fail on the real function"
def test_catch_no_future_check():
    assert run_user_tests(no_future_check)[1] > 0
def test_catch_off_by_one():
    assert run_user_tests(off_by_one)[1] > 0
def test_catch_crash_on_none():
    assert run_user_tests(crashes_on_none)[1] > 0
''',
             labels={
                 "test_pass_on_real": {"fr": "Tous tes tests passent sur la vraie fonction", "en": "All your tests pass on the real function"},
                 "test_catch_no_future_check": {"fr": "Attrape la version qui accepte les dates futures", "en": "Catches the version that accepts future dates"},
                 "test_catch_off_by_one": {"fr": "Attrape la version décalée d'un jour à partir de 30", "en": "Catches the version off by one from 30 days"},
                 "test_catch_crash_on_none": {"fr": "Attrape la version qui plante sur `None`", "en": "Catches the version that crashes on `None`"},
             },
             hints={"fr": ["Teste les bornes : 30 jours pile, c'est là que se cachent les décalages.", "Une date future, c'est un test à part entière.", "`days_since(None, NOW)` doit renvoyer `None` sans planter."],
                    "en": ["Test the boundaries: exactly 30 days is where off-by-ones hide.", "A future date deserves its own test.", "`days_since(None, NOW)` must return `None` without crashing."]},
             model=SPEC_DAYS + '''

def test_today():
    assert days_since("2026-10-22", NOW) == 0

def test_thirty_days():
    assert days_since("2026-09-22", NOW) == 30

def test_future_is_none():
    assert days_since("2026-10-25", NOW) is None

def test_unreadable_dates():
    for bad in [None, "", "2026-02-30", "22/10/2026"]:
        assert days_since(bad, NOW) is None
'''),
    ],
)

PR = '''# PR #41 "Retry refunds when the payment API is slow"
import logging, requests

log = logging.getLogger(__name__)
API_KEY = "sk_live_4f9a..."                      # (1)

def refund(order_id, amount_cents):
    log.info(f"refund {order_id} key={API_KEY}")  # (2)
    for attempt in range(5):                     # (3)
        try:
            r = requests.post(
                "https://pay.example.com/refunds",
                json={"order": order_id, "amount": amount_cents},
                headers={"Authorization": API_KEY},
                timeout=2,
            )
            return r.json()
        except Exception:                        # (4)
            continue
    return None                                  # (5)
'''

drill(
    id="f2", cat="formats", order=2, minutes=20,
    title={"fr": "Revue d'une PR générée par l'IA", "en": "Review a pull request the AI wrote"},
    source={"fr": "Format « revue de code » : l'épreuve la plus courante quand l'IA est autorisée", "en": "\"Code review\" format: the most common test when AI is allowed"},
    context={"fr": f"""Un collègue a demandé à un assistant IA d'écrire cette PR, puis te l'envoie en revue. Les numéros en commentaire servent à désigner les lignes.

```python
{PR}```""",
             "en": f"""A colleague asked an AI assistant to write this PR, then sends it to you for review. The numbers in comments are there to point at lines.

```python
{PR}```"""},
    mission={"fr": "Rendre une revue : ce qui bloque la fusion, ce qui se discute, avec à chaque fois la ligne, le risque concret et une piste.", "en": "Hand back a review: what blocks the merge, what is debatable, each time with the line, the concrete risk and a suggestion."},
    criteria={"fr": ["Les deux failles de sécurité sont trouvées.", "Le risque du réessai sur un remboursement est trouvé.", "Le ton critique le code, pas la personne."], "en": ["Both security flaws are found.", "The risk of retrying a refund is found.", "The tone critiques the code, not the person."]},
    questions=[
        dict(id="q1", type="text", prompt={"fr": "Écris ce qui bloque la fusion (les problèmes graves).", "en": "Write what blocks the merge (the serious problems)."},
             concepts=[
                 {"label": {"fr": "(1) Clé d'API en clair dans le code", "en": "(1) API key in plain text in the code"}, "any": [r"(cle|key).{0,40}(en clair|dans le code|in (the )?code|hard.?cod|commit|repo)", r"hard.?cod", r"variable d'environnement", r"environment variable", r"\benv\b", r"secret manager", r"\(1\)"]},
                 {"label": {"fr": "(2) La clé est écrite dans les logs", "en": "(2) The key is written to the logs"}, "any": [r"(log|journal|trace).{0,40}(cle|key|secret)", r"(cle|key|secret).{0,40}(log|journal)", r"\(2\)"]},
                 {"label": {"fr": "(3) Réessayer un remboursement peut rembourser deux fois", "en": "(3) Retrying a refund can refund twice"}, "any": [r"deux fois", r"twice", r"double", r"idempoten", r"plusieurs remboursements", r"several refunds", r"\(3\)"]},
             ],
             hints={"fr": ["Relis les lignes (1) et (2) en pensant à qui peut lire le dépôt et les logs.", "Le paiement a-t-il pu passer alors que la réponse a expiré ?"],
                    "en": ["Reread lines (1) and (2) thinking about who can read the repo and the logs.", "Could the payment have gone through even though the response timed out?"]},
             model={"fr": "Bloquant. (1) La clé d'API est en clair dans le code : elle part dans l'historique Git. La lire depuis une variable d'environnement ou un gestionnaire de secrets, et la révoquer. (2) La ligne de log écrit la clé : quiconque lit les logs peut rembourser. Ne logger que l'identifiant de commande. (3) Un délai dépassé ne veut pas dire que le remboursement a échoué : le réessai peut rembourser deux fois. Envoyer une clé d'idempotence (par exemple l'identifiant de commande) pour que l'API ignore les doublons.",
                    "en": "Blocking. (1) The API key is in plain text in the code: it ends up in Git history. Read it from an environment variable or a secret manager, and revoke it. (2) The log line writes the key: anyone reading the logs can issue refunds. Log only the order id. (3) A timeout does not mean the refund failed: the retry can refund twice. Send an idempotency key (for example the order id) so the API ignores duplicates."}),
        dict(id="q2", type="text", prompt={"fr": "Écris ce qui se discute (les choix fragiles).", "en": "Write what is debatable (the fragile choices)."},
             concepts=[
                 {"label": {"fr": "(4) `except Exception` avale toutes les erreurs, même les bugs", "en": "(4) `except Exception` swallows every error, even bugs"}, "any": [r"except", r"avale", r"swallow", r"toutes les erreurs", r"every error", r"all errors", r"\(4\)"]},
                 {"label": {"fr": "(5) `return None` en silence : l'appelant ne sait pas que ça a échoué", "en": "(5) silent `return None`: the caller does not know it failed"}, "any": [r"return none", r"none", r"silenc", r"appelant", r"caller", r"\(5\)"]},
                 {"label": {"fr": "Pas d'attente entre les essais, ni de distinction entre erreurs transitoires et définitives", "en": "No wait between tries, no split between transient and permanent errors"}, "any": [r"attente", r"backoff", r"sleep", r"delai", r"transitoire", r"transient", r"4\d\d", r"5\d\d", r"status"]},
             ],
             hints={"fr": ["Que se passe-t-il si l'API répond 400 « montant invalide » ?"], "en": ["What happens if the API answers 400 \"invalid amount\"?"]},
             model={"fr": "À discuter. (4) `except Exception` avale tout, même une faute de frappe dans le code : n'attraper que les erreurs réseau et les réponses 5xx. (5) Renvoyer `None` en silence cache l'échec à l'appelant : lever une exception claire. Enfin, les cinq essais partent sans attente : ajouter un délai croissant, et ne pas réessayer une erreur définitive comme un 400.",
                    "en": "To discuss. (4) `except Exception` swallows everything, even a typo in the code: catch only network errors and 5xx responses. (5) Returning `None` silently hides the failure from the caller: raise a clear exception. Finally, the five tries go out with no wait: add a growing delay, and never retry a permanent error such as a 400."}),
    ],
)

TIERS = '''RETURN_DAYS = {"standard": 30, "premium": 60}

def is_returnable(days, tier):
    if tier == "premium":
        return days <= 60
    return days <= 30
'''

drill(
    id="f3", cat="formats", order=3, minutes=20,
    title={"fr": "Étendre un code existant", "en": "Extend existing code"},
    source={"fr": "NovaMart : niveaux de clients et délais de retour", "en": "NovaMart: customer tiers and return windows"},
    context={"fr": f"""Le service client ajoute un niveau « gold » avec 90 jours pour retourner une commande. Voici le code actuel :

```python
{TIERS}```

Règle du produit : un niveau inconnu doit lever une `ValueError` ; on ne devine pas.""",
             "en": f"""Customer service adds a "gold" tier with 90 days to return an order. Here is the current code:

```python
{TIERS}```

Product rule: an unknown tier must raise a `ValueError`; we never guess."""},
    mission={"fr": "Ajouter le niveau sans casser l'existant, et ranger la règle à un seul endroit.", "en": "Add the tier without breaking what exists, and keep the rule in a single place."},
    criteria={"fr": ["Les anciens niveaux se comportent comme avant.", "Le délai de chaque niveau n'est écrit qu'une fois.", "Un niveau inconnu est refusé."], "en": ["Old tiers behave as before.", "Each tier's window is written only once.", "An unknown tier is refused."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Modifie le code pour ajouter `gold` (90 jours).", "en": "Change the code to add `gold` (90 days)."},
             starter=TIERS,
             tests=r'''
def test_standard_unchanged():
    assert is_returnable(30, "standard") and not is_returnable(31, "standard")
def test_premium_unchanged():
    assert is_returnable(60, "premium") and not is_returnable(61, "premium")
def test_gold():
    assert is_returnable(90, "gold") and not is_returnable(91, "gold")
def test_unknown_tier():
    try:
        is_returnable(10, "platinum")
    except ValueError:
        return
    assert False, "an unknown tier must raise ValueError"
def test_single_source_of_truth():
    old = RETURN_DAYS["gold"]
    RETURN_DAYS["gold"] = 100
    try:
        assert is_returnable(95, "gold")
    finally:
        RETURN_DAYS["gold"] = old
''',
             labels={
                 "test_standard_unchanged": {"fr": "Standard : toujours 30 jours", "en": "Standard: still 30 days"},
                 "test_premium_unchanged": {"fr": "Premium : toujours 60 jours", "en": "Premium: still 60 days"},
                 "test_gold": {"fr": "Gold : 90 jours", "en": "Gold: 90 days"},
                 "test_unknown_tier": {"fr": "Un niveau inconnu lève une `ValueError`", "en": "An unknown tier raises a `ValueError`"},
                 "test_single_source_of_truth": {"fr": "Le délai est lu dans `RETURN_DAYS`, écrit une seule fois", "en": "The window is read from `RETURN_DAYS`, written once"},
             },
             hints={"fr": ["`RETURN_DAYS` existe déjà mais n'est pas utilisé : c'est lui, la source unique.", "`if tier not in RETURN_DAYS: raise ValueError(...)`"],
                    "en": ["`RETURN_DAYS` already exists but is unused: it is the single source.", "`if tier not in RETURN_DAYS: raise ValueError(...)`"]},
             model='''RETURN_DAYS = {"standard": 30, "premium": 60, "gold": 90}

def is_returnable(days, tier):
    if tier not in RETURN_DAYS:
        raise ValueError(f"unknown tier: {tier}")
    return days <= RETURN_DAYS[tier]
''', broken_check=True),
    ],
)

drill(
    id="f4", cat="formats", order=4, minutes=25,
    title={"fr": "Pannes d'un LLM : réessai borné", "en": "LLM failures: bounded retries"},
    source={"fr": "Black Monday 1987 : la voix du courtier, avec mode de secours", "en": "Black Monday 1987: the broker's voice, with a fallback"},
    context={"fr": """Un agent appelle un fournisseur de LLM qui renvoie parfois une erreur passagère : limitation de débit, délai dépassé, service indisponible. On veut réessayer ces erreurs-là, et seulement elles, avec une attente qui double à chaque fois.

```python
class TransientError(Exception):
    \"\"\"Throttling, timeout, 503: worth retrying.\"\"\"
```

`sleep` est passé en paramètre pour que les tests tournent instantanément.""",
             "en": """An agent calls an LLM provider that sometimes returns a passing error: throttling, timeout, service unavailable. We want to retry those errors, and only those, waiting twice as long each time.

```python
class TransientError(Exception):
    \"\"\"Throttling, timeout, 503: worth retrying.\"\"\"
```

`sleep` is passed in so the tests run instantly."""},
    mission={"fr": "Écrire la fonction de réessai, puis dire quand il ne faut pas réessayer.", "en": "Write the retry function, then say when not to retry."},
    criteria={"fr": ["La fonction passe tous les tests.", "Le lien entre réessai et idempotence est fait."], "en": ["The function passes every test.", "The link between retries and idempotency is made."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `call_with_retry(fn, tries=3, base_delay=0.5, sleep=time.sleep)`. Elle appelle `fn()`. Sur une `TransientError`, elle attend `base_delay`, puis le double, puis le double, et réessaie, `tries` fois au total. Après le dernier échec, elle relance l'erreur. Toute autre erreur remonte tout de suite. `tries` inférieur à 1 lève une `ValueError`.",
                                           "en": "Write `call_with_retry(fn, tries=3, base_delay=0.5, sleep=time.sleep)`. It calls `fn()`. On a `TransientError`, it waits `base_delay`, then double, then double again, and retries, `tries` times in all. After the last failure, it re-raises. Any other error propagates at once. `tries` below 1 raises a `ValueError`."},
             starter="import time\n\nclass TransientError(Exception):\n    pass\n\ndef call_with_retry(fn, tries=3, base_delay=0.5, sleep=time.sleep):\n    ...\n",
             tests=r'''
def flaky(fail_times, error=None):
    state = {"calls": 0}
    def fn():
        state["calls"] += 1
        if state["calls"] <= fail_times:
            raise (error or TransientError("throttled"))
        return "ok"
    return fn, state

def test_success_first_try():
    fn, state = flaky(0)
    assert call_with_retry(fn, sleep=lambda d: None) == "ok" and state["calls"] == 1
def test_success_after_two_failures():
    fn, state = flaky(2)
    assert call_with_retry(fn, tries=3, sleep=lambda d: None) == "ok" and state["calls"] == 3
def test_delays_double():
    delays = []
    fn, _ = flaky(2)
    call_with_retry(fn, tries=3, base_delay=0.5, sleep=delays.append)
    assert delays == [0.5, 1.0]
def test_reraises_after_last_try():
    fn, state = flaky(10)
    try:
        call_with_retry(fn, tries=3, sleep=lambda d: None)
    except TransientError:
        assert state["calls"] == 3
        return
    assert False, "should re-raise TransientError"
def test_no_sleep_after_last_try():
    delays = []
    fn, _ = flaky(10)
    try:
        call_with_retry(fn, tries=3, base_delay=1, sleep=delays.append)
    except TransientError:
        pass
    assert len(delays) == 2
def test_other_errors_not_retried():
    fn, state = flaky(1, error=ValueError("bad request"))
    try:
        call_with_retry(fn, tries=3, sleep=lambda d: None)
    except ValueError:
        assert state["calls"] == 1
        return
    assert False, "a ValueError must propagate at once"
def test_tries_below_one():
    try:
        call_with_retry(lambda: "ok", tries=0)
    except ValueError:
        return
    assert False, "tries=0 must raise ValueError"
''',
             labels={
                 "test_success_first_try": {"fr": "Réussit du premier coup : un seul appel", "en": "Succeeds first time: a single call"},
                 "test_success_after_two_failures": {"fr": "Réussit après deux erreurs passagères", "en": "Succeeds after two passing errors"},
                 "test_delays_double": {"fr": "Les attentes doublent : 0,5 s puis 1 s", "en": "Waits double: 0.5 s then 1 s"},
                 "test_reraises_after_last_try": {"fr": "Relance l'erreur après le dernier essai", "en": "Re-raises after the last try"},
                 "test_no_sleep_after_last_try": {"fr": "N'attend pas après le dernier essai", "en": "Does not wait after the last try"},
                 "test_other_errors_not_retried": {"fr": "Une erreur définitive n'est pas réessayée", "en": "A permanent error is not retried"},
                 "test_tries_below_one": {"fr": "`tries=0` lève une `ValueError`", "en": "`tries=0` raises a `ValueError`"},
             },
             hints={"fr": ["`for attempt in range(1, tries + 1):` puis un `try / except TransientError`.", "Au dernier essai, `raise` sans argument relance l'erreur en cours.", "Attente : `base_delay * 2 ** (attempt - 1)`."],
                    "en": ["`for attempt in range(1, tries + 1):` then a `try / except TransientError`.", "On the last try, a bare `raise` re-raises the current error.", "Wait: `base_delay * 2 ** (attempt - 1)`."]},
             model='''import time

class TransientError(Exception):
    pass

def call_with_retry(fn, tries=3, base_delay=0.5, sleep=time.sleep):
    if tries < 1:
        raise ValueError("tries must be >= 1")
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except TransientError:
            if attempt == tries:
                raise
            sleep(base_delay * 2 ** (attempt - 1))
'''),
        dict(id="q2", type="text", prompt={"fr": "Dans quel cas ne faut-il pas réessayer un appel qui écrit (un paiement, un envoi d'e-mail) ? Comment s'en protéger ?", "en": "When must you not retry a call that writes (a payment, an email send)? How do you protect against it?"},
             concepts=[
                 {"label": {"fr": "Si l'action n'est pas idempotente, elle risque d'être faite deux fois", "en": "If the action is not idempotent, it may happen twice"}, "any": [r"idempoten", r"deux fois", r"twice", r"double"]},
                 {"label": {"fr": "Une clé unique par action, vérifiée avant d'agir", "en": "A unique key per action, checked before acting"}, "any": [r"cle (unique|d'idempotence)", r"idempotency.?key", r"unique (key|id)", r"identifiant unique", r"deja (fait|traite)", r"already (done|processed)"]},
             ],
             hints={"fr": ["Le délai dépassé prouve-t-il que l'action n'a pas eu lieu ?"], "en": ["Does a timeout prove the action did not happen?"]},
             model={"fr": "Quand l'action n'est pas idempotente : un délai dépassé ne prouve pas qu'elle a échoué, et le réessai peut payer ou envoyer deux fois. On s'en protège avec une clé d'idempotence unique par action, que le serveur vérifie avant d'agir.",
                    "en": "When the action is not idempotent: a timeout does not prove it failed, and the retry may pay or send twice. Protect against it with a unique idempotency key per action, checked by the server before acting."}),
    ],
)

drill(
    id="f5", cat="formats", order=5, minutes=20,
    title={"fr": "Valider une sortie structurée", "en": "Validate a structured output"},
    source={"fr": "Agents IA : un modèle doit répondre dans un format précis", "en": "AI agents: a model must answer in a precise format"},
    context={"fr": """Un modèle doit répondre avec un objet JSON déjà décodé en dictionnaire :

```python
{"paragraphs": [2, 1], "confidence": 0.8}
```

Contrat : `paragraphs` est une liste de 1 à 3 entiers, chacun au moins égal à 1 ; `confidence` est un nombre entre 0 et 1. Les bibliothèques comme Pydantic font ce travail, mais on veut d'abord savoir le faire à la main.""",
             "en": """A model must answer with a JSON object already decoded into a dict:

```python
{"paragraphs": [2, 1], "confidence": 0.8}
```

Contract: `paragraphs` is a list of 1 to 3 integers, each at least 1; `confidence` is a number between 0 and 1. Libraries like Pydantic do this job, but first we want to be able to do it by hand."""},
    mission={"fr": "Écrire un validateur qui liste toutes les erreurs, puis justifier le choix de refuser.", "en": "Write a validator that lists every error, then justify the choice to refuse."},
    criteria={"fr": ["Le validateur passe tous les tests.", "Le choix de refuser plutôt que réparer est justifié."], "en": ["The validator passes every test.", "Refusing rather than repairing is justified."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `validate_reply(data)`. Elle renvoie la liste des problèmes (vide si tout va bien). Utilise exactement ces messages : `\"paragraphs: missing\"`, `\"paragraphs: must be a list of 1 to 3 integers\"`, `\"paragraphs: numbers start at 1\"`, `\"confidence: missing\"`, `\"confidence: must be a number between 0 and 1\"`.",
                                           "en": "Write `validate_reply(data)`. It returns the list of problems (empty if all is well). Use exactly these messages: `\"paragraphs: missing\"`, `\"paragraphs: must be a list of 1 to 3 integers\"`, `\"paragraphs: numbers start at 1\"`, `\"confidence: missing\"`, `\"confidence: must be a number between 0 and 1\"`."},
             starter="def validate_reply(data):\n    problems = []\n    ...\n    return problems\n",
             tests=r'''
def test_valid():
    assert validate_reply({"paragraphs": [2, 1], "confidence": 0.8}) == []
def test_missing_both():
    assert validate_reply({}) == ["paragraphs: missing", "confidence: missing"]
def test_empty_list():
    assert "paragraphs: must be a list of 1 to 3 integers" in validate_reply({"paragraphs": [], "confidence": 0.5})
def test_too_long():
    assert "paragraphs: must be a list of 1 to 3 integers" in validate_reply({"paragraphs": [1, 2, 3, 4], "confidence": 0.5})
def test_zero():
    assert validate_reply({"paragraphs": [0], "confidence": 0.5}) == ["paragraphs: numbers start at 1"]
def test_string_instead_of_list():
    assert "paragraphs: must be a list of 1 to 3 integers" in validate_reply({"paragraphs": "1", "confidence": 0.5})
def test_bool_not_int():
    assert validate_reply({"paragraphs": [True], "confidence": 0.5}) == ["paragraphs: must be a list of 1 to 3 integers"]
def test_confidence_out_of_range():
    assert validate_reply({"paragraphs": [1], "confidence": 1.7}) == ["confidence: must be a number between 0 and 1"]
def test_confidence_not_number():
    assert validate_reply({"paragraphs": [1], "confidence": "high"}) == ["confidence: must be a number between 0 and 1"]
def test_all_problems_listed():
    assert len(validate_reply({"paragraphs": [0], "confidence": 2})) == 2
''',
             labels={
                 "test_valid": {"fr": "Une réponse valide ne donne aucun problème", "en": "A valid reply gives no problem"},
                 "test_missing_both": {"fr": "Les deux champs manquants sont signalés, dans l'ordre", "en": "Both missing fields are reported, in order"},
                 "test_empty_list": {"fr": "Une liste vide est refusée", "en": "An empty list is refused"},
                 "test_too_long": {"fr": "Plus de 3 numéros est refusé", "en": "More than 3 numbers is refused"},
                 "test_zero": {"fr": "`0` est refusé avec le bon message", "en": "`0` is refused with the right message"},
                 "test_string_instead_of_list": {"fr": "Une chaîne au lieu d'une liste est refusée", "en": "A string instead of a list is refused"},
                 "test_bool_not_int": {"fr": "`True` n'est pas un entier", "en": "`True` is not an integer"},
                 "test_confidence_out_of_range": {"fr": "Une confiance de 1,7 est refusée", "en": "A confidence of 1.7 is refused"},
                 "test_confidence_not_number": {"fr": "Une confiance en texte est refusée", "en": "A text confidence is refused"},
                 "test_all_problems_listed": {"fr": "Tous les problèmes sont listés, pas seulement le premier", "en": "Every problem is listed, not just the first"},
             },
             hints={"fr": ["Traite `paragraphs` puis `confidence`, chacun dans son bloc, sans `return` anticipé.", "`isinstance(True, int)` vaut `True` : vérifie `type(n) is int`.", "Pour la confiance : `type(c) in (int, float) and 0 <= c <= 1`."],
                    "en": ["Handle `paragraphs` then `confidence`, each in its own block, without returning early.", "`isinstance(True, int)` is `True`: check `type(n) is int`.", "For confidence: `type(c) in (int, float) and 0 <= c <= 1`."]},
             model='''def validate_reply(data):
    problems = []
    if "paragraphs" not in data:
        problems.append("paragraphs: missing")
    else:
        p = data["paragraphs"]
        if not isinstance(p, list) or not 1 <= len(p) <= 3 or any(type(n) is not int for n in p):
            problems.append("paragraphs: must be a list of 1 to 3 integers")
        elif any(n < 1 for n in p):
            problems.append("paragraphs: numbers start at 1")
    if "confidence" not in data:
        problems.append("confidence: missing")
    else:
        c = data["confidence"]
        if type(c) not in (int, float) or not 0 <= c <= 1:
            problems.append("confidence: must be a number between 0 and 1")
    return problems
'''),
        dict(id="q2", type="choice", prompt={"fr": "Le modèle renvoie `confidence: 1.7`. Que fait-on ?", "en": "The model returns `confidence: 1.7`. What do we do?"},
             options={"fr": ["On la ramène à 1 et on continue", "On refuse la réponse, on le trace, et on réessaie ou on passe à un humain", "On ignore le champ", "On divise par 10"], "en": ["Clamp it to 1 and carry on", "Refuse the reply, trace it, and retry or hand over to a human", "Ignore the field", "Divide by 10"]},
             answer=1, why={"fr": "Réparer en silence cache un modèle qui dérive. Refuser et tracer le rend visible.", "en": "Repairing silently hides a drifting model. Refusing and tracing makes it visible."}),
    ],
)

drill(
    id="f6", cat="formats", order=6, minutes=20,
    title={"fr": "Petit jeu d'évaluation", "en": "A small evaluation set"},
    source={"fr": "Black Monday 1987 : le test des 20 phrases d'un modèle de décision", "en": "Black Monday 1987: the 20-phrase test of a decision model"},
    context={"fr": """Pour évaluer un modèle de décision, on lui envoie chaque phrase deux fois et on note sa réponse. Chaque ligne de résultat ressemble à :

```python
{"phrase": "Sell everything", "run": 1, "expected": "sell", "action": "sell", "ms": 312}
```

`run` vaut 1 ou 2. Chaque phrase apparaît donc deux fois.""",
             "en": """To evaluate a decision model, each phrase is sent twice and its answer recorded. Each result row looks like:

```python
{"phrase": "Sell everything", "run": 1, "expected": "sell", "action": "sell", "ms": 312}
```

`run` is 1 or 2. Each phrase therefore appears twice."""},
    mission={"fr": "Calculer les trois mesures d'une évaluation honnête.", "en": "Compute the three measures of an honest evaluation."},
    criteria={"fr": ["Les trois mesures sont justes sur tous les jeux de test."], "en": ["All three measures are right on every test set."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `evaluate(rows)` qui renvoie un dictionnaire : `accuracy` (part des lignes où `action == expected`), `repeatability` (part des phrases dont les deux passages donnent la même action), `median_ms` (médiane de `ms` sur toutes les lignes).",
                                           "en": "Write `evaluate(rows)` returning a dict: `accuracy` (share of rows where `action == expected`), `repeatability` (share of phrases whose two runs give the same action), `median_ms` (median of `ms` over all rows)."},
             starter="def evaluate(rows):\n    ...\n",
             tests=r'''
ROWS = [
    {"phrase": "a", "run": 1, "expected": "sell", "action": "sell", "ms": 300},
    {"phrase": "a", "run": 2, "expected": "sell", "action": "sell", "ms": 310},
    {"phrase": "b", "run": 1, "expected": "buy", "action": "hold", "ms": 4000},
    {"phrase": "b", "run": 2, "expected": "buy", "action": "buy", "ms": 290},
]
def test_accuracy():
    assert abs(evaluate(ROWS)["accuracy"] - 0.75) < 1e-9
def test_repeatability():
    assert abs(evaluate(ROWS)["repeatability"] - 0.5) < 1e-9
def test_median_not_mean():
    assert evaluate(ROWS)["median_ms"] == 305
def test_odd_count_median():
    rows = ROWS[:2] + [{"phrase": "c", "run": 1, "expected": "x", "action": "x", "ms": 100}]
    assert evaluate(rows)["median_ms"] == 300
def test_perfect():
    rows = [{"phrase": p, "run": r, "expected": "x", "action": "x", "ms": 1} for p in "abc" for r in (1, 2)]
    out = evaluate(rows)
    assert out["accuracy"] == 1 and out["repeatability"] == 1
''',
             labels={
                 "test_accuracy": {"fr": "Justesse : 3 bonnes sur 4 = 0,75", "en": "Accuracy: 3 right out of 4 = 0.75"},
                 "test_repeatability": {"fr": "Répétabilité : 1 phrase stable sur 2 = 0,5", "en": "Repeatability: 1 stable phrase out of 2 = 0.5"},
                 "test_median_not_mean": {"fr": "Médiane 305 ms, pas la moyenne faussée par 4 000 ms", "en": "Median 305 ms, not the mean skewed by 4,000 ms"},
                 "test_odd_count_median": {"fr": "Médiane d'un nombre impair de valeurs", "en": "Median of an odd number of values"},
                 "test_perfect": {"fr": "Un modèle parfait donne 1 et 1", "en": "A perfect model gives 1 and 1"},
             },
             hints={"fr": ["`statistics.median` existe dans la bibliothèque standard.", "Pour la répétabilité, regroupe les actions par phrase dans un dictionnaire."],
                    "en": ["`statistics.median` is in the standard library.", "For repeatability, group actions by phrase in a dict."]},
             model='''from statistics import median

def evaluate(rows):
    accuracy = sum(r["action"] == r["expected"] for r in rows) / len(rows)
    by_phrase = {}
    for r in rows:
        by_phrase.setdefault(r["phrase"], set()).add(r["action"])
    repeatability = sum(len(actions) == 1 for actions in by_phrase.values()) / len(by_phrase)
    return {"accuracy": accuracy, "repeatability": repeatability, "median_ms": median(r["ms"] for r in rows)}
'''),
    ],
)

CSV = '''phrase,expected,action
Sell everything,sell,sell
Buy the dip,buy,buy
What do you think?,ask_advice,get_info
Show me the chart,get_info,get_info
Get me out,sell,hold'''

drill(
    id="f7", cat="formats", order=7, minutes=15,
    title={"fr": "Données sans pandas", "en": "Data without pandas"},
    source={"fr": "Black Monday 1987 : résultats du test d'un modèle", "en": "Black Monday 1987: a model's test results"},
    context={"fr": f"""Les résultats d'un test sont dans un CSV, reçu sous forme de texte :

```
{CSV}
```""", "en": f"""A test's results are in a CSV, received as text:

```
{CSV}
```"""},
    mission={"fr": "Calculer la précision par intention attendue, avec la seule bibliothèque standard.", "en": "Compute accuracy per expected intent, with the standard library only."},
    criteria={"fr": ["Le regroupement se fait par action attendue.", "Le résultat donne aussi l'effectif."], "en": ["Grouping is by expected action.", "The result also gives the count."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "Écris `accuracy_by_expected(csv_text)` qui renvoie un dictionnaire `{action_attendue: (bonnes_réponses, total)}`.", "en": "Write `accuracy_by_expected(csv_text)` returning a dict `{expected_action: (right_answers, total)}`."},
             starter="import csv, io\n\ndef accuracy_by_expected(csv_text):\n    ...\n",
             tests="CSV = '''" + CSV + "'''\n" + r'''
def test_sell():
    assert accuracy_by_expected(CSV)["sell"] == (1, 2)
def test_all_keys():
    assert set(accuracy_by_expected(CSV)) == {"sell", "buy", "ask_advice", "get_info"}
def test_zero_right():
    assert accuracy_by_expected(CSV)["ask_advice"] == (0, 1)
def test_header_only():
    assert accuracy_by_expected("phrase,expected,action") == {}
def test_quoted_comma():
    text = 'phrase,expected,action\n"Sell, now",sell,sell'
    assert accuracy_by_expected(text) == {"sell": (1, 1)}
''',
             labels={
                 "test_sell": {"fr": "`sell` : 1 bonne sur 2", "en": "`sell`: 1 right out of 2"},
                 "test_all_keys": {"fr": "Une entrée par action attendue", "en": "One entry per expected action"},
                 "test_zero_right": {"fr": "Une intention jamais reconnue donne `(0, 1)`", "en": "An intent never recognised gives `(0, 1)`"},
                 "test_header_only": {"fr": "Un CSV vide donne `{}`", "en": "An empty CSV gives `{}`"},
                 "test_quoted_comma": {"fr": "Une virgule entre guillemets ne casse pas la lecture", "en": "A quoted comma does not break parsing"},
             },
             hints={"fr": ["`csv.DictReader(io.StringIO(csv_text))` gère les guillemets pour toi.", "Garde deux compteurs, ou un dictionnaire de listes `[bonnes, total]`."],
                    "en": ["`csv.DictReader(io.StringIO(csv_text))` handles quotes for you.", "Keep two counters, or a dict of `[right, total]` lists."]},
             model='''import csv, io

def accuracy_by_expected(csv_text):
    counts = {}
    for row in csv.DictReader(io.StringIO(csv_text)):
        right, total = counts.get(row["expected"], (0, 0))
        counts[row["expected"]] = (right + (row["action"] == row["expected"]), total + 1)
    return counts
'''),
    ],
)

drill(
    id="f8", cat="formats", order=8, minutes=25,
    title={"fr": "Algorithmique de base", "en": "Algorithm basics"},
    source={"fr": "Les trois motifs les plus fréquents des tests en ligne junior", "en": "The three most frequent patterns in junior online tests"},
    context={"fr": "Trois exercices courts, comme dans un test en ligne. Avant d'écrire chaque fonction, dis à voix haute sa complexité.", "en": "Three short exercises, as in an online test. Before writing each function, say its complexity out loud."},
    mission={"fr": "Écrire trois fonctions correctes et efficaces.", "en": "Write three correct, efficient functions."},
    criteria={"fr": ["Les trois fonctions passent leurs tests.", "La complexité de chacune est connue."], "en": ["All three functions pass their tests.", "Each one's complexity is known."]},
    questions=[
        dict(id="q1", type="code", prompt={"fr": "`two_sum(nums, target)` renvoie le tuple des indices `(i, j)`, avec `i < j`, de deux nombres dont la somme vaut `target`, ou `None`. Vise un seul parcours de la liste.",
                                           "en": "`two_sum(nums, target)` returns the tuple of indices `(i, j)`, with `i < j`, of two numbers summing to `target`, or `None`. Aim for a single pass over the list."},
             starter="def two_sum(nums, target):\n    ...\n",
             tests=r'''
def test_basic():
    assert two_sum([2, 7, 11, 15], 9) == (0, 1)
def test_later():
    assert two_sum([3, 2, 4], 6) == (1, 2)
def test_same_value():
    assert two_sum([3, 3], 6) == (0, 1)
def test_none():
    assert two_sum([1, 2, 3], 100) is None
def test_large():
    nums = list(range(200_000))
    assert two_sum(nums, 399_997) == (199_998, 199_999)
''',
             labels={
                 "test_basic": {"fr": "`[2, 7, 11, 15]`, cible 9", "en": "`[2, 7, 11, 15]`, target 9"},
                 "test_later": {"fr": "La paire n'est pas au début", "en": "The pair is not at the start"},
                 "test_same_value": {"fr": "Deux fois la même valeur", "en": "The same value twice"},
                 "test_none": {"fr": "Aucune paire : `None`", "en": "No pair: `None`"},
                 "test_large": {"fr": "200 000 nombres : il faut un seul parcours", "en": "200,000 numbers: a single pass is needed"},
             },
             hints={"fr": ["Pour chaque nombre, le complément cherché est `target - n`.", "Un dictionnaire `valeur -> indice` répond en temps constant."], "en": ["For each number, the complement you need is `target - n`.", "A `value -> index` dict answers in constant time."]},
             model='''def two_sum(nums, target):
    seen = {}
    for j, n in enumerate(nums):
        if target - n in seen:
            return (seen[target - n], j)
        seen[n] = j
    return None
'''),
        dict(id="q2", type="code", prompt={"fr": "`is_balanced(s)` renvoie `True` si les parenthèses `()`, crochets `[]` et accolades `{}` de `s` sont bien imbriquées. Les autres caractères sont ignorés.",
                                           "en": "`is_balanced(s)` returns `True` if the parentheses `()`, brackets `[]` and braces `{}` in `s` are properly nested. Other characters are ignored."},
             starter="def is_balanced(s):\n    ...\n",
             tests=r'''
def test_simple():
    assert is_balanced("([]{})")
def test_wrong_order():
    assert not is_balanced("([)]")
def test_unclosed():
    assert not is_balanced("((")
def test_closing_first():
    assert not is_balanced(")(")
def test_ignores_text():
    assert is_balanced("f(x[0], {'a': 1})")
def test_empty():
    assert is_balanced("")
''',
             labels={
                 "test_simple": {"fr": "`([]{})` est équilibrée", "en": "`([]{})` is balanced"},
                 "test_wrong_order": {"fr": "`([)]` ne l'est pas", "en": "`([)]` is not"},
                 "test_unclosed": {"fr": "`((` ne l'est pas", "en": "`((` is not"},
                 "test_closing_first": {"fr": "`)(` ne l'est pas", "en": "`)(` is not"},
                 "test_ignores_text": {"fr": "Le texte autour est ignoré", "en": "Surrounding text is ignored"},
                 "test_empty": {"fr": "Une chaîne vide est équilibrée", "en": "An empty string is balanced"},
             },
             hints={"fr": ["Une pile : on empile à l'ouverture, on dépile et on compare à la fermeture.", "À la fin, la pile doit être vide."], "en": ["A stack: push on opening, pop and compare on closing.", "At the end, the stack must be empty."]},
             model='''def is_balanced(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in "([{":
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack
'''),
        dict(id="q3", type="code", prompt={"fr": "`first_at_least(sorted_nums, x)` renvoie l'indice du premier élément supérieur ou égal à `x` dans une liste triée, ou `len(sorted_nums)` s'il n'y en a pas. Sans parcourir toute la liste.",
                                           "en": "`first_at_least(sorted_nums, x)` returns the index of the first element greater than or equal to `x` in a sorted list, or `len(sorted_nums)` if there is none. Without walking the whole list."},
             starter="def first_at_least(sorted_nums, x):\n    ...\n",
             tests=r'''
def test_middle():
    assert first_at_least([1, 3, 5, 7], 4) == 2
def test_exact():
    assert first_at_least([1, 3, 5, 7], 5) == 2
def test_duplicates():
    assert first_at_least([1, 2, 2, 2, 3], 2) == 1
def test_none_bigger():
    assert first_at_least([1, 2], 10) == 2
def test_all_bigger():
    assert first_at_least([5, 6], 1) == 0
def test_empty():
    assert first_at_least([], 3) == 0
''',
             labels={
                 "test_middle": {"fr": "Au milieu de la liste", "en": "In the middle of the list"},
                 "test_exact": {"fr": "Valeur exacte présente", "en": "Exact value present"},
                 "test_duplicates": {"fr": "Avec doublons : le premier", "en": "With duplicates: the first one"},
                 "test_none_bigger": {"fr": "Rien d'assez grand : la longueur", "en": "Nothing big enough: the length"},
                 "test_all_bigger": {"fr": "Tout est plus grand : 0", "en": "Everything is bigger: 0"},
                 "test_empty": {"fr": "Liste vide : 0", "en": "Empty list: 0"},
             },
             hints={"fr": ["Recherche dichotomique : `lo, hi = 0, len(nums)`, et on coupe en deux tant que `lo < hi`.", "Le module `bisect` fait exactement ça, mais écris-la toi-même d'abord."], "en": ["Binary search: `lo, hi = 0, len(nums)`, and halve while `lo < hi`.", "The `bisect` module does exactly this, but write it yourself first."]},
             model='''def first_at_least(sorted_nums, x):
    lo, hi = 0, len(sorted_nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if sorted_nums[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo
'''),
        dict(id="q4", type="choice", prompt={"fr": "Quelle est la complexité de `two_sum` avec un dictionnaire ?", "en": "What is the complexity of `two_sum` with a dict?"},
             options={"fr": ["O(n²)", "O(n log n)", "O(n)", "O(log n)"], "en": ["O(n²)", "O(n log n)", "O(n)", "O(log n)"]},
             answer=2, why={"fr": "Un seul parcours, et chaque recherche dans le dictionnaire est en temps constant en moyenne.", "en": "A single pass, and each dict lookup is constant time on average."}),
    ],
)

drill(
    id="f9", cat="formats", order=9, minutes=10,
    title={"fr": "Raconter un bug de l'IA en 2 minutes", "en": "Tell an AI bug story in 2 minutes"},
    source={"fr": "Question d'entretien 2026 : « Racontez un bug introduit par l'IA »", "en": "2026 interview question: \"Tell us about a bug the AI introduced\""},
    context={"fr": "En 2026, presque tous les entretiens posent une question sur ton usage de l'IA. La meilleure réponse est une histoire vraie, courte, avec un chiffre. Choisis un bug introduit par un assistant IA dans un de tes projets.",
             "en": "In 2026, almost every interview asks about how you use AI. The best answer is a true story, short, with a number. Pick a bug an AI assistant introduced in one of your projects."},
    mission={"fr": "Écrire ton histoire en 5 à 8 phrases, puis l'entraîner à voix haute en moins de 2 minutes.", "en": "Write your story in 5 to 8 sentences, then practise it out loud in under 2 minutes."},
    criteria={"fr": ["L'histoire a les cinq temps : contexte, symptôme chiffré, détection, cause, ce que tu vérifies depuis."], "en": ["The story has all five beats: context, measured symptom, detection, cause, what you check since."]},
    questions=[
        dict(id="q1", type="text", prompt={"fr": "Écris ton histoire.", "en": "Write your story."},
             concepts=[
                 {"label": {"fr": "Le contexte : le projet, en une phrase", "en": "The context: the project, in one sentence"}, "any": [r"projet", r"project", r"agent", r"app", r"api", r"(sur|on) mon", r"bootcamp", r"hackathon"]},
                 {"label": {"fr": "Le symptôme, avec un chiffre", "en": "The symptom, with a number"}, "any": [r"\d"]},
                 {"label": {"fr": "Comment tu l'as détecté", "en": "How you spotted it"}, "any": [r"(j'ai |i )?(vu|remarque|detecte|repere|noticed|spotted|saw|found)", r"trace", r"log", r"grep", r"test", r"en (relisant|comparant)", r"by (reading|comparing)"]},
                 {"label": {"fr": "La cause", "en": "The cause"}, "any": [r"cause", r"parce que", r"because", r"alors que", r"\bwhile\b", r"assistant", r"en fait", r"actually", r"venait de", r"came from", r"l'ia (avait|a)", r"the ai (had|has)?"]},
                 {"label": {"fr": "Ce que tu vérifies depuis", "en": "What you check since"}, "any": [r"depuis", r"since", r"maintenant", r"now i", r"desormais", r"from then on", r"toujours", r"always"]},
             ],
             hints={"fr": ["Contexte, symptôme, comment tu l'as vu, cause, ce que tu vérifies depuis : une phrase chacun."], "en": ["Context, symptom, how you saw it, cause, what you check since: one sentence each."]},
             model={"fr": "Sur mon agent de recherche, un score est tombé à 4/10 après un changement censé l'améliorer. En relisant la commande du correcteur, j'ai vu qu'il lisait `agent.py`, alors que l'assistant avait copié la nouvelle version sous `agent-2.py` : je mesurais l'ancien code. Depuis, avant de lire un score, je vérifie quel fichier tourne, avec un `grep` sur une phrase propre à la nouvelle version.",
                    "en": "On my research agent, a score dropped to 4/10 after a change meant to improve it. Rereading the grader's command, I saw it read `agent.py`, while the assistant had copied the new version as `agent-2.py`: I was measuring the old code. Since then, before reading a score, I check which file runs, with a `grep` on a sentence unique to the new version."}),
    ],
)
