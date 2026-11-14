# Arquitetura — FXHX 0.1.16

## Visão atual (0.1.16)

Runtime ES3 no namespace privado `FX`, **26 módulos** em `tools/modules.cjs`, empacotados num único JSX com `#targetengine "fxexchanger"`. Não há dependência de Node ou rede no host.

| Camada | Módulos | Responsabilidade |
|---|---|---|
| Núcleo | utils, core/*, configurations/*, filters, grouping, diagnostics, updates, storage/* | Dados, validação, canônico/diff, política de parâmetros, persistência. `FX.U.parseNumber` e `FX.U.sameValue` centralizam a entrada numérica e a comparação com tolerância. |
| Host | ae/adapter | Único acesso a objetos do AE: leitura, escrita com readback, Undo, scheduler, rede. |
| Processos | scanner, batch | Jobs em ticks (listar/ler) e planos de escrita revalidados. |
| UI pura | ui/i18n, ui/layout, ui/activity, ui/presentation, ui/confirmation | Sem estado do painel: tradução, geometria de linhas, fases de trabalho, textos e descrição do lote. Testáveis isoladamente. |
| Componentes ScriptUI | ui/results, ui/help, ui/valueinput, ui/editor | Recebem fábricas (`createDialog`, `button`, `row`) e callbacks do painel; nunca tocam o host. |
| Orquestração | ui/panel | Monta o painel, mantém a seleção e liga UI, scanner e batch. |

**Fases (`FX.Activity`).** `idle → listing → reading → idle`, `idle → applying → idle | listing` (refresh automático). `setWorking(fase)`/`setIdle()` mudam a fase e o par Refresh/Cancel juntos. Transições inesperadas são registradas em Diagnostics e aplicadas, para nunca travar o painel. As travas de reentrância de render, seleção e diálogos continuam independentes; migrá-las para fases é o próximo passo, depois da validação no host.

**Idioma.** `FX.I18N.t` traduz rótulos estáticos na criação dos controles. Cada botão guarda a chave em inglês em `fxTitle`, e cada item de dropdown em `fxKey`; lógica e testes usam essas chaves.

**Release.** `tools/host-gate.cjs` exige `docs/validation/ae-host-<versão>.json` com todos os itens do [smoke test](docs/HOST_SMOKE_CHECKLIST.md). Sem ele, só `release:candidate`, que marca `hostValidated: false` no MANIFEST.

Detalhes da mudança: [docs/CHANGES_0.1.16.md](docs/CHANGES_0.1.16.md). As seções abaixo registram as decisões das versões anteriores e continuam válidas onde não foram substituídas.

## Histórico de decisões

Na 0.1.14, o editor retorna somente o lote preparado; Apply não cria intenção de reabertura. O callback agendado de abertura permanece restrito ao pedido inicial de Edit que precisa preparar os dados. Atualização e recuperação da seleção após escrita continuam independentes desse callback. Marcas de pendência/erro são derivadas dos drafts por path; nunca identificam alvos pelo texto exibido. Uma trava de atualização protege notificações de seleção emitidas ao mudar rótulos.

Base imediata da 0.1.12: 0.1.11; histórico anterior preservado. Runtime ES3 em namespace privado FX, 19 módulos (26 na 0.1.16) em tools/modules.cjs, um JSX independente e targetengine fxexchanger. Build valida cada fonte, corpo e arquivo emitido com Acorn ES3 e lint adicional ExtendScript. Não há dependência Node ou rede no host.

Na 0.1.11, a continuação explícita de set/copy bem-sucedido encadeia Basic → recuperação inequívoca → análise somente dos alvos recuperados. scanner.onDone prepara a segunda fase e o scheduler executa o próximo tick, sem reentrada ou modal. pendingParameterRefresh controla conclusão/cancelamento; Results é independente. Página/foco identificável são preservados. Refresh manual e outras operações não autorizam leitura profunda nova. Não há retry de escrita após falha de atualização.

Na 0.1.10, configurations/parameters centraliza exclusões de caminhos/nomes e o perfil AI Color Match. Adapter identifica o perfil por metadados dos efeitos existentes, exclui controles de sistema antes de ler valores e revalida elegibilidade na escrita/remoção. Campos conhecidos fora do escopo ficam em excluded (metadados); dados desconhecidos relevantes continuam em unsupported. Editor/presets também filtram snapshots anteriores. Não existe um detector universal de visibilidade via ExtendScript.

Na 0.1.9, states inclui valueType dos campos numéricos sem ler valores/keys animados. O editor calcula disponibilidade por path e oferece detalhes por ocorrência. Remoção de keyframes usa opções transitórias por path e snapshots por alvo (tipo/contagem/ausência de expression), fora dos presets. Batch revalida antes de qualquer escrita; adapter repete a verificação, valida limites antes de remover keys em ordem decrescente, atribui valor fixo e faz readback. Falhas incertas não recebem retry.

Na 0.1.12, ui/editor recebe dados e callbacks, sem acessar objetos do host. Pesquisa, filtros e drafts operam em memória. O painel fecha o editor antes de executar Batch. Um callback de scheduler separado, vinculado ao projeto/epoch/alvos, abre o editor apenas após Edit inicial ou Apply and continue explícitos. Nunca abre no tick ativo do scanner. Scan, cancelamento, falha, mudança de escopo/projeto e dispose invalidam a intenção. Famílias completas de duplicatas podem ser recuperadas como conjunto se a estrutura permanecer idêntica; subconjuntos ambíguos são recusados.

Adapter captura metadados opcionais control. propertyParameters fornece opções por índice real; o perfil Deep Glow 2 permite somente Blend Mode Screen/Add como fallback. Capture, editor, presets, fingerprints e writer preservam o mapa; alterações invalidam o snapshot. Não se chama setPropertyParameters.

## Componentes e fronteiras

| Componente | Contrato |
|---|---|
| core, utils, storage | JSON estrito, IDs, validação, preferências v2/migração v1, staging/backups/rollback/concorrência |
| storage/presets | Biblioteca JSON v1 de linhas estáticas de um efeito, schema estrito, clones, commit antes de publicar em memória, conflitos de importação sem overwrite |
| ae/adapter | Único acesso a objetos do AE; metadados, captura seletiva, inspeção, resolução, escrita e scheduler |
| scanner | Jobs Basic/Analysis, filtros congelados, overlay de configurações e guarda de projeto |
| configurations/engine | Canônico estático, igualdade completa, readable, projeção e diff |
| configurations/animation | Classificação e comparação limitada de metadados suportados, sem escrita |
| configurations/parameters | Política de parâmetros públicos/sistema, perfil Color Match, identidade/esquema e filtragem de linhas antigas |
| filters/grouping | Regras em memória, parâmetros discriminantes, grupos completos/parciais e diferenças por índice |
| batch | Planos conservadores: planos, revalidação de todos os alvos, locks, operações, Undo e relatório |
| ui/panel | Seleção por clique, ação dinâmica, editor direto, diálogos secundários, paginação, cache visual e ciclo de tarefas |
| ui/results | Hierarquia lógica sobre ListBox multisseleção; destaque nativo de todos os alvos, foco separado e sincronização protegida |
| ui/presentation | Modelos puros de seleção, Mixed Values/compatibilidade, títulos e Help incorporado |
| diagnostics | Até 500 entradas existentes e métricas técnicas agregadas por nomes fixos |

## Leitura e cache

Scanner.start executa Basic, sem percorrer propriedades de efeito, criar instâncias ou calcular fingerprint. basic é o snapshot completo de metadados. Configurações analisadas ficam por effectKey em configurations; analyses mantém até 20 descritores e analysisRevision cresce monotonicamente. inventory monta uma visão compartilhada uma vez por revisão. Novo Basic, publicação de análise e invalidate limpam essa visão. Nenhum snapshot é persistido; a referência project é somente guarda transitória.

Scanner.analyze(filters,targets) congela filtros e chaves autorizadas. Metadados antecedem captura; filtro por valor lê só seus paths antes de decidir pela configuração inteira. Animação desconhecida não é Static nem é rejeitada previamente: dentro da seleção autorizada ela é classificada na análise explícita. Capturas completas não correspondentes ao filtro de animação permanecem no cache, enquanto result apresenta somente correspondentes. Rejeitados antes de captura completa não recebem configuração inventada.

A UI inclui candidatos de animação ainda não analisados na busca filtrada, para permitir selecioná-los e analisar. Filtragem final é estrita. Navegar/reagrupar não relê o host. Analyze pela UI captura somente ocorrências ainda sem configuração; para renovar dados externos, Refresh. Mudanças de pesquisa/filtro durante job não expandem seu pedido. Scope cancela/invalida.

Fingerprints capturados são snapshots imutáveis para o consumidor da UI. Grouping recebe um opt-in interno para reutilizá-los; chamadores padrão sem esse opt-in continuam recalculando. readable usa o fingerprint disponível, sem duplicar a canonicalização; cobertura completa pode reutilizar diretamente seu canônico. Nunca se decide igualdade só por hash. Cache de três agrupamentos usa inventário/revisão/modo/paths/chaves; não é autorização para escrita.

## Árvore e interação

Um clique define Active Target e substitui Operation Selection. Ctrl alterna membros; Shift percorre linhas visíveis do mesmo tipo entre anchor e foco, Ctrl+Shift soma. Pais parcialmente selecionados mostram [-], membros completos [x]; mapas deduplicam sobreposições. Gestos/notificações duplicadas e atualizações de rótulos são protegidos por selecting/consumedGesture/key. Falha de marca bloqueia ações e permite Retry display. Add to Selection continua alternativa; Clear limpa inclusive ocultos. Planos usam somente a seleção correspondente aos filtros. Paging limita o intervalo manual; selecionar grupo inclui membros fora da página, informados no contador/confirmação.

A árvore cria no máximo 200 ocorrências/layers por página, mais nós de contexto. Índices de membros permitem contagens completas sem concatenações crescentes. Expansão de nós persistentes e a mesma ocorrência ativa são recuperadas nas atualizações do inventário atual. IDs visuais não substituem identidade/revalidação do host.

onChanging/onChange somente marcam a consulta pendente. Search/Enter chama searchProject: sem Basic válido, inicia runScan somente Basic no escopo atual; com inventário válido, applySearch filtra em memória e informa contagens, inclusive em repetição. Clique com consulta pendente usa applySearch, nunca inicia inventário implicitamente, e reencontra a mesma chave antes de selecionar. guard preserva this/arguments. Sem tarefas de debounce. render tem trava abrangendo preparação, agrupamento, construção e layout; a chave de cache só é confirmada após sucesso. Falha visual desabilita ações sobre a árvore parcial e oferece Retry display, preservando o scanner.


## Edição e Refresh

Edit Parameters é direto. New value começa vazio e onChanging/onChange registra rascunhos por path. Uma remoção explícita pode entrar no draft mesmo com campo vazio, usando keepCurrent transitório. O editor envia requireAll: cada parâmetro deve atender todos os alvos. Batch resolve valores por alvo em targetRows e valida proteção/tipo/menu/limites/keyframes antes da primeira mutação. A confirmação rolável mostra valores anteriores agrupados e destino; não oferece aceite parcial para o editor. Cópia/presets conservam seus contratos próprios. Métodos nativos ainda podem falhar após a pré-validação; não há transação atômica.

Batch possui trava de reentrância e invalida globalmente ao terminar, inclusive falha de pré-validação. Preserva lastReport. Operação concluída com changed>0, sem failed/unknown/verificationFailed, inicia um Basic Refresh automático; falha/incerteza exige revisão manual, sem retry. Refresh recupera somente alvos com layerId estável, mesmo projeto e estrutura/identidade inequívoca. Nenhuma configuração antiga entra no novo inventário; nova análise continua explícita. Falha ao iniciar/ler Basic não apaga o relatório.

## Tarefas e instrumentação

Até uma tarefa não repetitiva de scan, callback único por controller, proteção contra reentrância no controller e Scanner. Conclusão não agenda mais; dispose remove callback/observadores e cancela. Falha de scheduler encerra o job lógico; falha nativa de cancelamento é registrada, sem garantia de remoção pelo host. Help e menus fecham antes do próximo diálogo quando não há necessidade de composição modal. Apply/Cancel têm nomes nativos ok/cancel; comportamento real de teclado está pendente.

Métricas agregam Basic/Analysis, etapa/leitura/fingerprint, agrupamento/render/árvore/nós, marcas de seleção, callbacks, tarefas e reaproveitamentos. Tempos de parede e tempos síncronos não são somáveis indiscriminadamente. Nenhuma métrica contém valores, nomes de projeto ou licenças. Ver docs/history/PERFORMANCE_INVESTIGATION_0.1.2.md.

Tick limita trabalho entre etapas a 30 passos/12 ms; uma chamada síncrona não é preemptada. Inspeção de animação continua explícita, até duas ocorrências, 16 paths na UI e 2.000 keys/path. Layout nativo, docking e Not Responding precisam de evidência real, não inferência dos mocks.

## Contratos de confiabilidade 0.1.3

- errorInfo/errorText extraem campos primitivos com acessos protegidos, sem converter o objeto Error. Diagnostics.error armazena detalhes e tolera falha de gravação; guard protege cada destino e mostra mensagem curta.
- Edit/Compare guardam intenção, fecham e só então confirmam/executam. Registro de diálogos garante fechamento em finally, erros e dispose; callbacks de controles fechados são ignorados. Render pedido durante modal fica pendente até fechamento.
- Scanner.start prepara cursor antes de cancelar/substituir sessão. Após aceitação, snapshot anterior fica stale até novo Basic; não é reutilizado para escrever. Notificações onProgress/onDone ficam isoladas de falhas de leitura.
- Callback por controller recebe generation da sessão; cancel/start/analyze/dispose impedem reaproveitamento. Código agendado verifica typeof antes de chamar um global removido. Uma tarefa recusada pelo host pode existir fisicamente, mas não processa nova sessão.
- Batch conserva duas comparações completas por ocorrência e valida estrutura antes de cada alvo. Remoções confirmadas atualizam somente a assinatura esperada da execução, em ordem descendente; erro estrutural incerto bloqueia os alvos restantes naquela layer.
- writeRows distingue preparação, invocação e readback. Retorno de setValue incrementa written antes de ler; igualdade exata incrementa verified. Erro durante invocação gera Unknown, nunca retry. Normalização/rounding gera Verification Failed, sem tolerância arbitrária.
- Métricas capture/validateOccurrence/prevalidation/setValue/readback/totalBatch/renderTotal/errorRecovery são agregadas, técnicas e protegidas contra falhas do observador. Mensagens/stack de erro podem conter caminhos; não são métricas.

Decisão sobre recaptura e evidências em docs/history/RELIABILITY_HOTFIX_0.1.3.md.

## Fluxo simplificado 0.1.4 e layout 0.1.7

View inicia em occurrences, independentemente do agrupamento antigo salvo. A lista padrão cria apenas folhas individuais comp/layer/índice/efeito, sem Grouping.build; Layers e grupos são opções explícitas. O modo occurrences é transitório e não muda schema de preferências. Ações diretas mantêm Batch/preview/Undo; Read Parameters é o nome de UI para scanner.analyze. Não há Replace genérico.

selectTreeItem guarda item/chave e aceita onChange/click com deduplicação por gesto. Na 0.1.7 refreshMarks só altera texto quando a marca muda, sob trava; erros desabilitam escrita. button não atravessa parent nativo; bindDialogEvents mantém guarda de janela fechada. Histórico em docs/history/WORKFLOW_AUDIT_0.1.4.md.

Na 0.1.7, shell é o filho direto removível do host; cabeçalho fixo contém título, espaço expansível e Help. Body usa layout próprio: panel/viewport recorta conteúdo, scrollbar desloca root, e Presentation.viewport/rowWidths calcula geometria pura e quebra de ações. Resize limita offset; Results altera a altura do conteúdo. Wheel é encaminhado apenas quando entregue pelo host; registro recusado não impede inicialização. Árvore e edittexts preservam navegação própria. Dispose impede callbacks antigos de mover o conteúdo.

mainView mostra Effects/Groups/Layer; groupBy interno conserva os modos. onChange nunca abre modais; More → Grouping configura e fecha antes de escolher paths. As travas do hotfix 0.1.6 permanecem, inclusive initializing/viewSyncing/viewChanging/advancedDialogOpen. Fonte/detalhes em docs/history/BATCH_WORKFLOW_0.1.7.md; validação ScriptUI ainda bloqueada.

Presets são carregados apenas por ação explícita, em presets.json separado. FX.Store recebe contratos opcionais de basename/validação/default/migração, preservando o padrão de preferências. Library faz clone, valida, salva e só depois publica. Clipboard é snapshot estático transitório com matchName/rows. Add com preset cria uma instância por layer e usa writeRows no mesmo Undo; created contabiliza criação mesmo se parâmetros falharem. Não há rollback/retry de instâncias nem escrita de animação. Inspect Animation adiciona tabela pura de keys aos snapshots explicitamente capturados.
