import type { AnyProps, UIElementDef } from './types';

const REGISTRY = new Map<string, UIElementDef>();

export function registerElement<P extends AnyProps>(def: UIElementDef<P>): void {
  if (REGISTRY.has(def.id)) throw new Error(`UI kit element "${def.id}" already registered`);
  REGISTRY.set(def.id, def as UIElementDef);
}

export function getElement(id: string): UIElementDef | undefined {
  return REGISTRY.get(id);
}

export function listElements(): UIElementDef[] {
  return [...REGISTRY.values()];
}
