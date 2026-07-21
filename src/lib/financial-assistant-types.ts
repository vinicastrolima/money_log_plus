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
  history?: FinancialAssistantHistoryItem[];
}

export interface FinancialAssistantResponse {
  status: FinancialAssistantStatus;
  answer: string;
  highlights: string[];
  period: string;
  disclaimer: string;
}

export interface FinancialAssistantErrorResponse {
  error: string;
  code:
    | "invalid_request"
    | "unauthorized"
    | "forbidden"
    | "rate_limited"
    | "not_configured"
    | "service_unavailable";
}
