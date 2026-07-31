import { apiRequest } from "./apiService";

const CONVERSATIONS_ENDPOINT = "/conversations/";

// --- ТИПЫ (можно вынести в отдельный types/conversation.ts) ---
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

export interface PaginatedConversationsResponse {
  results: Conversation[];
  next: string | null;
  previous: string | null;
  count?: number;
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