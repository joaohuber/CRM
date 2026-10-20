# Lensi CRM

CRM de vendas pelo WhatsApp para negócio local. Next.js 15 (App Router), Tailwind CSS 4 e Supabase.

Visual com a identidade Lensi: fundo preto, texto branco e o degradê azul da logo (`#00B4FE` → `#0059FF`). As cores ficam no bloco `@theme` de [`src/app/globals.css`](src/app/globals.css) e a logo em [`public/brand/lensi-logo.png`](public/brand/lensi-logo.png).

- **Funil Kanban** com arrastar e soltar (no celular, seletor de etapa no card) e atualização em tempo real quando chega lead novo.
- **Lista de leads** com busca e filtros por etapa e origem.
- **Origem do tráfego** por lead: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `gbraid`, `wbraid`, `fbclid`, página de entrada e referrer. Vale a primeira origem registrada (first-touch).
- **Webhooks** para formulários e para a Evolution API (WhatsApp).
- **tracker.js** para o site: liga o GCLID do anúncio à conversa que começa no WhatsApp.
- **Export CSV de conversões offline** para o Google Ads (leads com GCLID que fecharam venda).

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Em **Authentication > Users > Add user**, crie os usuários da equipe (e-mail + senha).
4. Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up" para ninguém criar conta sozinho.

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com os dados de **Project Settings > API**. Gere o `WEBHOOK_SECRET` com algo longo e aleatório.

### 3. Rodar

Precisa do Node.js 20 ou mais novo.

```bash
npm install
```

```bash
npm run dev
```

Acesse http://localhost:3000 e entre com o usuário criado no passo 1.

Para produção, faça deploy na Vercel (ou similar) com as mesmas variáveis. A tela **Configurações** mostra as URLs prontas dos webhooks e o snippet do tracker.

## Webhooks

Todos usam o `WEBHOOK_SECRET`, enviado no header `X-Webhook-Secret`, em `Authorization: Bearer ...` ou em `?secret=...`.

### Formulários: `POST /api/webhooks/form`

Aceita JSON, `x-www-form-urlencoded` e `multipart/form-data`. Os nomes de campo são flexíveis:

| Dado | Campos aceitos |
| --- | --- |
| Nome | `name`, `nome`, `full_name`, `first_name` + `last_name` |
| Telefone | `phone`, `telefone`, `whatsapp`, `celular`, `tel` |
| E-mail | `email` |
| Mensagem | `message`, `mensagem`, `msg` |
| Origem | `utm_*`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `landing_page`/`page_url`, `referrer` |

Também lê o formato do Elementor (`form_fields[telefone]`) e objetos aninhados (`{ "utm": { "source": "google" } }`). Se só vier a `landing_page` com a query string, os UTMs e o GCLID são extraídos dela.

- **De servidor** (Zapier, Make, RD Station, webhook do Elementor): mande o segredo.
- **Direto do navegador**: sem segredo, desde que o domínio do site esteja em `ALLOWED_ORIGINS`. Campo `_hp` funciona como honeypot anti-bot e `_redirect` redireciona para a página de obrigado.

```bash
curl -X POST "http://localhost:3000/api/webhooks/form" -H "X-Webhook-Secret: SEU_SEGREDO" -H "Content-Type: application/json" -d "{\"nome\":\"Maria\",\"telefone\":\"11988887777\",\"utm_source\":\"google\",\"utm_medium\":\"cpc\",\"gclid\":\"teste123\"}"
```

### WhatsApp: `POST /api/webhooks/evolution?secret=...`

Configure na Evolution API o evento `MESSAGES_UPSERT`, com base64 e "Webhook by Events" desligados. Com "by Events" ligado, a Evolution acrescenta o nome do evento no fim da URL e o `?secret=` deixa de bater; nesse caso, mande o segredo pelo header `X-Webhook-Secret` (campo de headers do webhook na Evolution v2).

- Mensagem de número novo cria o lead na primeira etapa, usando o `pushName` como nome.
- Mensagens seguintes entram no histórico do lead. Mensagens enviadas pela equipe (`fromMe`) só são registradas se o lead já existir.
- Grupos, status e canais são ignorados. Retries da Evolution não duplicam mensagens (deduplicação pelo id da mensagem).
- Anúncios de clique para WhatsApp da Meta (`externalAdReply`) viram `utm_source=meta`, `utm_medium=ctwa`.

Os leads são deduplicados pelo telefone. O CRM entende que `5511988887777` (formulário) e `551188887777` (WhatsApp antigo, sem o 9) são a mesma pessoa.

## Rastrear GCLID em quem chama no WhatsApp

Quem clica no anúncio e depois no botão do WhatsApp perde o GCLID, porque o WhatsApp não repassa parâmetros. O `tracker.js` resolve:

```html
<script src="https://SEU-CRM/tracker.js" data-message="Olá! Vim pelo site." defer></script>
```

1. Na visita, guarda UTMs/GCLID por 90 dias.
2. No clique em um link `wa.me` ou `api.whatsapp.com`, adiciona um código à mensagem (`Olá! Vim pelo site. [#K7P2QM]`) e registra o clique em `/api/track`.
3. Quando a mensagem chega pela Evolution, o CRM encontra o código e copia a origem do clique para o lead.

O domínio do site precisa estar em `ALLOWED_ORIGINS`. O script também preenche campos com os nomes `utm_source`, `gclid` etc. nos formulários; com `<form data-crm>`, ele cria os campos ocultos sozinho.

Limitação: só intercepta links `<a href>`. Botões que abrem o WhatsApp via JavaScript (`window.open`) precisam ser trocados por links.

## Conversões offline no Google Ads

Leads com GCLID que entram numa etapa do tipo `won` ganham `won_at`. Em **Leads > Exportar conversões** (ou `/api/export/google-ads?name=Venda%20WhatsApp`) sai o CSV no formato de importação do Google Ads, com o campo **valor** do lead.

No Google Ads, crie uma ação de conversão do tipo "Importação > Cliques" com o mesmo nome usado no parâmetro `name`.

## Etapas do funil

Ficam na tabela `stages`: `name`, `position` (ordem), `color` (`cyan` e `blue` da marca, mais `slate`, `sky`, `amber`, `violet`, `orange`, `emerald`, `rose`, `teal`, `pink`) e `kind` (`open`, `won`, `lost`).

## Estrutura

```
supabase/migrations/0001_init.sql        schema, RLS, realtime
public/tracker.js                        script para o site
src/middleware.ts                        protege as páginas (login)
src/app/(crm)/kanban                     funil
src/app/(crm)/leads                      lista, novo, detalhe
src/app/(crm)/configuracoes              URLs, snippet, log de webhooks
src/app/api/webhooks/form                webhook de formulários
src/app/api/webhooks/evolution           webhook da Evolution API
src/app/api/track                        cliques do tracker
src/app/api/export/google-ads            CSV de conversões offline
src/lib/leads.ts                         criação/deduplicação de leads
src/lib/evolution.ts                     parser do payload da Evolution
src/lib/actions.ts                       server actions (mover, salvar, notas, login)
```
