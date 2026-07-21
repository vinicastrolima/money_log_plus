# Money Log

Aplicação web para organizar finanças pessoais, acompanhar o orçamento do mês e controlar compras no cartão. O frontend roda em **Next.js** e os dados ficam no **Supabase**, protegidos por autenticação e políticas de Row Level Security (RLS).

## Funcionalidades

- Painel mensal com saldo, entradas, saídas e transações recentes.
- Calendário e lista de transações com filtros e busca.
- Entradas e saídas classificadas como previstas ou gastos diários.
- Status de pagamento: concluído, pendente ou atrasado.
- Orçamento diário com meta configurável e saldo acumulado.
- Categorias personalizadas com nome, cor e tipo.
- Cartões de crédito com limite, fechamento, vencimento, compras parceladas e assinaturas.
- Gráficos por categoria, tipo de gasto, período e cartão.
- Assistente financeiro com IA para analisar gastos, tendências e oportunidades de economia.
- Layout responsivo e instalável como PWA, com uma tela de aviso quando estiver offline.
- Tutorial integrado em cada área do aplicativo.

## Tecnologias

- [Next.js 16](https://nextjs.org/) com App Router e TypeScript
- [React 19](https://react.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) para PostgreSQL e autenticação
- [Recharts](https://recharts.org/) para os gráficos
- [Vercel](https://vercel.com/) para hospedagem do frontend

## Como a aplicação é hospedada

O projeto usa dois serviços, cada um com uma responsabilidade:

```text
Navegador
   │
   ├── Vercel   → aplicação Next.js
   │
   └── Supabase → banco PostgreSQL + autenticação
```

O schema do banco está versionado em [`supabase/schema.sql`](supabase/schema.sql). Não é necessário instalar PostgreSQL na sua máquina para usar o fluxo recomendado deste README.

## Pré-requisitos

Para executar localmente, você precisa de:

- [Git](https://git-scm.com/);
- [Node.js 20.9 ou superior](https://nodejs.org/);
- npm, incluído na instalação do Node.js;
- uma conta gratuita no [Supabase](https://supabase.com/).
- uma conta na [OpenAI Platform](https://platform.openai.com/) para habilitar o assistente financeiro.

Para publicar, você também precisa de:

- um repositório no [GitHub](https://github.com/), GitLab ou Bitbucket;
- uma conta na [Vercel](https://vercel.com/).

Confira as versões instaladas:

```bash
node --version
npm --version
git --version
```

## Executando localmente

### 1. Baixe o projeto e instale as dependências

```bash
git clone https://github.com/vinicastrolima/money_log_plus.git
cd money_log_plus
npm ci
```

Se estiver trabalhando em um fork, use a URL do seu próprio repositório no `git clone`.

### 2. Crie o projeto no Supabase

1. Acesse o [dashboard do Supabase](https://supabase.com/dashboard) e clique em **New project**.
2. Escolha a organização, o nome do projeto, uma senha forte para o banco e a região mais próxima dos usuários.
3. Aguarde o provisionamento do banco.
4. No menu do projeto, abra **SQL Editor** e crie uma nova consulta.
5. Copie todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql), cole no editor e clique em **Run**.
6. Confirme que a execução terminou sem erros.

O script cria:

- as tabelas `categories`, `transactions`, `settings`, `credit_cards`, `card_purchases` e `card_subscriptions`;
- índices e relacionamentos;
- políticas RLS para que cada pessoa acesse somente os próprios dados;
- um gatilho que cria as categorias iniciais e a meta diária de R$ 50 para cada novo usuário.

> Execute o schema **antes de criar a primeira conta no Money Log**. O gatilho de dados iniciais é acionado somente na criação de novos usuários.

### 3. Copie a URL e a chave pública do Supabase

No projeto do Supabase, abra o diálogo **Connect** ou acesse **Settings → API Keys**. Você precisará de:

- **Project URL**, semelhante a `https://abcdefgh.supabase.co`;
- **Publishable key**, que começa com `sb_publishable_...`.

Projetos mais antigos também podem mostrar uma chave legada chamada **anon**. As duas funcionam neste projeto. Apesar do nome da variável abaixo ainda conter `ANON_KEY`, prefira a nova **Publishable key**.

> Nunca use uma **Secret key** ou a chave `service_role`. Elas ignoram as políticas RLS e não podem ser expostas no navegador.

Se o projeto Supabase já existia antes da inclusão do assistente financeiro, execute também o arquivo [`supabase/migrations/20260720000000_financial_assistant_rate_limit.sql`](supabase/migrations/20260720000000_financial_assistant_rate_limit.sql) no **SQL Editor**. Ele cria apenas o controle de 20 análises por usuário a cada hora; perguntas, respostas e dados financeiros não são armazenados nessa tabela.

### 4. Configure as variáveis de ambiente

Na raiz do projeto, crie seu arquivo local a partir do exemplo:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e substitua os valores:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE_PUBLICA
OPENAI_API_KEY=sk-proj-SUA_CHAVE_OPENAI
OPENAI_FINANCIAL_MODEL=gpt-5-nano-2025-08-07
FINANCIAL_ASSISTANT_TIME_ZONE=America/Maceio
```

| Variável | Valor esperado |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key ou chave legada `anon` |
| `OPENAI_API_KEY` | Chave secreta da OpenAI, disponível somente no servidor |
| `OPENAI_FINANCIAL_MODEL` | Modelo do assistente; por padrão, o snapshot econômico `gpt-5-nano-2025-08-07` |
| `FINANCIAL_ASSISTANT_TIME_ZONE` | Fuso usado para determinar o mês atual; padrão `America/Maceio` |

O arquivo `.env.local` já está ignorado pelo Git. Não envie credenciais reais para o repositório. Em especial, nunca renomeie `OPENAI_API_KEY` para uma variável com prefixo `NEXT_PUBLIC_`.

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Na tela de login:

1. selecione **Criar conta**;
2. informe um e-mail e uma senha com pelo menos seis caracteres;
3. entre na conta;
4. crie uma transação para validar a conexão com o banco.

O schema atual confirma novos e-mails automaticamente para facilitar a instalação pessoal. Se quiser exigir confirmação por e-mail, remova do `handle_new_user()` o trecho que atualiza `auth.users.email_confirmed_at`, configure um provedor SMTP no Supabase e revise as URLs de autenticação descritas abaixo.

## Deploy com Supabase e Vercel

O Supabase deve estar configurado primeiro. A Vercel hospedará o frontend e se conectará ao projeto Supabase pelas duas variáveis de ambiente.

### 1. Prepare o Supabase

Se ainda não fez a configuração local, siga as etapas de criação do projeto e execute [`supabase/schema.sql`](supabase/schema.sql) no **SQL Editor**.

Antes de publicar, valide no **Table Editor** que as seis tabelas foram criadas. Em **Authentication → Providers**, confirme também que o provedor de e-mail está habilitado.

### 2. Envie o código para um repositório Git

Crie um repositório no seu provedor Git e envie a aplicação. Um exemplo com GitHub:

```bash
git init
git add .
git commit -m "Configura Money Log"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Se o projeto já tem um remote configurado, não execute `git init` nem adicione `origin` novamente; basta enviar sua branch normalmente.

### 3. Importe o projeto na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new).
2. Conecte seu provedor Git e selecione o repositório.
3. Mantenha o preset **Next.js** detectado automaticamente.
4. Use a raiz do repositório como **Root Directory**.
5. Abra **Environment Variables** e adicione:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_SUA_CHAVE_PUBLICA
OPENAI_API_KEY=sk-proj-SUA_CHAVE_OPENAI
OPENAI_FINANCIAL_MODEL=gpt-5-nano-2025-08-07
FINANCIAL_ASSISTANT_TIME_ZONE=America/Maceio
```

Marque pelo menos **Production**. Se quiser que deployments de pull requests também funcionem, marque **Preview**. Você pode usar o mesmo Supabase nos dois ambientes para uma instalação pessoal; em equipes, prefira projetos Supabase separados para não misturar dados de teste e produção.

As três variáveis do assistente não usam `NEXT_PUBLIC_` e ficam disponíveis apenas nas funções do servidor da Vercel.

6. Clique em **Deploy**.
7. Ao terminar, abra a URL gerada, semelhante a `https://seu-projeto.vercel.app`.

As variáveis que começam com `NEXT_PUBLIC_` são incorporadas durante o build. Se alterar qualquer uma delas em **Project → Settings → Environment Variables**, faça um novo deploy para aplicar a mudança.

### 4. Configure as URLs de autenticação no Supabase

No Supabase, abra **Authentication → URL Configuration** e configure:

- **Site URL:** a URL oficial de produção, por exemplo `https://seu-projeto.vercel.app`;
- **Redirect URLs:** adicione `http://localhost:3000/**` para desenvolvimento;
- adicione também a URL exata de produção, por exemplo `https://seu-projeto.vercel.app/**`.

Se usar confirmações de e-mail, login social ou previews da Vercel, inclua também o padrão de preview recomendado pelo Supabase:

```text
https://*-SEU-SLUG-DE-EQUIPE.vercel.app/**
```

Ao conectar um domínio próprio na Vercel, atualize a **Site URL** e acrescente o domínio à lista de redirects.

### 5. Valide o deploy

Faça um teste completo em produção:

1. crie uma conta nova;
2. confirme que as categorias iniciais aparecem;
3. adicione uma entrada e uma saída;
4. crie um cartão e uma compra;
5. saia da conta e entre novamente;
6. abra uma janela anônima para confirmar que as páginas privadas redirecionam para `/login`.

## Orçamento diário

O Money Log apresenta duas referências:

- **Meta diária:** valor configurável na página de categorias, inicialmente R$ 50 por dia.
- **Valor dinâmico:** saldo do mês dividido pelos dias restantes.

Somente saídas marcadas como **gasto diário** consomem a meta. A aplicação usa um modelo de envelope: o valor não gasto em um dia se acumula, enquanto o excesso reduz o disponível dos dias seguintes.

## Assistente financeiro

O botão **Pergunte à IA** aparece nas páginas autenticadas. Cada solicitação passa por validação de origem, sessão, tamanho, escopo financeiro e rate limiting antes de chamar a OpenAI.

O modelo não acessa o Supabase e não recebe ferramentas. O servidor calcula um resumo dos últimos 12 meses e envia somente valores agregados, nomes de categorias sanitizados e indicadores de orçamento. Descrições de transações, compras e assinaturas não são enviadas. Perguntas fora do domínio financeiro ou com sinais de prompt injection recebem uma resposta fixa sem consumir tokens da OpenAI.

O histórico existe somente no navegador durante a sessão aberta e é limitado às seis mensagens mais recentes em cada chamada. A API usa Structured Outputs, `store: false`, um identificador de segurança anonimizado e o snapshot fixo do `gpt-5-nano` por padrão.

### Estimativa de custo da IA

Em julho de 2026, o `gpt-5-nano` custa **US$ 0,05 por 1 milhão de tokens de entrada** e **US$ 0,40 por 1 milhão de tokens de saída**, conforme a [página oficial do modelo](https://developers.openai.com/api/docs/models/gpt-5-nano). Uma análise típica deste projeto, com cerca de 4.000 tokens de entrada e 300 de saída, custa aproximadamente **US$ 0,00032** — em torno de **US$ 0,32 a cada mil análises**. O valor real varia com o volume do histórico, dos dados e da resposta e não inclui Vercel, Supabase, impostos ou câmbio.

O limite de 20 análises por usuário a cada hora reduz abuso, mas não é um teto mensal de cobrança. Configure também um limite de uso no painel da OpenAI para controlar o orçamento total da conta.

## Scripts disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o ambiente de desenvolvimento em `localhost:3000` |
| `npm run build` | Gera o build otimizado de produção |
| `npm run start` | Executa localmente o build de produção |
| `npm run lint` | Verifica o código com ESLint |

Antes de enviar mudanças, execute:

```bash
npm run lint
npm run build
```

## Estrutura do projeto

```text
money_log_plus/
├── public/                  # ícones, service worker e página offline
├── src/
│   ├── app/
│   │   ├── (app)/          # páginas autenticadas
│   │   │   ├── calendario/
│   │   │   ├── cartoes/
│   │   │   ├── categorias/
│   │   │   ├── graficos/
│   │   │   └── lista/
│   │   └── login/          # cadastro e login
│   ├── components/         # interface e gerenciamento dos dados
│   ├── lib/                # regras de orçamento, cartões e Supabase
│   └── proxy.ts            # atualização de sessão e proteção de rotas
├── supabase/
│   └── schema.sql          # tabelas, índices, RLS e dados iniciais
├── .env.local.example      # modelo das variáveis locais
└── package.json            # dependências e scripts
```

## Segurança dos dados

- O app utiliza apenas a chave pública do Supabase.
- Todas as tabelas expostas têm RLS habilitado.
- As políticas comparam `auth.uid()` com `user_id`, isolando os dados de cada conta.
- As rotas privadas validam a sessão no servidor.
- `.env.local` e os demais arquivos `.env*` com valores reais não são versionados.

A chave pública pode ser vista no bundle do navegador — isso é esperado. A proteção dos dados depende das políticas RLS. Por esse motivo, não desative as políticas criadas pelo schema.

## Solução de problemas

### `relation ... does not exist` ou telas sem dados

O schema não foi executado, foi executado no projeto Supabase errado ou terminou com erro. Rode novamente todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) no **SQL Editor** e confira as tabelas no **Table Editor**.

### A conta foi criada, mas não existem categorias iniciais

Provavelmente o usuário foi criado antes da instalação do gatilho. Em um projeto novo e sem dados importantes, a solução mais simples é excluir esse usuário em **Authentication → Users**, executar o schema e criar a conta novamente.

### `Invalid API key`, `Failed to fetch` ou erro ao autenticar

Confira se a URL e a chave pertencem ao mesmo projeto Supabase. Remova espaços e aspas desnecessárias do `.env.local`, reinicie `npm run dev` e confirme que foi usada a chave pública, não a chave secreta.

### Funciona localmente, mas falha na Vercel

Confira as duas variáveis em **Vercel → Project → Settings → Environment Variables**, verifique se estão habilitadas para o ambiente correto e faça um novo deploy. Variáveis adicionadas depois de um deploy não alteram builds antigos.

### O link de confirmação abre a URL errada

Atualize **Authentication → URL Configuration** no Supabase. A **Site URL** deve ser o domínio de produção, e localhost/previews devem estar em **Redirect URLs**.

### O build falha

Use Node.js 20.9 ou superior, execute `npm ci` novamente e rode `npm run build` localmente para obter a mensagem completa. Na Vercel, consulte os logs do deployment que falhou.

## Documentação oficial

- [Supabase: autenticação com Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs)
- [Supabase: chaves de API](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel: Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel: variáveis de ambiente](https://vercel.com/docs/environment-variables)
