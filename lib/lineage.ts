import type { TimelineEvent } from "./types";

/**
 * All events connected to `rootId` through relatedEventIds, in either
 * direction (ancestors, descendants, siblings via a shared parent, …).
 */
export function collectLineage(
  events: TimelineEvent[],
  rootId: string
): Set<string> {
  const byId = new Map(events.map((e) => [e.id, e]));
  if (!byId.has(rootId)) return new Set();

  const inbound = new Map<string, string[]>();
  for (const e of events) {
    for (const target of e.relatedEventIds ?? []) {
      const list = inbound.get(target);
      if (list) list.push(e.id);
      else inbound.set(target, [e.id]);
    }
  }

  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop()!;
    const outbound = byId.get(id)?.relatedEventIds ?? [];
    for (const next of [...outbound, ...(inbound.get(id) ?? [])]) {
      if (byId.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}
