# FXHX — checklist manual progressivo

> **0.1.16:** o checklist obrigatório de release é o [smoke test no AE](HOST_SMOKE_CHECKLIST.md). As seções abaixo são verificações detalhadas por versão, úteis para investigar regressões. Na 0.1.16, "Remove keyframes (this parameter, all selected effects)" passou a se chamar "Remove keyframes (all selected effects)", e o Apply do editor mostra a contagem ("Apply 2 changes").

## Verificações da 0.1.15

- [ ] Selecionar efeitos em duas layers, Radius 200 estático e 100 com keys. Conferir Mixed Values, Previous values `200 (1); 100 (1)` e valores por layer em View targets. Buscar 100 e voltar sem perder drafts.
- [ ] Preparar Radius 150 sem autorizar remoção: Apply bloqueado e orientação visível. Autorizar keys desse parâmetro: 2/2, revisão `200 (1); 100 (1) -> 150`, sem checkbox de aplicar só ocorrências compatíveis. Confirmar: ambos 150 e keys dos demais parâmetros preservadas. Undo restaura valores e keys.
- [ ] Threshold Mode com uma única key: conferir Single keyframe / filtro Has keyframes. Marcar remoção, manter Keep original values e confirmar: apagar a key preservando o modo atual. Repetir com novo modo e com parâmetros exclusivamente keyframed.
- [ ] Marcar remoção em Radius sem novo valor: remover keys mantendo 200 e 100 nos respectivos alvos. Cancelar a confirmação não escreve; reabrir mantém draft. Após sucesso, reabrir sem autorização herdada.
- [ ] Preparar Radius 150, Threshold Mode Luminance e Threshold 65; conferir três pendências, anteriores/destinos e aplicação de todos os parâmetros em todos os alvos num único Undo.
- [ ] Expressions, locks, ausência de parâmetro e opções incompatíveis devem bloquear todo o lote do editor. Conferir valores indisponíveis sem representar a seleção pelo único valor legível. Não pode haver opção de aplicar apenas parte dos alvos.
- [ ] Conferir campo rolável Previous values, pendências e View targets em 100/150/200% DPI. Navegar entre parâmetros, buscar sem resultados e voltar: dimensões e valores devem permanecer legíveis.

Os contratos históricos de aplicação parcial no editor ficam substituídos pela exigência de toda a seleção. As proteções de Copy/Paste e presets mantêm seus próprios contratos.

## Verificações da 0.1.14

- [ ] Conferir que há somente Apply. Aplicar vários parâmetros, aguardar atualização e constatar que a janela permanece fechada. Reabrir Edit Parameters: mesmos alvos recuperados, valores atuais, último parâmetro e novos campos vazios, sem permissão herdada de remover keys.
- [ ] Preencher número e menu; conferir `*` nas linhas e Pending change no título. Buscar outros parâmetros e voltar: propostas e marcas devem permanecer.
- [ ] Digitar valor inválido: conferir `!`, Invalid value e Apply desabilitado. Navegar e voltar, corrigir e conferir retorno para `*`; limpar a alteração remove a marca.
- [ ] Conferir busca, filtro Pending changes, tabela de pendências, Clear this change/Clear all changes e confirmação detalhada. Rótulos não devem mover seleção/foco nem alterar drafts.
- [ ] Após aplicação, reabrir manualmente: nenhuma marca antiga permanece. As seções históricas abaixo que descrevem dois botões deixam de se aplicar.

## Verificações da 0.1.13

- [ ] Abrir Edit Parameters começando em Blend Mode. Alternar para Threshold e Radius: campo New value deve aparecer com altura/largura utilizáveis, mesmo após redimensionar.
- [ ] Preparar Add no menu, depois valores numéricos e voltar aos parâmetros anteriores: pendências, entradas e destinos devem permanecer corretos. Apply confirma um lote; Undo restaura os valores.
- [ ] Alternar entre componentes de vetores/cores, números e menus; buscar sem resultados e limpar a busca. Nenhum campo ativo pode conservar tamanho zero ou ficar escondido por um ancestral.
- [ ] Repetir a alternância em Edit preset, salvar um valor numérico e conferir que somente a biblioteca muda.
- [ ] Conferir explicação e tooltips: Apply mantém o editor fechado, Apply and continue reabre uma vez após atualizar com sucesso. Repetir em 100/150/200% DPI.

## Verificações da 0.1.12

- [ ] Selecionar efeitos do mesmo tipo e clicar Edit Parameters sem leitura anterior. Preparar somente esses alvos e abrir uma janela; Cancel não reabre o editor. Search, View e abertura do painel não abrem diálogos.
- [ ] Buscar duas palavras, limpar a busca e usar Editable/Animated/Pending changes/Unavailable. Digitar não deve reler o projeto.
- [ ] Preparar dois números e um menu, escondendo os anteriores pela busca. Conferir três pendências, clicar nelas para navegar e aplicar tudo num lote. Valores não preenchidos e efeitos fora da seleção permanecem iguais; Undo desfaz esse lote.
- [ ] Digitar valor inválido e fora da faixa. Apply deve ficar desabilitado; Clear this change/Clear all changes descartam apenas pendências.
- [ ] Em cópia de teste com Deep Glow 2, conferir Screen/Add do Blend Mode com os valores reais; selecionar Add e verificar o resultado na interface original. Debug Analysis Enable não deve aparecer. Outros modos só recebem rótulos quando expostos pelo host.
- [ ] Conferir menus de efeitos nativos/comerciais via propertyParameters no AE 26+, incluindo separadores. Opções divergentes entre instâncias não devem gerar edição conjunta. Em hosts antigos, conferir indisponibilidade quando o menu é reconhecido sem rótulos.
- [ ] Apply mantém a seleção pronta sem reabrir. Apply and continue deve atualizar e reabrir uma vez, no último parâmetro, com campos em branco e sem autorização de apagar keys herdada.
- [ ] Testar duas instâncias idênticas na mesma layer: selecionar ambas permite continuidade se a estrutura ficar igual; selecionar apenas parte da família continua sem recuperação ambígua.
- [ ] Cancelar, trocar escopo/projeto, limpar seleção, executar Scan ou fechar o painel enquanto aguarda reabertura. Nenhum callback antigo deve abrir editor ou escrever.
- [ ] Conferir modo compacto de um parâmetro, opção de keys contextual, valores atuais/novos nas colunas, pendências, 100/150/200% DPI, teclado e tela de altura reduzida.
- [ ] Conferir More por seções e Results com resumo, Technical details expansível e Save report. Registro JSON deve corresponder ao lote; nenhum caminho de exportação deve aparecer sem solicitação.

As seções abaixo registram contratos históricos. A reabertura solicitada por Apply and continue e a preparação inicial por Edit Parameters são as exceções explícitas às antigas regras de não abrir automaticamente após leitura.

## Verificações da 0.1.11

- [ ] Selecionar poucos efeitos nativos, ler parâmetros e alterar um valor. Aguardar atualização automática e editar novamente sem Scan/Read Parameters extra. Conferir valores atuais e Results preservado.
- [ ] Nenhum modal reabre sozinho após atualização, abertura do painel ou troca de View. Na página 2+, a página/foco identificável e a seleção do lote permanecem.
- [ ] Conferir que somente os mesmos alvos são relidos. Outros efeitos não são analisados. Scan/Refresh manual, Enable/Disable/Add/Remove não passam a ler parâmetros automaticamente.
- [ ] Cancelar atualização posterior: valor aplicado permanece; texto esclarece que o cancelamento não foi Undo. Falha de releitura mantém Results e não reaplica valores.
- [ ] Trocar escopo/projeto ou fechar durante atualização impede callbacks antigos de ler o projeto anterior. Identidades ambíguas não são adivinhadas.
- [ ] Testar filtro Animated após conversão de keys: efeitos que passam a estáticos deixam o filtro com explicação; nenhum alvo novo entra no lote.
- [ ] Executar as tarefas propostas na análise de UX com participante e registrar dúvidas/erros antes de implementar a reorganização visual ampla.

## Verificações da 0.1.10

- [ ] Em cópia do projeto de teste, selecionar AI Color Match → Read Parameters → Edit Parameters. Conferir somente Intensity; nenhum Connection Timestamp, Effect Opacity, GPU Rendering, botão ou campo privado no editor.
- [ ] Comparar cada Intensity com a interface do efeito; não inferir default 50/100 entre versões. Preencher um valor conhecido e confirmar apenas os alvos esperados. Conferir composição e dados não escolhidos; Undo manual.
- [ ] Registrar matchName/versão do efeito. Renomear só uma instância e conferir que o perfil se mantém. Testar versão com schema diferente sem assumir visibilidade a partir de números.
- [ ] Efeito com opacidade própria pública deve continuar oferecendo esse ajuste. Compositing Options do host e GPU não entram no editor, em cópia ou em presets novos.
- [ ] Presets antigos com campos protegidos não podem alterá-los nem remover suas keys. Preset contendo somente campos protegidos deve ser recusado antes de Add Effect.
- [ ] Confirmar que a atualização não modifica/restaura valores internos já alterados. Para recuperar o teste anterior, usar Undo disponível ou projeto anterior, preservando o estado atual antes da recuperação.

## Verificações da 0.1.9

- [ ] Selecionar mesmo efeito com parâmetro estático, keyframed, com expression (inclusive desativada), layer bloqueada e dados indisponíveis. Conferir totais e tabela Occurrences for this parameter.
- [ ] Conversão começa desmarcada por parâmetro; editar campo estático preserva keys. Numérico totalmente animado permite abrir editor, mas os campos ficam bloqueados até marcar a opção.
- [ ] Marcar remoção, preencher valor e cancelar editor/confirmar sem consentimento de remoção: zero alterações. Reabrir draft, conferir path e valores, marcar consentimento final e aplicar.
- [ ] Conferir contagens exatas, valor fixo, demais parâmetros/keys, expressions, curvas opacas e destinos fora do lote preservados. Results contabiliza keys removidas. Undo manual deve restaurar keys e valores anteriores.
- [ ] Alterar quantidade de keys/expression depois de Read Parameters: nenhum alvo deve ser escrito quando a revalidação prévia falhar. Campo fora dos bounds não deve perder keys.
- [ ] Em teste de desenvolvimento controlado, erro durante remoção/setter registra Unknown/alterações parciais, sem retry e sem Refresh automático. Revisar projeto e Undo antes de repetir.
- [ ] Conferir layout do editor com checkbox e botões em linhas, tabela de ocorrências, foco, Enter/Esc e docking/DPI.

## Verificações da 0.1.8

- [ ] Todas as linhas selecionadas recebem destaque nativo de cor, com foco na lista e após clicar em outro controle. Conferir temas/DPI. `[-]` continua indicando grupos parciais.
- [ ] Ctrl acrescenta/retira o penúltimo e o último alvo; clique simples substitui mesmo sem onChange. Shift amplia e reduz intervalos; Ctrl+Shift soma. Conferir contador, cor e destinos na confirmação.
- [ ] Duplo clique e Left/Right expandem/recolhem grupos; descendentes recuperam o destaque sem mudar o lote. Filtros/páginas preservam as regras de escopo.
- [ ] Em cópia temporária, selecionar Lumetris com exposição, saturação e curvas diferentes; alterar somente Vibrance para 20. Conferir cada destino e ocorrência fora do lote, curvas, animação, expressions e Undo. O teste automatizado é sintético.
- [ ] Campos customizados/opacos mostram motivo e nome disponível, ficam bloqueados e são preservados. Não há editor gráfico genérico.

As etapas históricas abaixo continuam como regressões. A conexão e a instalação atuais não foram consultadas nesta tarefa; o bloqueio de Computer Use descrito abaixo pertence ao registro da 0.1.7.

**Todos os testes reais desta candidata estão pendentes.** O JSX instalado foi observado como 0.1.6; esta tarefa não instalou ou encerrou processos. A 0.1.5 continua retirada de uso pelo incidente histórico da 0.1.6. Preserve trabalho antes de recarregar. Use projeto temporário com efeitos nativos em A–E/G/H. Sem -r, launchers, headless ou fixtures automáticas. Não alterar licenças, ativação, Manager, instalações de terceiros ou antivírus.

**Bloqueio desta sessão:** Computer Use não conseguiu conectar ao pipe nativo (os error 2), mesmo após recuperação. A solicitação de testar diretamente no AE ainda não foi cumprida. Este checklist não é um registro de aprovação.

Registre em cada etapa: versão do AE/painel, resultado, último passo, diagnóstico e estado dos valores. Pare no primeiro erro inesperado; não repita escrita incerta. Salve evidências antes de nova tentativa, quando o host permitir. Node/mocks não aprovam estas etapas.

## A — Pesquisa sem escrita

- [ ] Com trabalho salvo e painel 0.1.7 instalado, abrir AE com o dock restaurado automaticamente: nenhum modal Advanced groups/paths, scan, tarefa ou efeito novo. Repetir abertura/reabertura do painel, com preferência de escopo/grupo antiga.
- [ ] Conferir View em Effects/Groups/Layer, nessa ordem; nenhuma janela automática. Selecionar resultados → More → Grouping... abre uma vez. Cancel/X/Use view fecham sem loop.
- [ ] Ctrl escolhe e retira alvos um a um, marcados [x]; grupo com membro excluído mostra [-]. Shift seleciona intervalo visível do mesmo tipo; Ctrl+Shift soma. Click simples substitui. Repetição de onChange/click não alterna duas vezes. Valores dos efeitos permanecem intactos durante seleção.
- [ ] Comparar contador e confirmação com os alvos marcados, incluindo filtros ocultos/páginas. Executar uma operação nativa só nos alvos escolhidos; nenhum oculto/não marcado alterado. Nomes decorativos mostram matchName; original intacto em Details.
- [ ] Conferir versão **0.1.7 dentro de Help/Diagnostics**, sem versão após Help. Help fica no canto direito e abre com/sem seleção. View começa em **Effects**: uma linha por efeito, sem grupos obrigatórios.
- [ ] Antes de Scan, digitar Glow e clicar Search/Enter em escopo com efeito nativo: faz somente Basic, aplica consulta e permite selecionar. Repetir informa contagens sem novo inventário ou leitura de parâmetros. Consulta sem resultados explica o próximo passo.
- [ ] Com escopo inválido, Search dá motivo; escolher composição válida e repetir deve recuperar. Após dados obsoletos, Search faz novo Basic; Clear não inicia scan.
- [ ] Scan em projeto temporário com efeito nativo. Digitar vários termos, apagar e repetir rapidamente: sem reconstrução da árvore por caractere e sem alerta/erro de conversão associado à antiga linha 3453.
- [ ] Enter/Return aplica consulta, inclusive em projeto pequeno; contador/seleção corretos, sem novo Scan. Consultar/copy em Help > Diagnostics se houver erro.
- [ ] Repetir com Search e Clear; digitar sem Enter e clicar numa ocorrência que ainda corresponde: deve aplicar consulta, selecionar exatamente aquela ocorrência e habilitar Read Parameters/Enable/Disable/Add Effect. Se não corresponde, não pode autorizar o alvo antigo.

## B — Scan, análise, cancelamento e Refresh sem escrita

- [ ] Repetir Scan → selecionar → Read Parameters, pesquisa/Enter, cancelamento entre etapas e novo Scan. Nenhuma instância/propriedade modificada.
- [ ] Alterar escopo explicitamente; testar composição ausente e escopo novamente válido. Falha de início não apaga a sessão anterior; novo Scan continua possível.
- [ ] Fechar/reabrir painel durante trabalho pendente, sem callback antigo operar a nova sessão. Cancel não promete interromper uma API síncrona em andamento.

## C — Uma escrita nativa e Undo

- [ ] Uma ocorrência nativa, um parâmetro estático. Edit → valor → Apply fecha editor antes de abrir confirmação. Cancelar confirmação escreve zero; reabrir recupera draft na mesma seleção/revisão.
- [ ] Confirmar a mudança. Editor e confirmação já fechados durante execução. Results informa Written and Verified somente após retorno/readback. Conferir valor no Effect Controls e parâmetros não selecionados.
- [ ] Após sucesso, Basic Refresh inicia uma vez, sem ler parâmetros profundos; Results permanece. Read Parameters posterior continua explícito. Executar Undo manual e Scan/Read Parameters para conferir restauração.

## D — Três ocorrências nativas

- [ ] Selecionar resultados explicitamente com Select Results; conferir contador, outras páginas incluídas e ocultos excluídos. Grupos de configuração são opcionais de View, não etapa obrigatória.
- [ ] More → Grouping... abre opções separadas; Cancel preserva View. Selected parameters sem paths válidos preserva o modo anterior. Três instâncias nativas numa layer: selecionar só o parâmetro desejado e confirmar exatamente 3 effects / 1 layer / 1 composition.
- [ ] Conferir individualmente os três valores após retorno; demais parâmetros, Enabled, outras instâncias, keys e expressions intactos. Inspecionar Results, não inferir sucesso de janela fechada.
- [ ] Undo, Refresh, Read Parameters e nova navegação devem continuar utilizáveis. Opcionalmente repetir o cenário Glow 18 documentado no USER_GUIDE.
- [ ] Enable/Disable diretos alteram só Enabled após confirmação, sem leitura profunda desnecessária. View → Layers permite Add Effect em layer vazia compatível; layer incompatível/lock deve ser recusado ou preservado com motivo. Não testar ativação de licença.

## E — Recuperação controlada, somente nativos

- [ ] Depois de Read Parameters, alterar externamente um parâmetro ou estrutura e confirmar tentativa pelo painel: deve recusar dados alterados antes de escrever, oferecer Refresh e permitir nova análise.
- [ ] Usar valor fora dos bounds nativos documentados, quando disponível: falha anterior à escrita com motivo; conferir projeto e testar Refresh. Não usar propriedade comercial nem mutação de configurações do sistema para provocar erro.
- [ ] Em build temporário de desenvolvimento revisado, simular erro de apresentação/preview/readback (sem plugin comercial). Retry display preserva scanner; readback falho mostra Written but Verification Failed, nunca “preservado”; erro do método mostra Unknown. Verificar Results acessível e ausência de retries. Não distribuir build com injeção de falhas. Nenhuma injeção é ativada no produto final desta entrega.
- [ ] Cancel/erro/fechamento encerram Edit, Confirm, More, Compare e Diagnostics. Teclas Enter/Esc, resize e callbacks de janela fechada não geram reentrada ou alertas repetitivos.

## F — Comercial: bloqueado nesta entrega

- [ ] Só avaliar depois de A–E aprovados e autorização específica do usuário. Usar cópia de projeto e abertura manual, registrando estado antes de carregar o painel.
- [ ] **Primeiro teste comercial sem aplicar valores em lote.** Basic, depois análise seletiva autorizada, métricas e observações. Não criar instâncias só para testar ativação. Não concluir causalidade de licenciamento a partir de correlação temporal.

## Verificação visual complementar

- [ ] Copy Parameters escolhe origem/linhas estáticas. Ctrl/Shift escolhe destinos do mesmo efeito; Paste confirma contagens e preserva parâmetros não escolhidos, keys/expressions, origem e outros efeitos. Cancel escreve zero. Clipboard congelado não relê a origem.
- [ ] Save Effect Preset salva um efeito/linhas, informa omissões e não altera projeto. Presets edita valor, renomeia, exclui com confirmação e persiste após reabertura. Diretório exclusivo, backups e preferências preservados.
- [ ] Exportar toda a biblioteca para JSON temporário; importar em biblioteca de teste, idênticos ignorados. ID/nome conflitante ou arquivo inválido cancela tudo, sem sobrescrita/merge parcial. Nenhum dado é executado. Não usar arquivos de licença/sistema nos testes.
- [ ] Add Effect → Saved presets inclui uma nova instância em layer compatível e verifica valores. All effects continua disponível. Erro após criação mantém instância e informa New effect instances/Unknown; sem retry automático. Undo manual restaura quando o host oferecer suporte. Não provocar falhas com plugins comerciais.
- [ ] Inspect Animation mostra tabela key/tempo/valor/curva somente após Inspect Selected; clicar key mostra metadados, sem escrita. Confirmar tempos, eases, interpolação e todos os valores intactos no AE. Presets/cópia estática excluem animação e expressions.
- [ ] Após erro/Unknown/Verification Failed, nenhuma atualização/repetição automática; Results continua acessível. Falha no Basic automático também preserva relatório e exige ação explícita para nova tentativa.

- [ ] Docked/floating em 280×160, 320×240, 360×520, 480×680 e 600×800; DPI/fontes, nomes longos e Effect & Presets simultâneo. Help à direita, campos alinhados e ações estreitas em duas linhas, sem sobreposição.
- [ ] Reduzir altura: scrollbar aparece e alcança últimas ações/Results. Aumentar: conteúdo cabe, offset retorna ao limite e não fica cortado. Cabeçalho continua acessível.
- [ ] Testar roda sobre corpo e sobre árvore separadamente. Registrar se o host fornece eventos ao corpo; árvore deve manter rolagem nativa. Scrollbar e Page Up/Down fora da árvore/campos continuam funcionais mesmo sem roda.
- [ ] Scroll de Results/confirmação/Help, seleção de páginas e fechamento/reabertura sem callbacks antigos. Mínimo declarado não comprova legibilidade; registrar capturas e dimensões reais.

Se o AE bloquear numa API síncrona, Cancel e timeouts do painel não podem interrompê-la. Se o host não devolver controle, pode ser necessário reiniciar manualmente, com risco de perder alterações não salvas. Não presumir se uma escrita aconteceu. Registrar último passo e revisar valores/Undo antes de repetir. Não declarar congelamento resolvido sem evidência real.
