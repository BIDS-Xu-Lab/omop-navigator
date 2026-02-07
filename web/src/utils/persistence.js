import { openDB } from 'idb';

const DB_NAME = 'omop_navigator';
const DB_VERSION = 1;
const STORE_CONVERSATIONS = 'conversations';

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const store = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }

  return dbPromise;
}

export async function listConversations() {
  const db = await getDB();
  const all = await db.getAll(STORE_CONVERSATIONS);
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveConversation(conversation) {
  const db = await getDB();
  await db.put(STORE_CONVERSATIONS, conversation);
}

export async function deleteConversationById(conversationId) {
  const db = await getDB();
  await db.delete(STORE_CONVERSATIONS, conversationId);
}
