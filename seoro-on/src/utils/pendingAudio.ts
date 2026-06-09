// IndexedDB 기반 임시 오디오 보관소
// localStorage는 Blob 저장이 안 되므로 IndexedDB 사용
// 키 접두사: seoro_on_pending_audio (팀 내 충돌 방지)

const DB_NAME = 'seoro_on_pending_audio';
const STORE_NAME = 'pending';
const DB_VERSION = 1;

export type PendingAudioItem = {
  id: string;         // `${userId}_${questionId}_${timestamp}`
  userId: string;
  questionId: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;  // ISO string
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingAudio(item: PendingAudioItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPendingAudio(): Promise<PendingAudioItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as PendingAudioItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingAudio(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
