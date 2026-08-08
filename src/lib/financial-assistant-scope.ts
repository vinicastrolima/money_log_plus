import type { FinancialAssistantHistoryItem } from "./financial-assistant-types";

const FINANCIAL_TERMS = [
  "gasto",
  "gastos",
  "despesa",
  "despesas",
  "receita",
  "receitas",
  "renda",
  "rendas",
  "entrada",
  "entradas",
  "saida",
  "saidas",
  "saldo",
  "orcamento",
  "categoria",
  "categorias",
  "cartao",
  "cartoes",
  "fatura",
  "faturas",
  "compra",
  "compras",
  "parcela",
  "parcelas",
  "assinatura",
  "assinaturas",
  "transacao",
  "transacoes",
  "pagamento",
  "pagamentos",
  "economizar",
  "economia",
  "economias",
  "poupar",
  "poupanca",
  "dinheiro",
  "custo",
  "custos",
  "fluxo de caixa",
  "meta diaria",
  "divida",
  "dividas",
  "ganho",
  "ganhos",
  "perda",
  "perdas",
  "mensal",
  "mes passado",
  "mes atual",
  "este mes",
  "desse mes",
  "nesse mes",
  "recorrente",
  "recorrentes",
  "previsto",
  "previstos",
  "pendente",
  "pendentes",
  "atrasado",
  "atrasados",
  "pago",
  "pagos",
  "financeiro",
  "financeira",
  "financas",
  "saude financeira",
  "situacao financeira",
  "panorama",
  "apanhado",
  "apunhado",
  "resumo",
  "visao geral",
  "overview",
  "reserva",
  "emergencia",
  "investimento",
  "investimentos",
  "money log",
  "moneylog",
  "spending",
  "expense",
  "income",
  "budget",
  "saving",
  "savings",
  "transaction",
  "credit card",
];

const INJECTION_PATTERNS = [
  /(?:ignore|disregard|forget|desconsidere).{0,50}(?:instructions?|instruco(?:es|ao)|regras?|prompts?|mensagens?|sistema|developer)/,
  /(?:revele|mostre|exiba|vaze|reveal|show).{0,50}(?:prompt do sistema|system prompt|api key|chave|segredo|secret|instrucao interna)/,
  /(?:jailbreak|developer mode|modo desenvolvedor|modo dan|\bdan\b)/,
  /(?:execute|rode|run).{0,30}(?:sql|shell|codigo|code|comando)/,
  /(?:finja|pretenda|act as).{0,30}(?:sem regras|unrestricted|developer|sistema)/,
  /\b(?:system|developer|assistant)\s*:/,
];

const FOLLOW_UP_PATTERNS = [
  /^(?:e|mas|agora|tambem|entao)\b/,
  /\b(?:anterior|passado|passada|comparar|comparacao|por que|porque|quanto|qual|quais)\b/,
];

export type ScopeAssessment = "allowed" | "out_of_scope" | "suspicious";

export function normalizeForScope(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function hasPromptInjectionSignals(value: string) {
  const normalized = normalizeForScope(value);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function containsFinancialTerm(value: string) {
  const normalized = normalizeForScope(value);
  return FINANCIAL_TERMS.some((term) => normalized.includes(term));
}

export function assessFinancialScope(
  question: string,
  history: FinancialAssistantHistoryItem[]
): ScopeAssessment {
  if (
    hasPromptInjectionSignals(question) ||
    history.some((item) => hasPromptInjectionSignals(item.content))
  ) {
    return "suspicious";
  }
  if (containsFinancialTerm(question)) return "allowed";

  const lastUserQuestion = [...history]
    .reverse()
    .find((item) => item.role === "user")?.content;
  const normalizedQuestion = normalizeForScope(question);
  const looksLikeFollowUp =
    normalizedQuestion.length <= 120 &&
    FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalizedQuestion));

  if (
    looksLikeFollowUp &&
    lastUserQuestion &&
    !hasPromptInjectionSignals(lastUserQuestion) &&
    containsFinancialTerm(lastUserQuestion)
  ) {
    return "allowed";
  }

  return "out_of_scope";
}

export function sanitizeFinancialLabel(value: string | null | undefined) {
  if (!value) return "Sem categoria";
  if (hasPromptInjectionSignals(value)) return "Categoria personalizada";

  const sanitized = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>\[\]{}\x60]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);

  return sanitized || "Sem categoria";
}
