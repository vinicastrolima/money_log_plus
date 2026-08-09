import { after } from "next/server";
import {
  extractMemoryFacts,
  loadActiveMemories,
  persistMemoryFacts,
} from "@/lib/financial-assistant-memory";
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
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  status: number,
  body: FinancialAssistantErrorResponse
) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function assistantResponse(body: FinancialAssistantResponse) {
  return Response.json(body, { headers: NO_STORE_HEADERS });
}

function refusedResponse(
  reason: "scope" | "injection",
  conversationId?: string
) {
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
    conversationId,
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

async function loadConversationHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string
): Promise<FinancialAssistantHistoryItem[] | null> {
  const { data: conversation, error: conversationError } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conversationError || !conversation) return null;

  const { data: messages, error: messagesError } = await supabase
    .from("assistant_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FINANCIAL_ASSISTANT_MAX_HISTORY_ITEMS);

  if (messagesError) {
    console.error("Failed to load conversation history", messagesError.code);
    return [];
  }

  return (messages ?? [])
    .reverse()
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, FINANCIAL_ASSISTANT_MAX_HISTORY_LENGTH),
    }));
}

async function ensureConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string | undefined,
  question: string
) {
  if (conversationId) {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data?.id) return data.id;
  }

  const title = question.slice(0, 80) || "Conversa";
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({
      user_id: userId,
      title,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error("CONVERSATION_CREATE_FAILED");
  }

  return data.id as string;
}

async function persistTurn(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  conversationId: string;
  question: string;
  response: FinancialAssistantResponse;
}) {
  const nowIso = new Date().toISOString();
  const { data: userMessage, error: userError } = await input.supabase
    .from("assistant_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: "user",
      content: input.question,
      created_at: nowIso,
    })
    .select("id")
    .single();

  if (userError) {
    console.error("Failed to persist user message", userError.code);
  }

  const { data: assistantMessage, error: assistantError } = await input.supabase
    .from("assistant_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: "assistant",
      content: input.response.answer,
      status: input.response.status,
      highlights: input.response.highlights,
      period: input.response.period,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (assistantError) {
    console.error("Failed to persist assistant message", assistantError.code);
  }

  const { error: conversationError } = await input.supabase
    .from("assistant_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("user_id", input.userId);

  if (conversationError) {
    console.error("Failed to update conversation", conversationError.code);
  }

  return {
    userMessageId: userMessage?.id as string | undefined,
    assistantMessageId: assistantMessage?.id as string | undefined,
  };
}

async function countUserTurns(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  userId: string
) {
  const { count, error } = await supabase
    .from("assistant_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .eq("role", "user");

  if (error) {
    console.error("Failed to count conversation turns", error.code);
    return 0;
  }

  return count ?? 0;
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
  const requestedConversationId = isUuid(body.conversationId)
    ? body.conversationId
    : undefined;

  if (
    question.length < 3 ||
    question.length > FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH
  ) {
    return errorResponse(400, {
      code: "invalid_request",
      error: `Escreva uma pergunta de 3 a ${FINANCIAL_ASSISTANT_MAX_QUESTION_LENGTH} caracteres.`,
    });
  }

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

  let history: FinancialAssistantHistoryItem[] = [];
  if (requestedConversationId) {
    const loaded = await loadConversationHistory(
      supabase,
      user.id,
      requestedConversationId
    );
    if (loaded === null) {
      return errorResponse(404, {
        code: "not_found",
        error: "Conversa não encontrada.",
      });
    }
    history = loaded;
  }

  const scope = assessFinancialScope(question, history);
  if (scope === "suspicious") {
    return refusedResponse("injection", requestedConversationId);
  }
  if (scope === "out_of_scope") {
    return refusedResponse("scope", requestedConversationId);
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
    const conversationId = await ensureConversation(
      supabase,
      user.id,
      requestedConversationId,
      question
    );

    const [{ lines: memoryLines, rows: memoryRows }, snapshot] =
      await Promise.all([
        loadActiveMemories(supabase, user.id),
        buildFinancialSnapshot(supabase, user.id),
      ]);

    const response = await analyzeFinancialSnapshot({
      question,
      history,
      snapshot,
      userId: user.id,
      memory: memoryLines,
    });

    const persisted = await persistTurn({
      supabase,
      userId: user.id,
      conversationId,
      question,
      response,
    });

    const payload: FinancialAssistantResponse = {
      ...response,
      conversationId,
    };

    if (response.status === "answered") {
      after(async () => {
        try {
          const turnCount = await countUserTurns(supabase, conversationId, user.id);
          if (turnCount % 3 !== 0) return;

          const facts = await extractMemoryFacts({
            question,
            answer: response.answer,
            existingKeys: memoryRows.map((row) => `${row.kind}:${row.key}`),
            userId: user.id,
          });

          if (!facts.length) return;

          await persistMemoryFacts(
            supabase,
            facts.map((fact) => ({
              ...fact,
              sourceMessageId: persisted.assistantMessageId ?? null,
            }))
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          console.error("Financial assistant memory extraction failed", message);
        }
      });
    }

    return assistantResponse(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Financial assistant request failed", message);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "Não foi possível concluir a análise agora. Tente novamente em instantes.",
    });
  }
}
