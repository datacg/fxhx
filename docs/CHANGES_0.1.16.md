# FXHX 0.1.16 — revisão de confiabilidade, UX e arquitetura

Origem: revisão crítica de desenvolvimento e UX/UI da 0.1.15. Esta versão implementa as recomendações daquela análise. Tudo foi verificado em Node/mocks (282 testes); **nada foi validado no After Effects ainda**. O release exige o [smoke test no AE](HOST_SMOKE_CHECKLIST.md).

## Correções de confiabilidade

| Problema na 0.1.15 | Mudança |
|---|---|
| `Number("20,5")` virava NaN e a mensagem era "Finite number required". | `FX.U.parseNumber` aceita vírgula decimal e recusa hex, expoente, separador de milhar e texto vazio, com mensagem legível ("Radius: enter a number such as 20 or 20.5"). |
| O readback exigia igualdade exata do JSON. Um valor guardado em float32 (ex.: 0.2 → 0.2000000029) gerava "Verification Failed" e bloqueava o refresh automático. | `FX.U.sameValue` usa tolerância relativa de 1e-5. Arredondamento e limitação reais (70.4 → 70) continuam falhando. Quando há diferença de precisão, o resultado anota o valor guardado. |
| Apply era o botão padrão (`name: 'ok'`): Enter num campo submetia o lote, e outro Enter na confirmação aplicava. | Apply nunca é o padrão. Na confirmação, Enter e Esc cancelam. |
| Check for updates rodava o PowerShell mesmo com a rede bloqueada pelo AE e podia congelar até 10 s sem aviso. | Verifica antes a preferência *Allow Scripts to Write Files and Access Network*, explica como ativá-la e avisa da possível pausa. |
| A edição de presets era feita em JSON cru, um parâmetro por vez. | Os presets usam os mesmos campos do editor, validam min/max e aceitam vários parâmetros por salvamento. |
| O editor reconstruía a lista de pendências e o layout a cada tecla. | A lista é atualizada no lugar e o layout só roda quando a visibilidade muda. |

## Desempenho ao aplicar (retorno de uso)

Sintoma relatado: qualquer Apply demorava muito, mesmo com poucas alterações.

Causa: depois de qualquer operação bem-sucedida, o painel invalidava a lista, **relistava o escopo inteiro** (o projeto todo, se escolhido) em fatias de 12 ms, esperando o `scheduleTask` do AE entre elas, e só então relia os efeitos editados. Isso competia com o AE redesenhando o frame com o valor novo. No lote, cada alvo era capturado por inteiro (todas as propriedades e o fingerprint) duas vezes: na pré-validação e de novo logo antes de gravar.

Mudanças:

| Antes | Agora |
|---|---|
| Relistar o escopo após set/copy/enable/disable | `Scanner.reuseAfterWrite`: confere a pilha de efeitos das layers gravadas e o `enabled` dos alvos e mantém a lista. Edições releem só os efeitos editados. Se algo não bater, ou em Remove/Add Effect, relista como antes. |
| 2 capturas completas por alvo no lote | 1 captura, mais uma recaptura apenas quando uma gravação anterior do mesmo lote tocou a mesma layer (o setter de um plugin pode alterar efeitos vizinhos; esse caso continua detectado). No mock de 3 efeitos numa layer, o relógio lógico cai de 72 para 60. |
| Clonar todas as layers do escopo a cada lote | Indexar só as layers dos alvos |
| Fatias de 12 ms / 30 passos, espera de 25 ms | 40 ms / 150 passos, espera de 10 ms |

## Interface

- **Editor em dois painéis:** lista com busca à esquerda, inspetor do parâmetro à direita, pendências embaixo. O botão mostra a contagem ("Apply 3 changes").
- **Entrada de valores (`FX.ValueInput`)**, compartilhada entre editor e presets: rótulos X/Y/Z e R/G/B/A, campo hex, botão Pick... com `$.colorPicker`.
- **Confirmação** com tabela Parâmetro / Atual (efeitos) / Novo valor, título legível ("Enable effects" em vez de "enable") e botão "Apply to N effects".
- **Painel compacto:** três linhas no topo. Filters fica junto do Scope, e Refresh/Cancel dividem o mesmo lugar.
- **Barra de progresso** ao listar, ler e aplicar.
- **Botão primário estável:** continua "Edit Parameters..." e fica desabilitado quando não há o que editar (antes virava a mensagem "Select an effect").
- **Verbos unificados:** More não repete Enable/Disable/Add Effect/Issues. "Apply Effect..." passou a ser Add Effect..., "Copy Settings From..." virou Copy From Another Effect... e "Remove" virou Remove Effects.
- **Mensagens sem jargão interno** (inventory, occurrence, Basic, analysis), e Help embutida reescrita.
- **Caixa de seleção para parâmetros liga/desliga.** O ExtendScript não informa se um parâmetro é checkbox. A detecção é conservadora: Checkbox Control, ou número sem unidade, com faixa 0–1 (ou nenhuma) e todos os valores atuais exatamente 0 ou 1. **Number...** volta ao campo numérico se um slider em 0/1 for confundido. O valor gravado continua 0/1; pendências e confirmação mostram On/Off.
- **Nome FXHX** em arquivo, títulos, Help, Diagnostics, Undo e pacote. Os identificadores de dados (`%APPDATA%FXExchanger`, `product` dos JSON, targetengine) continuam iguais, para preservar preferências e presets.
- **Português:** rótulos, títulos e cabeçalhos traduzidos quando o AE está em português (`$.locale`) ou com `FXHX_LANG=pt`. A lógica usa as chaves em inglês (`fxTitle`/`fxKey`), então filtros e testes não dependem do idioma. Mensagens montadas com dados e o texto longo da Help seguem em inglês.
- **Larguras de linha** medidas pela fonte do host (`measureString`), em vez de 64/38 px fixos, para escalas de DPI altas. Os valores antigos ficam como fallback.

## Arquitetura

- **`FX.Activity`** substitui o booleano `busy` por fases explícitas (`idle`, `listing`, `reading`, `applying`) com transições verificadas. Transições inesperadas vão para Diagnostics, mas são aplicadas, para nunca travar o painel. `setWorking`/`setIdle` mantêm a fase e o par Refresh/Cancel sincronizados.
- **Módulos extraídos do `panel.js`:** `FX.Confirmation` (descrição pura do lote, testável sem UI), `FX.Layout` (geometria das linhas), `FX.HelpDialog`, `FX.ValueInput` e `FX.I18N`. O dropdown oculto de agrupamento virou dado (`groupBy.selection.index`), e o botão "Parameters..." sempre invisível foi removido.
- **Gate de release:** `npm run release` exige `docs/validation/ae-host-<versão>.json` com todos os itens do checklist aprovados. `npm run release:candidate` gera um pacote de teste marcado `hostValidated: false`.
- Os relatórios por versão foram movidos para `docs/history/` com os links corrigidos.

## O que não mudou, de propósito

- As demais travas de reentrância (`renderInProgress`, `selecting`, `viewSyncing`, `dialogs.length`…) continuam como estavam. Cada uma protege um caso coberto por teste, e substituí-las sem validação no host arriscaria regressões já corrigidas em hotfixes anteriores. `FX.Activity` é o ponto de partida para migrá-las depois.
- As marcas `[x]`/`[-]` continuam: são a evidência de seleção quando o destaque nativo não aparece (foco inativo, temas), e o destaque nativo ainda não foi validado no host.
- Contratos de batch, revalidação, Undo e recuperação após escrita não mudaram.

## Pendências no After Effects

Todos os itens do [checklist](HOST_SMOKE_CHECKLIST.md), em especial: layout do editor em dois painéis e do topo em 100/150/200% de DPI, `measureString` no host real, `$.colorPicker`, precisão real de cores no readback, `defaultElement` da confirmação, `$.locale` em instalações em português e a leitura da preferência de rede.
