# Modelo de dados — FX Exchanger 0.1.15

Na 0.1.14, as marcas `*`/`!` e o estado no título são derivados dos drafts e da validação. Não persistem em presets, snapshots ou no projeto. Apply não retorna continueEditing nem solicita reabertura. A intenção agendada de abrir o editor serve apenas ao pedido inicial de Edit que ainda precisa ler parâmetros. O retorno manual usa a seleção atual recuperada e os valores relidos.

## Preferências e snapshots

Schema permanece 2: `{schemaVersion:2,product:'FX Exchanger',preferences:{scope:'active',groupBy:'type'}}`. Leitura valida v1 e migra em memória, preservando preferências compatíveis e backups na gravação posterior. IDs de composições manuais não persistem; escopo manual volta a Active ao reabrir painel. Layers é uma visualização de sessão. Não há migração automática de perfis Plugin Hub nem persistência de resultados de scan.

basic contém id/project/scope/layers/instances/scannedAt/stale/errorCount/analysisState/filters. project é guarda transitória. LayerRecord mantém IDs/índices/nomes, tipo/flags/label, effectCount e stackSignature; esta serializa somente sequência índice/nome/matchName. LayerType e sua precedência não mudaram.

Occurrence mantém scanId, contexto da layer, effectIndex/effectName original/matchName, Enabled boolean/null, metadataErrors, analysisState e configuration/fingerprint inicialmente null. effectKey é comp/layer/fx-index, sem constituir ID permanente do host. Duplicatas inteiramente indistinguíveis continuam um limite.

configurations mapeia chaves a snapshots analisados. analyses retém até 20 descritores `{at,filters,keys}`, onde keys são correspondentes ao pedido; capturas completas não correspondentes à animação podem existir no cache para reutilização. analysisRevision monotônico invalida a apresentação. result é o último pedido filtrado; não representa todo inventário. inventoryCache compartilha registros e arrays de layers, somente um vetor de referências por revisão. Consumidores não devem modificar snapshots diretamente. Cancelamento não publica resultados parciais; invalidate impede escrita e descarta a visão cacheada.

## Configuração e animação

Configuração mantém schemaVersion/effectMatchName/enabled/properties/unsupported/states. Linhas properties são `{path:[{matchName,index},...],name,valueType,value}`. OneD/TwoD/ThreeD/spatial/COLOR exigem números finitos e dimensões exatas. Unsupported contém path/reason: keys, expression inclusive desativada, opaco, referência, erro, limite ou estado desconhecido. Não há arredondamento arbitrário de valores.

Fingerprint static-v2 conserva hash, canônico, cobertura e contagens. Completo inclui Enabled; Selected Parameters compara só paths escolhidos e exige todos disponíveis. readable complementa a comparação de dados acessíveis e não torna parcial uma igualdade completa. Grouping opt-in de snapshots é só otimização da UI, atrelada à revisão; padrão continua recapturando o canônico dos dados fornecidos. Resumos ausentes não são inventados.

states contém path/name/state/keyCount/expressionPresent/expressionEnabled, sem keys detalhadas ou texto de expression. Na 0.1.15, currentValue opcional registra um snapshot numérico validado de propriedades com keyframes e sem expression, somente para revisão/limpeza. Não entra em properties nem na igualdade estática/presets. State é Static/Keyframed/Expression-driven/Mixed/Unsupported. Ausência de configuração é Not Analyzed, nunca Static. Filtro de animação admite candidatos desconhecidos somente para apresentação/análise explícita; resultado final aplica comparação estrita sobre classificações capturadas. Configurações completas de não correspondentes continuam disponíveis ao limpar filtro.

Inspeção por path mantém valueType/complete/reasons/data, com count/state/expression e keys. Keys incluem tempos/valores/interpolação/eases/flags temporais e dados espaciais aplicáveis. Falhas ficam null com motivo e cobertura parcial. Easy Ease-like é padrão numérico, não prova de comando. Comparação exata é somente dos campos suportados e completos; não é Animation Fingerprint universal. Não há escrita/cópia de animação.

## UI e escrita

Active Target é o foco; Operation Selection são mapas por chave. Clique substitui, Ctrl alterna, Shift percorre linhas visíveis do mesmo tipo e Ctrl+Shift soma. selectionAnchor/gesture/consumedKey são transitórios. fxParentNode/fxDepth/fxLeaf identificam a estrutura visual sem atravessar parent nativo. Marcas [x]/[-]/[ ] refletem membros; filtros excluem ocultos. Paginação limita o intervalo manual, não os membros completos de grupo selecionado.

editRows agrega valores estáticos e currentValue dos states em valueGroups/value/count, values, previous e unknownValues. Current não representa somente a parcela estática: valores conhecidos mais alvos desconhecidos geram Mixed / unavailable. drafts associa path a textos/menu, linha segura e removeKeyframes/keepCurrent transitórios. Valores novos começam vazios; removeKeyframes com campo vazio gera keepCurrent, resolvido em linhas por alvo em plan.targetRows. Autorizações de limpeza incluem currentValue para detectar mudanças após revisão. requireAll bloqueia previsão parcial e exige pré-validação completa antes das escritas do editor. Reset remove draft, Cancel não gera plano. Consentimento parcial permanece restrito aos outros fluxos que já o admitem.

BatchPlan permanece: scanId/project/operation/targets/options/contagens. ExecutionReport agora inclui completed, changed/skipped/failed, written/verified/verificationFailed/unknown/failedBeforeWrite/propertiesSkipped, outcomes por propriedade, issues e affectedCompositions. changed conta alvos com método retornado, não garantia de valor retido; pode sobrepor failed. written conta setValue retornado; verified exige readback exato. Unknown pode contar uma invocação incerta ou erro de Undo. Contagens por alvo/propriedade/evento não devem ser somadas como unidades iguais. outcomes usa os cinco estados descritos em USER_GUIDE. Batch.lastReport preserva resultado parcial mesmo quando execute lança antes das escritas; completed=false em aborto/erro de Undo.

refreshTargets é transitório e leve: guarda de projeto, IDs estáveis de layer, nome, assinatura estrutural e identidade única dos efeitos afetados. Refresh só recupera seleção inequívoca do novo Basic; nunca configuração anterior. Alterar Scope descarta a recuperação. Após Remove/alteração estrutural, layers identificáveis podem ser selecionadas sem reatribuir índices antigos a outros efeitos.

Diagnostics.metrics contém `{count,totalMs,maxMs,lastMs,items}` por nome técnico fixo; entradas de motivo permanecem limitadas a 500. Não inclui nomes de projeto/layers, valores ou dados de licença nas métricas. Cache visual limita três agrupamentos e páginas de 200 registros.

Errors contêm campos primitivos message/operation/line/fileName/stack, com string vazia para metadado indisponível. O objeto host original nunca é serializado/coagido. editorDraft fica ligado a scanId/revisão/conjunto de alvos; reabrir a mesma seleção recupera textos, sem autorizar escrita automaticamente. sessionEpoch é guarda de callbacks, não identidade persistente.

View occurrences continua padrão transitório, sem persistir preferência nova nem mudar schema v2. Cada folha contém exatamente uma ocorrência; seus IDs continuam sujeitos à revalidação. selecting protege eventos recursivos, sem reescrita de rótulos. Clique com query pendente usa somente a chave reencontrada na nova view; ausência limpa a seleção, nunca reaproveita objeto removido da árvore. Grupos permanecem opcionais; contagens e semântica de páginas/ocultos não mudam.

Na 0.1.7 mainView ordena Effects/Groups/Layer. As travas de inicialização/diálogo permanecem locais. Basic automático após sucesso usa refreshTargets, descarta configurações anteriores e preserva lastReport. Snapshots/fingerprints e preferências não mudaram de schema.

Preset library v1: {schemaVersion:1,product:'FX Exchanger Presets',presets:[{id,name,matchName,rows,omitted}]}. Rows têm path/name/valueType/value, sem Enabled/keys/expressions/código. Schema estrito, nomes/IDs únicos, valores finitos e limites de paths/quantidade. presets.json é independente de state.json. Export contém dados salvos; import faz merge atômico, recusa conflitos e ignora idênticos. Clipboard usa matchName/sourceName/rows/omitted só na sessão. Batch apply pode conter rows/presetName; report.created conta novas instâncias mesmo quando a aplicação de parâmetros é parcial/incerta. Uma instância criada pode permanecer após falha. Keyframe table guarda apenas referências aos metadados de inspeção; não autoriza animação editável.

## Metadados de elegibilidade na 0.1.10

Configuration pode incluir `parameterProfile` (perfil identificado) e `excluded` (path/reason/name sem valor). Campos de sistema/internos conhecidos ficam fora dos ajustes comparados/editáveis. Dados públicos inacessíveis e campos desconhecidos relevantes continuam em `unsupported`, impedindo falsa igualdade completa. Esses metadados transitórios não entram no schema de presets. A política é reaplicada aos caminhos atuais antes de escrever, mesmo quando a origem é um snapshot/preset anterior.

## Continuidade de edição na 0.1.11

refreshTargets inclui página/foco identificável e intenção transitória de releitura após sucesso de set/copy. restoreRefreshTargets retorna somente identidades recuperadas; essas ocorrências do novo inventário autorizam a segunda fase. pendingParameterRefresh registra project/expected/skipped até conclusão, erro ou cancelamento, sem persistir em preferências. A nova análise não amplia o lote nem autoriza repetir a escrita. Results da mutação permanece independente do estado dessa leitura. Na 0.1.12, a reabertura requer a intenção explícita inicial de Edit ou Apply and continue.

## Controles e drafts (0.1.12)

Linhas e states podem incluir control: kind number/menu/unavailable-menu, limites min/max, units e, em menus, choices [{value,label}] e source host/deep-glow-2. value é o índice real do host, inclusive lacunas de separadores. Nenhuma alteração no menu é executada. Fingerprints incluem o mapa de menus. A interseção dos limites e a igualdade dos mapas determinam a compatibilidade.

Presets schema 1 aceitam control opcional e validam estritamente seus campos. Bibliotecas antigas continuam aceitas pela versão atual; versões antigas podem rejeitar metadados novos. Faça exportação/backup antes de alternar versões.

Drafts do editor são transitórios, por scan/revisão/seleção/path, com textos numéricos ou menuValue e autorização removeKeyframes por parâmetro. Pesquisa/filtros não os removem. Cancelar confirmação permite recuperação na mesma revisão; aplicar limpa drafts e autorizações. lastEditorPath guarda apenas o path e o matchName durante a sessão. A intenção de continuação guarda projeto e conjunto exato de chaves, nunca constitui autorização permanente de escrita.
