import type { FinancialAssistantErrorResponse } from "@/lib/financial-assistant-types";
import { purgeAssistantMemory } from "@/lib/financial-assistant-memory";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function errorResponse(
  status: number,
  body: FinancialAssistantErrorResponse
) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
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

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return errorResponse(401, {
      code: "unauthorized",
      error: "Entre novamente para limpar a memória do assistente.",
    });
  }

  try {
    await purgeAssistantMemory(supabase);
    return Response.json(
      { ok: true },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Failed to purge assistant memory", message);
    return errorResponse(503, {
      code: "service_unavailable",
      error: "Não foi possível limpar a memória agora. Tente novamente.",
    });
  }
}
