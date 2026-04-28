// Provides an in-memory IndexedDB for tests. Attaches global `indexedDB`,
// `IDBKeyRange`, etc. so that idb / history storage code works under node.
import 'fake-indexeddb/auto';
