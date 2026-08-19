// Platform adapter registry.
// An adapter is a plain object implementing:
//   id                        string, unique
//   matches(url)              -> boolean: is this platform / page supported?
//   findSelectableItems(doc)  -> Element[]: the clickable tag elements
//   extractItem(el)           -> {id, label, kind, value} | null
//   buildSearchUrl(items)     -> string | null: combined search for ALL items
// Adding a platform later = one new folder under src/adapters + one
// registerAdapter call. The core never contains platform-specific logic.

window.MSQ = window.MSQ || {};

MSQ.adapters = MSQ.adapters || [];

MSQ.registerAdapter = MSQ.registerAdapter || function (adapter) {
  if (MSQ.adapters.some((a) => a.id === adapter.id)) return; // re-injection guard
  MSQ.adapters.push(adapter);
};

MSQ.findAdapter = MSQ.findAdapter || function (url) {
  return MSQ.adapters.find((a) => {
    try {
      return a.matches(url);
    } catch (err) {
      MSQ.warn('adapter matches() threw', a.id, err);
      return false;
    }
  }) || null;
};
