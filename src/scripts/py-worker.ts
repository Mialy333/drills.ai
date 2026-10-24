// Runs answers in real Python (Pyodide) off the main thread.
// Import the npm package through Vite; public/ assets must be fetched, not imported as source.
// The page can terminate this worker if an answer loops forever.

import { loadPyodide } from "pyodide";

type RunRequest = { id: number; base: string; code: string; tests: string };

const HARNESS = `
import json

MOCKS = '''
import sys
from types import ModuleType

# Mock Pydantic
pydantic_mock = ModuleType('pydantic')
class BaseModel:
    def __init__(self, **kwargs):
        for k, v in kwargs.items(): setattr(self, k, v)
    def model_dump(self): return self.__dict__
pydantic_mock.BaseModel = BaseModel
pydantic_mock.Field = lambda default=None, **kwargs: default
sys.modules['pydantic'] = pydantic_mock

# Mock FastAPI
fastapi_mock = ModuleType('fastapi')
class FastAPI:
    def __init__(self): self.routes = []
    def post(self, path): return lambda func: func
fastapi_mock.FastAPI = FastAPI
sys.modules['fastapi'] = fastapi_mock
'''

def __run(user_code, tests_code):
    out = {"error": None, "tests": []}
    ns = {"__name__": "answer"}
    try:
        exec(MOCKS, ns)
        exec(compile(user_code, "<your answer>", "exec"), ns)
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"
        return json.dumps(out)
    tns = dict(ns)
    tns["__user_code__"] = user_code
    try:
        exec(compile(tests_code, "<tests>", "exec"), tns)
    except Exception as e:
        out["error"] = f"{type(e).__name__}: {e}"
        return json.dumps(out)
    # Only the checker's own tests count: a test_ function from the answer is not one.
    for name, fn in list(tns.items()):
        if name.startswith("test_") and callable(fn) and fn is not ns.get(name):
            try:
                fn()
                out["tests"].append({"name": name, "ok": True})
            except AssertionError as e:
                out["tests"].append({"name": name, "ok": False, "msg": str(e) or "assertion failed"})
            except Exception as e:
                out["tests"].append({"name": name, "ok": False, "msg": f"{type(e).__name__}: {e}"})
    return json.dumps(out)
`;

let ready: Promise<any> | null = null;

function load(base: string) {
  if (!ready) {
    ready = (async () => {
      const py = await loadPyodide({ indexURL: `${base}pyodide/` });
      py.runPython(HARNESS);
      return py;
    })();
  }
  return ready;
}

self.onmessage = async (event: MessageEvent<RunRequest | { warm: string }>) => {
  const data = event.data;
  if ("warm" in data) {
    try {
      await load(data.warm);
      self.postMessage({ warm: true });
    } catch (e) {
      self.postMessage({ warm: false, error: String(e) });
    }
    return;
  }
  try {
    const py = await load(data.base);
    const run = py.globals.get("__run");
    const json = run(data.code, data.tests);
    run.destroy();
    self.postMessage({ id: data.id, result: JSON.parse(json) });
  } catch (e) {
    self.postMessage({ id: data.id, result: { error: String(e), tests: [] } });
  }
};
