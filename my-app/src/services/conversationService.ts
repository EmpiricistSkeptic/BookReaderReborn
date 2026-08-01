import { apiRequest } from "./apiService";

const CONVERSATIONS_ENDPOINT = "/conversations/";

// --- ТИПЫ ---
export enum ConversationMode {
  DEFAULT = "default",
  GRAMMAR = "grammar",
  VOCABULARY = "vocabulary",
  ROLEPLAY = "roleplay",
  CONVERSATION = "conversation",
  WRITING = "writing",
}

export interface Conversation {
  id: number | string;
  title?: string;
  mode: ConversationMode;
  last_message?: string;
  messages_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: number | string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  created_at?: string;
  [key: string]: any;
}

export interface PaginatedConversationsResponse {
  results: Conversation[];
  next: string | null;
  previous: string | null;
  count?: number;
}

// Новый интерфейс для пагинированного списка сообщений
export interface PaginatedMessagesResponse {
  results: Message[];
  next: string | null;
  previous: string | null;
}

// --- СЕРВИСЫ ---

export async function getConversations(page: number = 1) {
  return apiRequest<PaginatedConversationsResponse>(
    `${CONVERSATIONS_ENDPOINT}?page=${page}`
  );
}

export async function getConversationDetails(
  conversationId: number | string
) {
  return apiRequest<Conversation>(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/`
  );
}

/**
 * Получение списка сообщений конкретного диалога с поддержкой CursorPagination.
 * @param conversationId — ID диалога
 * @param cursorUrlOrToken — ссылка `next` от бэкенда или сам токен курсора
 */
export async function getConversationMessages(
  conversationId: number | string,
  cursorUrlOrToken?: string | null
) {
  let endpoint = `${CONVERSATIONS_ENDPOINT}${conversationId}/messages/`;

  if (cursorUrlOrToken) {
    if (cursorUrlOrToken.includes('?')) {
      const queryString = cursorUrlOrToken.split('?')[1];
      endpoint += `?${queryString}`;
    } else {
      endpoint += `?cursor=${encodeURIComponent(cursorUrlOrToken)}`;
    }
  }

  // 🔍 ЛОГ ЗАПРОСА
  console.log(`🌐 [API] Запрос сообщений -> ${endpoint}`);

  const data = await apiRequest<PaginatedMessagesResponse>(endpoint);

  // 🔍 ЛОГ ОТВЕТА
  console.log(`📥 [API] Получено сообщений: ${data?.results?.length ?? 0}, Есть ли еще (next cursor):`, Boolean(data?.next));

  return data;
}

/**
 * Создает новый разговор с указанным режимом обучения (default = "default")
 */
export async function createConversation(
  mode: ConversationMode | string = ConversationMode.DEFAULT
) {
  return apiRequest<Conversation>(
    CONVERSATIONS_ENDPOINT,
    "POST",
    { mode }
  );
}

export async function sendMessage(
  conversationId: number | string,
  message: string
) {
  return apiRequest<any>(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/send_message/`,
    "POST",
    { message }
  );
}

export async function deleteConversation(
  conversationId: number | string
): Promise<void> {
  await apiRequest(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/`,
    "DELETE"
  );
}