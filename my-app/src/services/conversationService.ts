import { apiRequest } from "./apiService";

const CONVERSATIONS_ENDPOINT = "/conversations/";

export async function getConversations(page: number = 1) {
  return apiRequest<unknown>(
    `${CONVERSATIONS_ENDPOINT}?page=${page}`
  );
}

export async function getConversationDetails(
  conversationId: number
) {
  return apiRequest<unknown>(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/`
  );
}

export async function createConversation() {
  return apiRequest<unknown>(
    CONVERSATIONS_ENDPOINT,
    "POST",
    {}
  );
}

export async function sendMessage(
  conversationId: number,
  message: string
) {
  return apiRequest<unknown>(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/send_message/`,
    "POST",
    { message }
  );
}

export async function deleteConversation(
  conversationId: number
): Promise<void> {
  await apiRequest(
    `${CONVERSATIONS_ENDPOINT}${conversationId}/`,
    "DELETE"
  );
}