import type { Lang } from "./drills";

export interface LocalizedText { fr: string; en: string }
export interface LessonSequence {
  id: string;
  title: LocalizedText;
  objective: LocalizedText;
  explanation: LocalizedText;
  takeaway: LocalizedText;
}
export interface LessonQuestion {
  id: string;
  prompt: LocalizedText;
  options: [LocalizedText, LocalizedText, LocalizedText, LocalizedText];
  answer: number;
  hint: LocalizedText;
  feedback: LocalizedText;
  incorrectFeedback: LocalizedText;
  concept: LocalizedText;
}
export interface LessonResource { title: LocalizedText; href: string }
export interface CourseLesson {
  id: string;
  module: LocalizedText;
  title: LocalizedText;
  subtitle: LocalizedText;
  durationMinutes: number;
  objectives: LocalizedText[];
  prerequisites: LocalizedText;
  sequences: LessonSequence[];
  starterCode: string;
  checksCode: string;
  reflectionPrompt: LocalizedText;
  questions: LessonQuestion[];
  resources: LessonResource[];
  successCriteria: LocalizedText[];
}

export const MCP_PYTHON_LESSON: CourseLesson = {
  id: "mcp-python-server",
  module: { fr: "AI Engineering · Protocoles et outils", en: "AI Engineering · Protocols and tools" },
  title: { fr: "Construire ton premier serveur MCP en Python", en: "Build your first MCP server in Python" },
  subtitle: {
    fr: "Comprends le trajet d'un appel, expose un outil typé, puis vérifie sa logique et son intégration.",
    en: "Trace a tool call, expose a typed tool, then verify its logic and its integration.",
  },
  durationMinutes: 25,
  objectives: [
    { fr: "Distinguer l’hôte, le client MCP et le serveur.", en: "Distinguish the host, MCP client, and server." },
    { fr: "Enregistrer un outil Python documenté avec des types.", en: "Register a documented, typed Python tool." },
    { fr: "Vérifier le comportement et les limites d’entrée.", en: "Check behavior and input boundaries." },
  ],
  prerequisites: {
    fr: "Aucun prérequis MCP. Il est utile de savoir lire une fonction Python, ses paramètres et sa valeur de retour.",
    en: "No MCP experience required. It helps to be comfortable reading a Python function, its parameters, and its return value.",
  },
  sequences: [
    {
      id: "understand",
      title: { fr: "Comprendre MCP", en: "Understand MCP" },
      objective: { fr: "Suivre qui décide et qui exécute l’action.", en: "Trace who chooses an action and who executes it." },
      explanation: {
        fr: "MCP est un protocole qui donne à une application hôte un langage commun pour découvrir et utiliser les capacités d’un serveur. L’hôte est l’application IA. Son client MCP échange avec le serveur. Le serveur annonce des outils et exécute leur code quand le client lui transmet un appel. Le serveur ne parle pas directement au modèle.\n\nApplication IA / Hôte → Client MCP → Serveur MCP → Outil Python\n\nUne fonction Python locale ne devient pas automatiquement un outil : l’enregistrement auprès du serveur rend sa description et son schéma découvrables par les clients. Une API REST définit des routes HTTP propres à un service ; MCP standardise l’échange de capacités entre hôtes, clients et serveurs. Un serveur MCP peut utiliser HTTP, mais MCP n’est pas une route REST.",
        en: "MCP is a protocol that gives a host application a shared way to discover and use a server’s capabilities. The host is the AI application. Its MCP client communicates with the server. The server advertises tools and runs their code when the client sends a call. The server does not talk to the model directly.\n\nAI application / host → MCP client → MCP server → Python tool\n\nA local Python function does not become a tool by itself: registering it with a server makes its description and schema discoverable to clients. A REST API defines service-specific HTTP routes; MCP standardizes capability exchange between hosts, clients, and servers. An MCP server can use HTTP, but MCP is not a REST route.",
      },
      takeaway: {
        fr: "Analogie : l’hôte choisit une tâche, le client est l’interphone, le serveur est l’atelier qui présente ses outils et l’exécute. L’analogie s’arrête là : MCP définit des messages et des capacités, pas un lieu physique.",
        en: "Analogy: the host chooses a task, the client is the intercom, and the server is a workshop that presents and runs tools. The analogy ends there: MCP defines messages and capabilities, not a physical place.",
      },
    },
    {
      id: "example",
      title: { fr: "Voir un exemple fonctionnel", en: "Explore a working example" },
      objective: { fr: "Repérer le serveur, le décorateur, les types et l’appel client.", en: "Identify the server, decorator, types, and client call." },
      explanation: {
        fr: "Le fichier de référence associe `calculate_total` à `@mcp.tool()`. Le SDK utilise le nom, la docstring et les annotations pour exposer l’outil et son schéma. `Client(mcp)` permet de tester la découverte et l’appel sans lancer un processus ni ouvrir de port. Pour essayer le serveur avec MCP Inspector, utilise `uv run mcp dev src/learning/mcp_calculator.py`.",
        en: "The reference file registers `calculate_total` with `@mcp.tool()`. The SDK uses its name, docstring, and annotations to expose the tool and its schema. `Client(mcp)` tests discovery and calls without starting a process or opening a port. To inspect the server with MCP Inspector, run `uv run mcp dev src/learning/mcp_calculator.py`.",
      },
      takeaway: {
        fr: "Le code utilise MCP Python SDK v2.3.0. Les prix sont des nombres flottants pour cet exercice ; un système financier réel doit choisir explicitement une représentation décimale et une règle d’arrondi.",
        en: "This example uses MCP Python SDK v2.3.0. Floating-point values keep this exercise small; real financial software should choose a decimal representation and rounding policy explicitly.",
      },
    },
    {
      id: "practice",
      title: { fr: "Ajouter ton premier outil", en: "Add your first tool" },
      objective: { fr: "Compléter une fonction Python pure qui respecte le contrat annoncé.", en: "Complete a pure Python function that follows its stated contract." },
      explanation: {
        fr: "Complète la fonction pour qu’elle accepte un prix fini et non négatif ainsi qu’une quantité entière et non négative, puis retourne leur produit. Garde la fonction sans effet de bord. Les vérifications du navigateur portent uniquement sur cette fonction Python pure.",
        en: "Complete the function so it accepts a finite, non-negative price and a non-negative integer quantity, then returns their product. Keep the function free of side effects. The browser checks cover only this pure Python function.",
      },
      takeaway: {
        fr: "Limite de l’environnement : Pyodide ne lance pas le SDK MCP ni de serveur réseau. Réussir ces vérifications ne prouve donc pas l’intégration MCP ; celle-ci est contrôlée séparément par le test local du SDK.",
        en: "Runtime boundary: Pyodide does not run the MCP SDK or a network server. Passing these checks does not prove MCP integration; the SDK integration is checked separately by a local test.",
      },
    },
    {
      id: "test",
      title: { fr: "Tester et lire le feedback", en: "Test and read the feedback" },
      objective: { fr: "Interpréter les vérifications avant de modifier à nouveau le code.", en: "Interpret the checks before changing the code again." },
      explanation: {
        fr: "Lance les vérifications et lis les cas réussis ou à corriger. Elles couvrent un calcul courant, zéro, une limite et des entrées invalides. Si une vérification échoue, commence par comparer le contrat de la fonction et ses types avant de changer le calcul.",
        en: "Run the checks and review the passing and failing cases. They cover a normal calculation, zero, a boundary, and invalid inputs. If a check fails, compare the function contract and types before changing the calculation.",
      },
      takeaway: {
        fr: "Les tests exécutés ici vérifient la logique de calcul. Le test local `pytest` utilise en plus le vrai SDK pour découvrir l’outil MCP puis l’appeler en mémoire.",
        en: "The checks here verify calculation logic. The local `pytest` test additionally uses the real SDK to discover and call the MCP tool in memory.",
      },
    },
    {
      id: "assess",
      title: { fr: "Vérifier ta compréhension", en: "Check your understanding" },
      objective: { fr: "Relier les réponses à des preuves distinctes : code, choix et réflexion.", en: "Keep different evidence separate: code, answers, and reflection." },
      explanation: {
        fr: "Réponds aux quatre questions puis réfléchis au risque d’un outil qui peut modifier des données. Le score du quiz indique seulement les réponses données ici. Il ne certifie ni une compétence professionnelle ni la sécurité d’un système réel.",
        en: "Answer four questions, then reflect on the risk of a tool that can change data. The quiz score describes only the answers given here. It does not certify professional ability or the safety of a real system.",
      },
      takeaway: {
        fr: "Un outil MCP doit recevoir uniquement les permissions utiles. Valide les entrées côté serveur, limite les effets de bord, et demande une confirmation avant une action importante ou irréversible.",
        en: "An MCP tool should receive only the permissions it needs. Validate inputs server-side, limit side effects, and require confirmation before important or irreversible actions.",
      },
    },
    {
      id: "review",
      title: { fr: "Bilan et suite", en: "Review and next step" },
      objective: { fr: "Voir ce qui est terminé et choisir une action suivante concrète.", en: "See what is complete and choose a concrete next action." },
      explanation: {
        fr: "Ta progression distingue la leçon consultée, les tentatives, la réussite des tests avant la solution, les réponses au quiz et la réflexion. La solution consultée est enregistrée séparément et ne compte pas comme une réussite autonome.",
        en: "Your progress separates lesson visits, attempts, tests passed before viewing the solution, quiz answers, and reflection. Viewing the solution is recorded separately and does not count as an independent pass.",
      },
      takeaway: {
        fr: "Étape suivante : Connecter un client MCP à ton serveur — bientôt disponible. Pour aller plus loin localement, lance le serveur avec MCP Inspector et vérifie la découverte de l’outil.",
        en: "Next: Connect an MCP client to your server — coming soon. To explore locally, start the server with MCP Inspector and verify tool discovery.",
      },
    },
  ],
  starterCode: "def calculate_total(price: float, quantity: int) -> float:\n    # Validate the inputs and return the total\n    pass\n",
  checksCode: `def test_parameter_types():\n    annotations = calculate_total.__annotations__\n    assert annotations.get("price") is float\n    assert annotations.get("quantity") is int\n    assert annotations.get("return") is float\n\ndef test_normal_total():\n    assert calculate_total(12.5, 3) == 37.5\n\ndef test_zero_quantity():\n    assert calculate_total(12.5, 0) == 0\n\ndef test_zero_price():\n    assert calculate_total(0, 4) == 0\n\ndef test_fractional_price():\n    assert calculate_total(0.5, 3) == 1.5\n\ndef test_negative_price_is_rejected():\n    try:\n        calculate_total(-0.01, 2)\n    except ValueError:\n        return\n    raise AssertionError("negative price must be rejected")\n\ndef test_non_finite_or_overflowing_price_is_rejected():\n    for value in (float("nan"), float("inf"), 10**1000):\n        try:\n            calculate_total(value, 1)\n        except ValueError:\n            continue\n        raise AssertionError("non-finite price must be rejected")\n    try:\n        calculate_total(1e308, 2)\n    except ValueError:\n        return\n    raise AssertionError("overflowing total must be rejected")\n\ndef test_quantity_must_be_non_negative_integer():\n    for value in (-1, True, 1.5):\n        try:\n            calculate_total(2.0, value)\n        except ValueError:\n            continue\n        raise AssertionError("quantity must be a non-negative integer")\n`,
  reflectionPrompt: {
    fr: "Un agent propose d’utiliser un outil MCP qui envoie un paiement. Quelles vérifications et limites mettrais-tu en place avant d’autoriser cet outil ?",
    en: "An agent proposes using an MCP tool that sends a payment. What checks and limits would you put in place before enabling that tool?",
  },
  questions: [
    {
      id: "mcp-client-role",
      prompt: { fr: "Quel élément parle au modèle et choisit les outils à appeler ?", en: "Which component talks to the model and chooses which tools to call?" },
      options: [
        { fr: "La fonction Python seule", en: "The Python function by itself" },
        { fr: "Le serveur MCP, directement avec le modèle", en: "The MCP server, directly with the model" },
        { fr: "Le client MCP, dans l’application hôte", en: "The MCP client inside the host application" },
        { fr: "Le schéma de données uniquement", en: "The data schema alone" },
      ], answer: 2,
      hint: { fr: "Repère le composant situé dans l’application IA, entre le modèle et le serveur.", en: "Look for the component inside the AI application, between the model and the server." },
      feedback: { fr: "Le client MCP vit dans l’hôte et parle au serveur ; le serveur n’appelle pas lui-même le modèle.", en: "The MCP client lives in the host and speaks to the server; the server does not call the model itself." },
      incorrectFeedback: { fr: "Une fonction seule n’organise pas l’échange avec le modèle. Le serveur expose ses outils, tandis que le client MCP dans l’hôte gère l’échange avec le serveur et les appels choisis.", en: "A function alone does not coordinate the model exchange. The server exposes tools, while the MCP client in the host handles communication with the server and selected calls." },
      concept: { fr: "Rôle du client MCP dans l’hôte", en: "Role of the MCP client in the host" },
    },
    {
      id: "tool-discovery",
      prompt: { fr: "Comment un client sait-il quels outils un serveur expose ?", en: "How does a client learn which tools a server exposes?" },
      options: [
        { fr: "Le modèle invente le schéma au premier appel", en: "The model invents the schema on the first call" },
        { fr: "Les outils sont visibles uniquement dans MCP Inspector", en: "Tools are visible only in MCP Inspector" },
        { fr: "Le client lit les fichiers Python du serveur", en: "The client reads the server’s Python files" },
        { fr: "Le serveur publie ses capacités et répond à la découverte des outils", en: "The server advertises capabilities and responds to tool discovery" },
      ], answer: 3,
      hint: { fr: "La découverte fait partie de l’échange de capacités défini par le protocole.", en: "Discovery is part of the protocol’s capability exchange." },
      feedback: { fr: "La découverte MCP permet au client de demander la liste des outils et leurs schémas.", en: "MCP discovery lets a client request the list of tools and their schemas." },
      incorrectFeedback: { fr: "Le client n’a pas à lire les fichiers du serveur et l’inspecteur n’est pas le seul moyen de voir les outils. Le serveur annonce ses capacités via les échanges de découverte MCP.", en: "The client does not read server files, and Inspector is not the only way to view tools. The server advertises its capabilities through MCP discovery exchanges." },
      concept: { fr: "Découverte des outils", en: "Tool discovery" },
    },
    {
      id: "tool-input-validation",
      prompt: { fr: "Pourquoi vérifier `quantity` dans la fonction outil ?", en: "Why validate `quantity` inside the tool function?" },
      options: [
        { fr: "Pour convertir toute entrée en entier", en: "To convert every input into an integer" },
        { fr: "Pour appliquer le contrat avant le calcul et tout effet de bord", en: "To enforce the contract before calculation and side effects" },
        { fr: "Pour remplacer la découverte MCP", en: "To replace MCP discovery" },
        { fr: "Pour que le client n’ait pas besoin de schéma", en: "So the client does not need a schema" },
      ], answer: 1,
      hint: { fr: "Un schéma visible par le client ne remplace pas la validation lors de l’exécution.", en: "A schema visible to the client does not replace validation during execution." },
      feedback: { fr: "Le schéma aide le client, mais le serveur doit appliquer le contrat à la frontière d’exécution.", en: "A schema helps the client, but the server must enforce the contract at execution time." },
      incorrectFeedback: { fr: "Convertir toute entrée peut masquer une valeur invalide. Le serveur vérifie le contrat au moment de l’appel, avant le calcul ou tout effet de bord.", en: "Coercing every input can hide invalid values. The server checks the contract when the tool is called, before calculation or any side effect." },
      concept: { fr: "Validation au point d’exécution", en: "Validation at execution time" },
    },
    {
      id: "tool-safety",
      prompt: { fr: "Avant d’activer un outil qui peut modifier ou payer quelque chose, que faut-il faire ?", en: "Before enabling a tool that can change or pay for something, what should you do?" },
      options: [
        { fr: "Faire confiance au nom et à la docstring de l’outil", en: "Trust the tool name and docstring" },
        { fr: "Demander au modèle de vérifier lui-même ses permissions", en: "Ask the model to check its own permissions" },
        { fr: "Limiter les permissions, valider les entrées et confirmer l’action sensible", en: "Limit permissions, validate inputs, and confirm the sensitive action" },
        { fr: "Donner au serveur tous les accès pour éviter les erreurs", en: "Give the server broad access to avoid errors" },
      ], answer: 2,
      hint: { fr: "Réduis ce que l’outil peut faire et prévois une étape humaine pour les conséquences importantes.", en: "Limit what the tool can do and add a human step for consequential actions." },
      feedback: { fr: "Les permissions minimales et la confirmation réduisent les conséquences d’un mauvais appel.", en: "Least privilege and confirmation reduce the consequences of a bad tool call." },
      incorrectFeedback: { fr: "Un nom, une docstring ou la confiance dans le modèle ne constituent pas une protection. Limite les permissions, valide les entrées et demande confirmation pour les actions sensibles.", en: "A name, docstring, or trust in the model is not a safeguard. Limit permissions, validate inputs, and ask for confirmation before sensitive actions." },
      concept: { fr: "Permissions minimales et confirmation", en: "Least privilege and confirmation" },
    },
  ],
  resources: [
    { title: { fr: "Documentation du SDK Python MCP", en: "MCP Python SDK documentation" }, href: "https://py.sdk.modelcontextprotocol.io/" },
    { title: { fr: "Premiers pas : hôte, client et serveur", en: "First steps: host, client, and server" }, href: "https://py.sdk.modelcontextprotocol.io/get-started/first-steps/" },
    { title: { fr: "Tester un serveur MCP en mémoire", en: "Test an MCP server in memory" }, href: "https://py.sdk.modelcontextprotocol.io/get-started/testing/" },
  ],
  successCriteria: [
    { fr: "Les huit vérifications Python passent avant l’affichage de la solution.", en: "All eight Python checks pass before the solution is revealed." },
    { fr: "Les quatre réponses de compréhension sont correctes.", en: "All four comprehension answers are correct." },
    { fr: "Une réflexion sécurité a été enregistrée.", en: "A security reflection has been saved." },
  ],
};

export function lessonText(text: LocalizedText, lang: Lang): string { return text[lang]; }
