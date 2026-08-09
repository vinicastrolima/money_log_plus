export const FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH = 600;
export const FINANCIAL_ASSISTANT_MAX_HISTORY_ITEMS = 6;
export const FINANCIAL_ASSISTANT_MAX_HISTORY_LENGTH = 1_200;

export type FinancialAssistantStatus =
  | "answered"
  | "refused"
  | "insufficient_data";

export interface FinancialAssistantHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface FinancialAssistantRequest {
  question: string;
  conversationId?: string;
  /** @deprecated Histórico agora vem do banco; o campo é ignorado. */
  history?: FinancialAssistantHistoryItem[];
}

export interface FinancialAssistantResponse {
  status: FinancialAssistantStatus;
  answer: string;
  highlights: string[];
  period: string;
  disclaimer: string;
  conversationId?: string;
}

export interface FinancialAssistantConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string | null;
  highlights?: string[];
  period?: string | null;
  createdAt: string;
}

export interface FinancialAssistantConversationResponse {
  conversationId: string;
  messages: FinancialAssistantConversationMessage[];
}

export interface FinancialAssistantErrorResponse {
  error: string;
  code:
    | "invalid_request"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "rate_limited"
    | "not_configured"
    | "service_unavailable";
}
