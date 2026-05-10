import { Action, Context } from "./actions.js";
import { ActionBus } from "./ActionBus.js";
import { ContextStack } from "./ContextStack.js";
import { InputMapper } from "./InputMapper.js";

export { Action, Context, ActionBus, ContextStack, InputMapper };

// Convenience setup: fetches keybindings from backend, wires everything up.
// Returns { bus, stack, mapper }.
export async function initInput(apiBase = "/api") {
  const res = await fetch(`${apiBase}/keybindings`);
  if (!res.ok) throw new Error(`failed to load keybindings: ${res.status}`);
  const bindings = await res.json();

  const bus = new ActionBus();
  const stack = new ContextStack([Context.GAME]);
  const mapper = new InputMapper({ bindings, bus, contextStack: stack });

  return { bus, stack, mapper, bindings };
}
