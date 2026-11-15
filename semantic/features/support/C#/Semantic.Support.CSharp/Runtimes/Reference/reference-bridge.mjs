// The C# harness's `reference` runtime: concerto-core, driven over stdio.
//
// It makes the same calls as the JavaScript harness
// (semantic/features/support/Javascript/steps.ts and validate/validateSteps.js),
// so the C# steps can be checked against the reference implementation.
//
// Protocol: one JSON request per line on stdin, {id, op, ...}. Each reply is
// one line on stdout, prefixed with FRAME so that anything concerto-core
// logs can never be read as a reply:
//   {id, ok: true, value}
//   {id, ok: false, error: {class, message, errorType}}  the runtime threw
//   {id, ok: false, fatal: message}                      the bridge failed
//
// Usage: node reference-bridge.mjs <repository root>

import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FRAME = '\u0001concerto-bridge ';

// concerto-core logs through the console; keep stdout for replies.
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  console[level] = (...args) => process.stderr.write(args.join(' ') + '\n');
}

const root = process.argv[2];
if (!root) {
  process.stderr.write('usage: reference-bridge.mjs <repository root>\n');
  process.exit(2);
}
const resolve = createRequire(path.join(root, 'package.json')).resolve;
const { ModelManager, ModelFile, ModelLoader, Factory, Serializer } =
  await import(pathToFileURL(resolve('@accordproject/concerto-core')).href);

const sessions = new Map();
let nextSession = 1;

function session(id) {
  const manager = sessions.get(id);
  if (!manager) throw new BridgeError(`unknown session ${id}`);
  return manager;
}

class BridgeError extends Error {}

// The class name of an error, as the JavaScript harness's errorClass().
function errorClass(err) {
  return err?.name || err?.constructor?.name || typeof err;
}

const ops = {
  'session.create'({ options }) {
    // As world.ts: options only when the scenario gave some.
    const manager = Object.keys(options).length > 0 ? new ModelManager(options) : new ModelManager();
    const id = nextSession++;
    sessions.set(id, manager);
    return id;
  },

  // As loadModels() in steps.ts: stop at the first model that fails.
  'session.add'({ session: id, models, validate }) {
    const manager = session(id);
    for (const { fileName, json } of models) {
      const modelFile = new ModelFile(manager, JSON.parse(json), undefined, fileName);
      manager.addModelFile(modelFile, null, modelFile.getName(), !validate);
    }
    return null;
  },

  'session.validate'({ session: id }) {
    session(id).validateModelFiles();
    return null;
  },

  'session.dispose'({ session: id }) {
    sessions.delete(id);
    return null;
  },

  // As the When steps of validateSteps.js.
  async 'instance.validate'({ cto, instance, options }) {
    const manager = await ModelLoader.loadModelManager([cto], { offline: true });
    const serializer = new Serializer(new Factory(manager), manager);
    const object = serializer.fromJSON(JSON.parse(instance), options);
    serializer.toJSON(object, options);
    return null;
  },
};

function reply(message) {
  process.stdout.write(FRAME + JSON.stringify(message) + '\n');
}

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  if (line.trim() === '') continue;
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    reply({ id: null, ok: false, fatal: `bad request: ${err.message}` });
    continue;
  }
  const op = ops[request.op];
  if (!op) {
    reply({ id: request.id, ok: false, fatal: `unknown op ${request.op}` });
    continue;
  }
  try {
    reply({ id: request.id, ok: true, value: (await op(request)) ?? null });
  } catch (err) {
    if (err instanceof BridgeError) {
      reply({ id: request.id, ok: false, fatal: err.message });
    } else {
      reply({
        id: request.id,
        ok: false,
        error: { class: errorClass(err), message: String(err?.message ?? err), errorType: err?.errorType ?? null },
      });
    }
  }
}
