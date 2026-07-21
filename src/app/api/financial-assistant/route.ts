import { analyzeFinancialSnapshot } from "@/lib/financial-assistant-openai";
import { assessFinancialScope } from "@/lib/financial-assistant-scope";
import { buildFinancialSnapshot } from "@/lib/financial-assistant-summary";
import {
  FINANCIAL_ASSISTANT_MAX_HISTORY_ITEMS,
  FINANCIAL_ASSISTANT_MAX_HISTORY_LENGTH,
  FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH,
  type FinancialAssistantErrorResponse,
  type FinancialAssistantHistoryItem,
  type FinancialAssistantResponse,
} from "@/lib/financial-assistant-types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_384;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const DISCLAIMER =
  "Análise informativa baseada nos dados registrados. Não substitui orientação financeira profissional.";

function errorResponse(
  status: number,
  body: FinancialAssistantErrorResponse
) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function assistantResponse(body: FinancialAssistantResponse) {
  return Response.json(body, { headers: NO_STORE_HEADERS });
}

function validateHistory(value: unknown): FinancialAssistantHistoryItem[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > FINANCIAL_ASSISTANT_MAX_HISTORY_ITEMS) {
    return null;
  }

  const history: FinancialAssistantHistoryItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (
      (role !== "user" && role !== "assistant") ||
      typeof content !== "string" ||
      content.length > FINANCIAL_ASSISTANT_MAX_HISTORY_LENGTH
    ) {
      return null;
    }
    const trimmed = content.trim();
    if (trimmed) history.push({ role, content: trimmed });
  }

  return history;
}

function refusedResponse(reason: "scope" | "injection") {
  const answer =
    reason === "injection"
      ? "Não posso seguir instruções que tentem alterar as regras do assistente. Posso ajudar com análises dos seus gastos, receitas, cartões e orçamento."
      : "Posso ajudar somente com perguntas relacionadas aos seus dados financeiros no Money Log.";

  return assistantResponse({
    status: "refused",
    answer,
    highlights: [],
    period: "Não aplicável",
    disclaimer: DISCLAIMER,
  });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return errorResponse(403, {
      code: "forbidden",
      error: "Origem da requisição não permitida.",
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, {
      code: "invalid_request",
      error: "Envie a pergunta em formato JSON.",
    });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, {
      code: "invalid_request",
      error: "A solicitação excede o tamanho permitido.",
    });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return errorResponse(400, {
      code: "invalid_request",
      error: "Não foi possível interpretar a solicitação.",
    });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = validateHistory(body.history);
  if (
    question.length < 3 ||
    question.length > FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH ||
    history === null
  ) {
    return errorResponse(400, {
      code: "invalid_request",
      error: `Escreva uma pergunta de 3 a ${FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH} caracteres.`,
    });
  }

  const scope = assessFinancialScope(question, history);
  if (scope === "suspicious") return refusedResponse("injection");
  if (scope === "out_of_scope") return refusedResponse("scope");

  if (!process.env.OPENAI_API_KEY) {
    return errorResponse(503, {
      code: "not_configured",
      error: "O assistente financeiro ainda não foi configurado.",
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return errorResponse(401, {
      code: "unauthorized",
      error: "Entre novamente para usar o assistente financeiro.",
    });
  }

  const { data: quotaAccepted, error: quotaError } = await supabase.rpc(
    "consume_financial_assistant_quota"
  );
  if (quotaError) {
    console.error("Financial assistant rate limit unavailable", quotaError.code);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "A proteção de uso do assistente ainda não foi configurada.",
    });
  }
  if (quotaAccepted !== true) {
    return errorResponse(429, {
      code: "rate_limited",
      error: "Você atingiu o limite de 20 análises por hora. Tente novamente mais tarde.",
    });
  }

  try {
    const snapshot = await buildFinancialSnapshot(supabase, user.id);
    const response = await analyzeFinancialSnapshot({
      question,
      history,
      snapshot,
      userId: user.id,
    });
    return assistantResponse(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Financial assistant request failed", message);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "Não foi possível concluir a análise agora. Tente novamente em instantes.",
    });
  }
}
