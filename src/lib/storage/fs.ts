// Client-side file system access helpers
// Uses File System Access API when available, with a minimal IndexedDB fallback

export type DirectoryHandle = FileSystemDirectoryHandle;

const DB_NAME = "pm-local";
const DB_STORE = "handles";

export async function chooseDataDirectory(): Promise<DirectoryHandle> {
  if (!("showDirectoryPicker" in window)) {
    throw new Error("File System Access API not supported in this browser.");
  }
  // @ts-expect-error showDirectoryPicker is not in TS lib for all targets
  const handle: DirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  await verifyWritePermission(handle);
  await persistHandle(handle);
  return handle;
}

export async function getPersistedDirectory(): Promise<DirectoryHandle | null> {
  const db = await openDb();
  try {
    const value = await idbGet(db, "dataDir");
    return (value as DirectoryHandle | undefined) ?? null;
  } finally {
    db.close();
  }
}

export async function persistHandle(handle: DirectoryHandle): Promise<void> {
  const db = await openDb();
  try {
    await idbSet(db, "dataDir", handle);
  } finally {
    db.close();
  }
}

export async function readJson<T>(dir: DirectoryHandle, path: string, defaultValue: T): Promise<T> {
  try {
    const file = await getFileSafe(dir, path);
    if (!file) return defaultValue;
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch {
    return defaultValue;
  }
}

export async function writeJson<T>(dir: DirectoryHandle, path: string, value: T): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let current: DirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts[i]!;
    current = await current.getDirectoryHandle(name, { create: true });
  }
  const fileName = parts[parts.length - 1]!;
  const fileHandle = await current.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(value, null, 2));
  await writable.close();
}

async function getFileSafe(dir: DirectoryHandle, path: string): Promise<File | null> {
  const parts = path.split("/").filter(Boolean);
  let current: DirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(parts[i]!);
    } catch {
      return null;
    }
  }
  try {
    const fh = await current.getFileHandle(parts[parts.length - 1]!);
    return await fh.getFile();
  } catch {
    return null;
  }
}

async function verifyWritePermission(handle: DirectoryHandle): Promise<void> {
  // @ts-expect-error FileSystemHandlePermissionDescriptor is not in the default TS lib
  const opts = { mode: "readwrite" } as FileSystemHandlePermissionDescriptor;
  // @ts-expect-error queryPermission not in all TS lib targets
  const perm = await handle.queryPermission(opts);
  if (perm === "granted") return;
  // @ts-expect-error requestPermission not in all TS lib targets
  const req = await handle.requestPermission(opts);
  if (req !== "granted") throw new Error("Write permission not granted for chosen folder");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db: IDBDatabase, key: IDBValidKey, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function idbGet(db: IDBDatabase, key: IDBValidKey): Promise<unknown | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
