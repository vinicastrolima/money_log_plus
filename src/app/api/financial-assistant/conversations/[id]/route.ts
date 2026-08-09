import {
  type FinancialAssistantConversationMessage,
  type FinancialAssistantConversationResponse,
  type FinancialAssistantErrorResponse,
} from "@/lib/financial-assistant-types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGES = 100;

function errorResponse(
  status: number,
  body: FinancialAssistantErrorResponse
) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return errorResponse(400, {
      code: "invalid_request",
      error: "Identificador de conversa inválido.",
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

  const { data: conversation, error: conversationError } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (conversationError) {
    console.error("Failed to load conversation", conversationError.code);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "Não foi possível carregar a conversa agora.",
    });
  }

  if (!conversation) {
    return errorResponse(404, {
      code: "not_found",
      error: "Conversa não encontrada.",
    });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("assistant_messages")
    .select("id,role,content,status,highlights,period,created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);

  if (messagesError) {
    console.error("Failed to load conversation messages", messagesError.code);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "Não foi possível carregar as mensagens agora.",
    });
  }

  const mapped: FinancialAssistantConversationMessage[] = (messages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
    )
    .map((message) => ({
      id: String(message.id),
      role: message.role as "user" | "assistant",
      content: message.content,
      status: message.status ?? null,
      highlights: Array.isArray(message.highlights)
        ? message.highlights.filter((item): item is string => typeof item === "string")
        : [],
      period: message.period ?? null,
      createdAt: String(message.created_at),
    }));

  const payload: FinancialAssistantConversationResponse = {
    conversationId: id,
    messages: mapped,
  };

  return Response.json(payload, { headers: NO_STORE_HEADERS });
}
