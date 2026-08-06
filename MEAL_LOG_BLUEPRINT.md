# Meal Log — visão do produto, arquitetura e roadmap

Este documento resume a estrutura do **Money Log** e a utiliza como referência para o planejamento de um novo aplicativo voltado ao acompanhamento de alimentação, treinos e evolução corporal.

## Recomendação executiva

A stack recomendada para o Meal Log é:

- Laravel 13;
- Inertia 3;
- Vue 3 com Composition API;
- TypeScript;
- Tailwind CSS 4;
- Vite;
- PostgreSQL;
- Pest para testes de backend;
- Vitest e, posteriormente, Playwright para os fluxos críticos do frontend;
- Laravel Cloud para hospedagem, banco, domínio e deploy automático.

Essa combinação permite construir um **monólito real**: um repositório, uma autenticação, um backend, um frontend, um domínio e um pipeline de deploy.

O Laravel fica responsável pelas rotas, sessões, autorização, validação, regras de negócio, banco, arquivos, filas e entrega das páginas. O Vue fornece a experiência interativa, o Inertia conecta as duas camadas sem exigir uma API separada e o Vite compila os assets do frontend.

## Vite, Vercel e PHP

A Vercel hospeda muito bem um frontend Vue criado com Vite. Ao conectar o repositório Git, cada push pode gerar um novo deployment, e branches ou pull requests podem receber URLs de preview.

Referências oficiais:

- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Deploys automáticos com Git na Vercel](https://vercel.com/docs/git)

Entretanto, existem algumas diferenças importantes:

- Vite é um compilador e servidor de desenvolvimento; ele não substitui o servidor PHP.
- Em produção, Vite gera arquivos JavaScript, CSS e outros assets otimizados.
- Se somente esses arquivos forem publicados na Vercel, o resultado será apenas o frontend estático.
- O PHP, a autenticação, o banco, os uploads, as filas e as regras de negócio ainda precisarão rodar em outro ambiente.
- A Vercel oferece PHP por meio de um runtime comunitário no modelo de Functions, e não como o ambiente tradicional mais adequado a um monólito Laravel.

Referência: [Runtimes da Vercel](https://vercel.com/docs/functions/runtimes).

### Comparação das opções

| Arquitetura | Resultado | Avaliação |
| --- | --- | --- |
| Vue/Vite na Vercel e Laravel em outro host | Dois projetos, deploys e origens | Funciona, mas deixa de ser monólito |
| Laravel, Vue e Vite na Vercel | PHP por runtime comunitário/serverless | Possível, mas não recomendado para este caso |
| Laravel, Inertia, Vue e Vite no Laravel Cloud | Um projeto, domínio e deploy | Opção recomendada |
| Laravel em VPS gerenciado pelo Forge | Controle e custo previsível | Boa opção, com mais administração |

O Laravel Cloud oferece push-to-deploy, infraestrutura PHP, domínio customizado e SSL. O fluxo fica tão simples quanto o desejado na Vercel, mas dentro de um ambiente preparado especificamente para Laravel.

- [Deploys no Laravel Cloud](https://cloud.laravel.com/docs/deployments)
- [Domínios customizados no Laravel Cloud](https://cloud.laravel.com/docs/domains)

---

# 1. Resumo do Money Log

O Money Log é um aplicativo pessoal de controle financeiro construído com uma arquitetura orientada a páginas. A descrição funcional atual está no [README](README.md), e o modelo do banco está versionado em [supabase/schema.sql](supabase/schema.sql).

## Stack atual

- Next.js 16 com App Router;
- React 19;
- TypeScript;
- Tailwind CSS 4;
- Supabase para PostgreSQL e autenticação;
- Recharts para visualizações;
- OpenAI para o assistente financeiro;
- Vercel para hospedagem da aplicação Next.js;
- PWA com manifest, service worker e tela offline.

## Arquitetura atual

```text
Navegador
   │
   ├── Next.js/Vercel
   │     ├── Interface React
   │     ├── Proteção das páginas
   │     └── Endpoint do assistente financeiro
   │
   ├── Supabase
   │     ├── PostgreSQL
   │     ├── Autenticação
   │     └── Row Level Security
   │
   └── OpenAI
         └── Análise financeira agregada
```

## Principais características estruturais

- Layout autenticado compartilhado;
- Sidebar no desktop e navegação inferior no celular;
- Contexto global `DataProvider` para carregamento e manipulação dos dados;
- Componentes reutilizáveis de botão, modal, card, cabeçalho e empty state;
- Funções puras para cálculos financeiros;
- Banco protegido para que cada usuário acesse somente os próprios dados;
- Schema e migrations versionados;
- Interface responsiva e instalável como PWA;
- Tutorial contextual nas páginas;
- Assistente financeiro com proteção de escopo e limite de uso.

## Principais telas

- Painel mensal;
- Calendário financeiro;
- Lista de transações;
- Gráficos;
- Cartões;
- Categorias;
- Login e criação de conta.

## Modelo de negócio

O núcleo do Money Log gira em torno de:

- transações;
- categorias;
- regras de recorrência;
- cartões;
- compras parceladas;
- assinaturas;
- configurações do usuário;
- consultas ao assistente financeiro.

O padrão mais interessante do projeto é a transformação de registros simples em indicadores úteis:

```text
Transações
    ↓
Resumo do mês
    ↓
Saldo e orçamento disponível
    ↓
Gráficos, calendário e alertas
```

Esse mesmo raciocínio pode ser aplicado ao Meal Log:

```text
Alimentos + refeições + treinos
    ↓
Totais diários
    ↓
Metas nutricionais + execução dos treinos
    ↓
Adesão, evolução e tendências
```

## O que aproveitar no Meal Log

- Navegação mobile-first;
- Dashboard com resumo do período;
- Calendário como visão transversal;
- Modais rápidos para registrar informações;
- Empty states educativos;
- Componentes visuais pequenos e reutilizáveis;
- Funções puras para cálculos;
- PWA instalável;
- Tutorial contextual;
- Tema claro e escuro baseado em tokens CSS;
- Banco com restrições, índices e migrations;
- Controle de acesso por usuário;
- Assistente com limite de uso e envio de dados agregados.

## O que melhorar no novo projeto

O `DataProvider` do Money Log concentra carregamento, estado e praticamente todas as operações do sistema. Essa solução funciona para um aplicativo pessoal pequeno, mas o domínio de alimentação e treino tende a crescer rapidamente.

No Meal Log, as responsabilidades devem ser separadas desde o início em módulos:

- Nutrição;
- Treinos;
- Progresso corporal;
- Metas;
- Relatórios;
- Conta e configurações.

Além disso:

- cada página deve carregar somente os dados e períodos necessários;
- cálculos críticos devem possuir testes automatizados;
- componentes grandes devem ser decompostos por responsabilidade;
- validação e autorização devem sempre acontecer no backend;
- regras de negócio não devem ficar espalhadas nos componentes Vue.

---

# 2. Visão do Meal Log

## Proposta do produto

O Meal Log será uma aplicação pessoal para registrar alimentação, acompanhar o consumo nutricional, organizar treinos e visualizar a evolução corporal.

A experiência principal deverá responder rapidamente a cinco perguntas:

1. O que eu comi hoje?
2. Quanto falta para atingir minha meta?
3. Qual é o meu treino de hoje?
4. Como foi a execução do treino?
5. Estou evoluindo nas últimas semanas?

## Público inicial

O primeiro lançamento será voltado a:

- usuário individual;
- pessoa que já possui ou deseja acompanhar uma meta nutricional;
- pessoa que pratica musculação, corrida ou atividades semelhantes;
- uso pessoal, sem gestão de pacientes ou alunos;
- acompanhamento e organização, sem diagnóstico ou prescrição médica.

Funcionalidades para nutricionistas, personal trainers, alunos, pagamentos ou redes sociais devem ficar fora do MVP.

---

# 3. Funcionalidades do MVP

## 3.1 Dashboard “Hoje”

A página principal deverá mostrar:

- calorias consumidas e restantes;
- proteína, carboidratos, gorduras e fibras;
- quantidade de água consumida;
- refeições registradas;
- treino programado para o dia;
- estado do treino: não iniciado, em andamento ou concluído;
- peso mais recente;
- sequência de dias registrados;
- botão rápido para adicionar refeição;
- botão rápido para iniciar treino.

Exemplo:

```text
Hoje, 2 de agosto

1.650 / 2.300 kcal
Proteína: 124 / 170 g
Carboidratos: 182 / 260 g
Gorduras: 52 / 70 g
Água: 2,1 / 3,0 L

Café da manhã        480 kcal
Almoço               720 kcal
Lanche                90 kcal
Jantar               Ainda não registrado

Treino de hoje: Peito e tríceps
6 exercícios · aproximadamente 55 minutos
```

## 3.2 Diário alimentar

O usuário poderá:

- escolher uma data;
- criar café da manhã, almoço, lanche, jantar ou refeição personalizada;
- pesquisar alimentos;
- informar quantidade em gramas, mililitros ou porções;
- registrar alimentos manualmente;
- duplicar uma refeição de outro dia;
- copiar a alimentação de ontem;
- salvar alimentos e refeições como favoritos;
- adicionar observações;
- editar ou remover itens;
- visualizar calorias e macros em tempo real.

No primeiro lançamento, a base de alimentos poderá ser composta por:

- alimentos cadastrados pelo usuário;
- alimentos recentes;
- favoritos;
- receitas;
- pequena base inicial fornecida pelo sistema.

Integrações com bases externas e leitura de código de barras poderão ser adicionadas posteriormente.

## 3.3 Receitas

Uma receita será um agrupamento reutilizável de alimentos.

```text
Panqueca de banana

2 ovos
1 banana
30 g de aveia
10 g de pasta de amendoim

Rendimento: 2 porções
Macros por porção: calculados automaticamente
```

O sistema deverá permitir:

- definir ingredientes;
- definir rendimento;
- calcular nutrientes totais;
- calcular nutrientes por porção;
- registrar uma ou mais porções em uma refeição.

## 3.4 Metas nutricionais

As metas deverão possuir vigência, porque podem mudar com o tempo.

Campos principais:

- objetivo: emagrecimento, manutenção ou ganho;
- calorias diárias;
- proteína;
- carboidratos;
- gorduras;
- fibras;
- água;
- data de início;
- data de encerramento opcional.

Metas antigas não devem ser sobrescritas. Relatórios passados precisam ser comparados com a meta vigente na data analisada.

## 3.5 Treinos

O módulo de treino terá duas camadas.

### Modelo de treino

```text
Treino A — Peito e tríceps

Supino reto
Crucifixo inclinado
Desenvolvimento
Elevação lateral
Tríceps francês
Tríceps corda
```

### Sessão executada

```text
Supino reto

Série 1: 12 × 20 kg
Série 2: 10 × 25 kg
Série 3: 8 × 30 kg
```

O usuário poderá:

- criar fichas;
- adicionar e ordenar exercícios;
- definir séries, repetições, descanso e carga sugerida;
- agendar uma ficha;
- iniciar uma sessão;
- marcar séries como concluídas;
- alterar carga e repetições durante o treino;
- informar RPE ou esforço percebido;
- adicionar observações;
- encerrar a sessão;
- consultar o último desempenho do exercício;
- duplicar uma ficha.

## 3.6 Progresso corporal

O usuário poderá registrar:

- peso;
- percentual de gordura opcional;
- cintura;
- quadril;
- peito;
- braço;
- coxa;
- panturrilha;
- fotos de progresso;
- observações.

Os relatórios deverão priorizar médias e tendências, e não oscilações isoladas.

Visualizações recomendadas:

- peso diário com média móvel de sete dias;
- comparativo das medidas;
- fotos organizadas por data;
- evolução de carga nos principais exercícios.

## 3.7 Calendário

O calendário reunirá os dois domínios:

- alimentação completa;
- alimentação parcialmente registrada;
- dia sem registro;
- treino programado;
- treino concluído;
- peso ou medida registrada;
- indicador de aderência à meta.

Ao selecionar um dia, o sistema deverá abrir um resumo com refeições, macros, treino e check-in.

## 3.8 Relatórios

Relatórios iniciais:

- média diária de calorias;
- média diária de proteína;
- dias dentro da meta;
- consistência de registro;
- frequência de treino;
- volume total por grupo muscular;
- evolução de carga por exercício;
- evolução de peso;
- relação entre aderência e evolução.

O produto deve começar com poucos relatórios realmente úteis, evitando um painel cheio de gráficos sem função prática.

---

# 4. Modelo de dados recomendado

## Conta

### `users`

Gerenciada pelo Laravel e pelo sistema de autenticação.

### `profiles`

- `user_id`;
- `name`;
- `timezone`;
- `locale`;
- `date_of_birth`, opcional;
- `height_cm`, opcional;
- `preferred_weight_unit`;
- `preferred_energy_unit`.

### `user_settings`

- `user_id`;
- `theme`;
- `week_starts_on`;
- `default_meal_times`;
- `notifications_enabled`;
- `onboarding_completed_at`.

## Nutrição

### `nutrition_goals`

- `id`;
- `user_id`;
- `objective`;
- `calories`;
- `protein_g`;
- `carbs_g`;
- `fat_g`;
- `fiber_g`;
- `water_ml`;
- `starts_on`;
- `ends_on`.

### `foods`

- `id`;
- `user_id`, nulo para alimento global;
- `name`;
- `brand`;
- `barcode`;
- `serving_name`;
- `serving_grams`;
- `calories`;
- `protein_g`;
- `carbs_g`;
- `fat_g`;
- `fiber_g`;
- `sodium_mg`;
- `source`;
- `is_verified`.

### `meal_entries`

Representa uma refeição:

- `id`;
- `user_id`;
- `logged_on`;
- `logged_at`;
- `meal_type`;
- `title`;
- `notes`.

### `meal_items`

- `id`;
- `meal_entry_id`;
- `food_id`, opcional;
- `quantity`;
- `unit`;
- `grams`;
- `food_name_snapshot`;
- `calories_snapshot`;
- `protein_snapshot`;
- `carbs_snapshot`;
- `fat_snapshot`;
- `fiber_snapshot`.

Os campos de snapshot são essenciais. Caso um alimento seja editado no futuro, os registros históricos não poderão mudar.

### `recipes`

- `id`;
- `user_id`;
- `name`;
- `servings`;
- `instructions`;
- `is_favorite`.

### `recipe_items`

- `recipe_id`;
- `food_id`;
- `quantity`;
- `unit`;
- `grams`.

### `water_entries`

- `id`;
- `user_id`;
- `logged_at`;
- `amount_ml`.

## Treino

### `exercises`

- `id`;
- `user_id`, nulo para exercícios globais;
- `name`;
- `muscle_group`;
- `equipment`;
- `measurement_type`;
- `instructions`.

`measurement_type` poderá representar:

- peso e repetições;
- apenas repetições;
- tempo;
- distância;
- tempo e distância.

### `workout_plans`

- `id`;
- `user_id`;
- `name`;
- `description`;
- `active`.

### `workout_plan_days`

- `id`;
- `workout_plan_id`;
- `name`;
- `position`.

### `workout_plan_exercises`

- `id`;
- `workout_plan_day_id`;
- `exercise_id`;
- `position`;
- `target_sets`;
- `target_reps_min`;
- `target_reps_max`;
- `rest_seconds`;
- `notes`.

### `workout_schedules`

- `id`;
- `user_id`;
- `workout_plan_day_id`;
- `scheduled_on`;
- `status`.

### `workout_sessions`

- `id`;
- `user_id`;
- `workout_plan_day_id`, opcional;
- `performed_on`;
- `started_at`;
- `finished_at`;
- `status`;
- `perceived_effort`;
- `notes`.

### `workout_session_exercises`

- `id`;
- `workout_session_id`;
- `exercise_id`;
- `position`;
- `notes`.

### `workout_sets`

- `id`;
- `workout_session_exercise_id`;
- `position`;
- `set_type`;
- `weight`;
- `repetitions`;
- `duration_seconds`;
- `distance_meters`;
- `rpe`;
- `completed_at`.

## Evolução

### `body_measurements`

- `id`;
- `user_id`;
- `measured_on`;
- `weight_kg`;
- `body_fat_percentage`;
- `waist_cm`;
- `hip_cm`;
- `chest_cm`;
- `arm_cm`;
- `thigh_cm`;
- `notes`.

### `progress_photos`

- `id`;
- `user_id`;
- `taken_on`;
- `angle`;
- `storage_path`;
- `notes`.

### `daily_checkins`

- `id`;
- `user_id`;
- `checked_on`;
- `sleep_hours`;
- `sleep_quality`;
- `energy`;
- `hunger`;
- `mood`;
- `stress`;
- `notes`.

Todas as tabelas de domínio deverão possuir `user_id` direta ou indiretamente. Policies deverão verificar a propriedade antes de permitir visualização, alteração ou exclusão.

---

# 5. Regras de negócio essenciais

## Nutrição

```text
Nutriente consumido =
soma da quantidade proporcional de cada item registrado
```

```text
Restante =
meta vigente no dia - total consumido
```

```text
Aderência =
dias dentro da faixa configurada / dias registrados
```

O sistema poderá aceitar uma faixa de tolerância, por exemplo:

- calorias: margem de 5% ou 10%;
- proteína: atingir pelo menos o mínimo;
- água: atingir pelo menos a meta.

## Treino

```text
Volume da série = peso × repetições
```

```text
Volume do exercício =
soma do volume de todas as séries válidas
```

```text
Volume do treino =
soma do volume de todos os exercícios
```

Recordes pessoais poderão ser classificados como:

- maior carga;
- maior quantidade de repetições com determinada carga;
- maior volume em uma sessão;
- melhor tempo ou distância, quando aplicável.

Séries de aquecimento não deverão contar como séries de trabalho, salvo configuração explícita do usuário.

## Peso e medidas

Uma pesagem isolada não deverá ser tratada como evolução. O aplicativo mostrará:

- peso registrado;
- média móvel;
- variação semanal;
- variação desde o início da meta.

---

# 6. Arquitetura Laravel recomendada

O starter kit oficial atual do Laravel oferece Vue, Inertia, TypeScript, Tailwind e Vite configurados para uma aplicação full-stack.

Referências:

- [Starter Kit Vue do Laravel 13](https://laravel.com/docs/13.x/starter-kits)
- [Integração oficial Laravel e Vite](https://laravel.com/docs/13.x/vite)
- [Funcionamento do Inertia](https://inertiajs.com/docs/v3/core-concepts/how-it-works)

Fluxo principal:

```text
Navegador
    ↓
Rotas Laravel
    ↓
Controller
    ↓
Form Request
    ↓
Action/Service
    ↓
Eloquent/PostgreSQL
    ↓
Página Vue via Inertia
```

Essa arquitetura mantém:

- rotas no Laravel;
- autenticação por sessão;
- proteção CSRF padrão;
- validação no backend;
- Policies de autorização;
- Vue para a experiência visual;
- Vite para desenvolvimento e build;
- um único domínio, sem CORS ou JWT no MVP.

## Estrutura sugerida

```text
app/
├── Actions/
│   ├── Nutrition/
│   │   ├── CreateMealEntry.php
│   │   ├── AddMealItem.php
│   │   └── DuplicateMeal.php
│   ├── Training/
│   │   ├── StartWorkoutSession.php
│   │   ├── CompleteWorkoutSet.php
│   │   └── FinishWorkoutSession.php
│   └── Progress/
│       └── RecordBodyMeasurement.php
├── Http/
│   ├── Controllers/
│   │   ├── DashboardController.php
│   │   ├── MealEntryController.php
│   │   ├── FoodController.php
│   │   ├── WorkoutPlanController.php
│   │   ├── WorkoutSessionController.php
│   │   └── ProgressController.php
│   └── Requests/
├── Models/
├── Policies/
├── Services/
│   ├── NutritionCalculator.php
│   ├── WorkoutVolumeCalculator.php
│   └── ProgressTrendCalculator.php
└── Support/

resources/js/
├── components/
│   ├── ui/
│   ├── nutrition/
│   ├── training/
│   └── progress/
├── composables/
├── layouts/
├── pages/
│   ├── Dashboard/
│   ├── Nutrition/
│   ├── Training/
│   ├── Progress/
│   ├── Calendar/
│   └── Settings/
├── types/
└── lib/

database/
├── factories/
├── migrations/
└── seeders/

tests/
├── Feature/
└── Unit/
```

Actions deverão representar operações com significado de negócio. Deve-se evitar a criação de um único serviço gigante responsável por todo o aplicativo.

---

# 7. Navegação e experiência

## Navegação mobile

- Hoje;
- Alimentação;
- Treino;
- Progresso;
- Mais.

## Navegação desktop

- Hoje;
- Diário alimentar;
- Alimentos;
- Receitas;
- Treinos;
- Calendário;
- Relatórios;
- Progresso;
- Configurações.

O registro deverá ser rápido, especialmente no celular. As ações prioritárias são:

- alimentos recentes;
- favoritos;
- copiar ontem;
- duplicar refeição;
- reutilizar receita;
- mostrar a última carga utilizada;
- concluir série com um toque.

---

# 8. PWA e funcionamento offline

O Meal Log poderá ser instalável como PWA, seguindo o padrão já adotado pelo Money Log.

## MVP

- manifest;
- ícones;
- aparência standalone;
- tela offline amigável;
- cache de assets estáticos.

## Evolução posterior

- registrar refeições offline;
- registrar séries offline durante o treino;
- armazenar alterações localmente;
- sincronizar quando a conexão retornar;
- resolver conflitos entre registros locais e servidor.

Escrita offline com sincronização não deverá entrar na primeira versão, pois aumenta consideravelmente a complexidade do produto.

---

# 9. Segurança e privacidade

O aplicativo armazenará informações relacionadas à saúde, corpo, hábitos e possivelmente fotos. Esses dados deverão receber proteção especial.

Requisitos mínimos:

- HTTPS obrigatório;
- autenticação gerenciada pelo Laravel/Fortify;
- verificação de e-mail;
- Policies em todas as entidades;
- validação no servidor;
- rate limiting;
- fotos em storage privado com URLs temporárias;
- logs sem dados nutricionais, medidas ou observações sensíveis;
- backups automáticos;
- exportação de dados;
- exclusão completa da conta;
- aviso de que o aplicativo não substitui nutricionista ou médico;
- produção e staging separados;
- segredos somente em variáveis de ambiente.

Caso um assistente com IA seja adicionado futuramente, deverão ser enviados preferencialmente valores agregados, evitando fotos, observações íntimas ou o histórico bruto completo.

---

# 10. Estratégia de testes

## Testes unitários

- cálculo proporcional por gramas;
- cálculo nutricional de receitas;
- total de macros;
- seleção da meta vigente por data;
- volume de treino;
- detecção de recordes;
- média móvel de peso.

## Feature tests com Pest

- usuário não acessa dados de outro usuário;
- criação e edição de refeições;
- duplicação de refeição;
- início e conclusão de treino;
- upload privado de foto;
- rejeição de quantidades negativas;
- exportação e exclusão da conta.

## Frontend e end-to-end

- componentes críticos com Vitest;
- fluxo de criação de conta;
- registro de refeição;
- início e conclusão de treino;
- registro de peso.

---

# 11. Roadmap

## Fase 0 — Fundação

- Laravel com starter kit Vue;
- autenticação;
- layout responsivo;
- PostgreSQL;
- tema claro e escuro;
- testes e lint no CI;
- deploy de staging.

## Fase 1 — Alimentação

- metas nutricionais;
- alimentos;
- refeições;
- itens;
- cálculo de macros;
- dashboard do dia;
- recentes e favoritos.

Ao terminar essa fase, o sistema já deverá ser utilizável como diário alimentar.

## Fase 2 — Treinos

- biblioteca de exercícios;
- fichas;
- sessões;
- séries;
- histórico;
- última carga;
- volume e recordes.

## Fase 3 — Progresso

- peso;
- medidas;
- gráficos;
- calendário;
- relatórios semanais;
- fotos privadas.

## Fase 4 — Conveniência

- receitas;
- duplicação avançada;
- PWA;
- notificações;
- água e check-ins;
- importação e exportação.

## Fase 5 — Inteligência

- insights automáticos;
- resumo semanal;
- assistente de consulta;
- identificação de padrões;
- sugestões explicáveis e não médicas.

---

# 12. Deploy recomendado

```text
GitHub
   │
   │ push na main
   ▼
Laravel Cloud
   ├── Instala dependências Composer
   ├── Compila Vue/Vite
   ├── Executa migrations
   ├── Publica Laravel
   ├── PostgreSQL
   ├── Object Storage
   └── HTTPS + domínio
```

Fluxo inicial:

1. Registrar o domínio.
2. Criar a aplicação no Laravel Cloud.
3. Conectar o repositório do GitHub.
4. Criar o banco PostgreSQL.
5. Configurar as variáveis de ambiente.
6. Fazer o primeiro deploy.
7. Adicionar o domínio customizado.
8. Copiar os registros DNS fornecidos pelo Laravel Cloud.
9. Ativar backups e configurar e-mail transacional.
10. Habilitar ou manter o push-to-deploy na branch `main`.

O domínio deverá apontar para a aplicação Laravel, não somente para o frontend. O Laravel entregará tanto as páginas Vue compiladas pelo Vite quanto as operações do backend.

---

# 13. Descritivo consolidado do produto

> Meal Log é uma aplicação web mobile-first para acompanhamento integrado de alimentação, treinos e evolução corporal. O usuário poderá definir metas nutricionais, registrar refeições e alimentos, acompanhar calorias e macronutrientes, criar fichas de treino, registrar séries e cargas, monitorar peso e medidas e analisar sua consistência ao longo do tempo.
>
> A tela principal será orientada ao dia atual, apresentando o consumo nutricional, valores restantes, hidratação, refeições registradas, treino programado e indicadores recentes de progresso. O sistema possuirá também diário alimentar, biblioteca de alimentos, receitas, calendário, fichas de treino, execução de sessões, histórico por exercício, medidas corporais e relatórios.
>
> A aplicação será construída como um monólito modular utilizando Laravel, Inertia, Vue, TypeScript, Tailwind e Vite. O Laravel será responsável por autenticação, autorização, validação, regras de negócio, persistência, uploads e entrega das páginas Inertia. O Vue será responsável pela experiência interativa. O Vite será utilizado para desenvolvimento e compilação dos assets de produção.
>
> O sistema deverá ser responsivo, instalável como PWA, seguro por padrão e estruturado para que cada usuário tenha acesso somente aos próprios registros. Dados históricos deverão preservar snapshots nutricionais e metas vigentes na data do registro, garantindo que alterações posteriores em alimentos ou objetivos não modifiquem relatórios antigos.
>
> O primeiro lançamento será voltado ao uso individual. Funcionalidades para nutricionistas, personal trainers, alunos, pagamentos, inteligência artificial e integrações externas ficarão fora do MVP, podendo ser adicionadas posteriormente sem comprometer o núcleo do produto.

## Direção final

O Money Log deve ser usado como referência de experiência, responsividade, calendário, dashboard e componentes visuais. O Meal Log, entretanto, deverá iniciar com uma separação de domínio mais forte, regras centralizadas no backend e testes automatizados desde o primeiro módulo.

A prioridade deve ser entregar primeiro um diário alimentar simples e rápido, depois adicionar a execução de treinos e, somente então, expandir para relatórios, PWA avançada, integrações externas e inteligência artificial.
