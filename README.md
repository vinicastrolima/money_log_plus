# Controle Financeiro Web

App pessoal de controle financeiro com visão de **calendário mensal**, **lista**, **categorias**, **gráficos** de gastos e um sistema de **orçamento diário** (meta de R$50/dia com acúmulo/envelope + valor dinâmico saldo÷dias).

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS v4
- **Banco + Auth:** Supabase (PostgreSQL + Supabase Auth, login por email/senha)
- **Gráficos:** Recharts
- **Deploy:** Vercel (`seu-projeto.vercel.app`)

## Funcionalidades

- Registrar entradas (+) e saídas (−) por dia, com categoria.
- Checkbox **"É gasto diário?"** ao lançar uma saída:
  - **marcado** = gasto do dia a dia (consome o limite de R$/dia);
  - **desmarcado** = conta prevista/fixa (dívida, cartão...), fora do limite diário.
- **Painel:** saldo, entradas, saídas e o orçamento diário.
- **Calendário:** clique no dia para ver/adicionar transações; indicador de gasto diário.
- **Lista:** filtros por mês, categoria, tipo (prevista/diária) e direção + busca.
- **Gráficos:** pizza por categoria, comparativo prevista × diária e movimentação por dia.
- **Categorias:** CRUD com cores + ajuste da meta diária.

## Como o orçamento diário funciona

- **Meta fixa:** `R$50/dia` (configurável em Categorias).
- **Envelope com acúmulo:** `permitido até hoje = meta × dias decorridos`; subtrai os gastos marcados como "diária". Se sobrar, acumula para os próximos dias; se ficar negativo, você estourou.
- **Valor dinâmico:** `saldo do mês ÷ dias restantes` — mostrado lado a lado com a meta para você saber quanto realmente pode gastar por dia.

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No painel, vá em **SQL Editor** e rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql). Isso cria as tabelas, as políticas de segurança (RLS) e um gatilho que popula categorias iniciais e a meta padrão a cada novo usuário.
3. Em **Authentication → Providers → Email**, mantenha o provedor Email habilitado. Para testar mais rápido, você pode desativar "Confirm email" em **Authentication → Sign In / Providers** (opcional).
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

## Rodando localmente

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.local.example .env.local
# edite .env.local com sua URL e anon key do Supabase

# 3. Rode em desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`, crie sua conta na tela de login e comece a lançar.

### Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key do Supabase |

## Deploy na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), clique em **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. O app ficará disponível em `https://seu-projeto.vercel.app`.
5. (Opcional) Em **Supabase → Authentication → URL Configuration**, adicione a URL da Vercel em **Site URL** / **Redirect URLs**.

## Estrutura

```
src/
  app/
    login/                 # tela de login
    (app)/                 # área autenticada (protegida via proxy.ts)
      page.tsx             # Painel
      calendario/          # Calendário mensal
      lista/               # Lista com filtros
      graficos/            # Gráficos (Recharts)
      categorias/          # CRUD de categorias + meta diária
  components/              # UI, provider de dados, modal de transação, nav
  lib/
    budget.ts             # cálculo do orçamento diário
    supabase/             # clients (browser/server) e sessão
    types.ts, utils.ts
supabase/schema.sql       # schema + RLS + seed
```
