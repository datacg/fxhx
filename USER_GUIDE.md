# FX Exchanger 0.1.15 — guia de uso

**Atualizações:** em Help, clique Check for updates. O painel consulta a última Release pública estável de [datacg/fxhx](https://github.com/datacg/fxhx/releases), compara a versão numericamente e informa se há atualização. Open Releases abre a página no navegador para download e instalação manual. A consulta exige internet e Windows PowerShell; não envia dados do projeto nem começa ao abrir o painel/Help. Falhas de conexão não são tratadas como versão atualizada.

Versão inicial 0.1.15. A validação automatizada usa mocks; testes visuais e funcionais dentro do After Effects ainda estão pendentes.

## Localizar e agrupar

Escolha Active Composition, Choose Compositions ou Entire Project. Digite Find e use Search/Enter. Sem inventário válido, executa Basic; depois pesquisa em memória. Scan renova explicitamente o inventário. Basic lê metadados, sem valores profundos ou novas instâncias. Abrir o painel não inicia scan, análise, teste ou modal.

View tem **Effects / Groups / Layer**, nessa ordem. Effects mostra composição/layer/índice/ocorrência. **Groups** compara configurações depois de **Read Parameters**; não representa sets de vários efeitos. **Layer** inclui layers vazias. More → Grouping... escolhe configuração/tipo/paths; Selected parameters abre o seletor de paths após fechar o diálogo. Cancel/falha preserva o modo anterior. Trocar View não abre janelas.

Matching settings exige cobertura completa. Readable settings match / Partial contém dados desconhecidos, inclusive animação; Not analyzed não comprova igualdade completa. Hashes não substituem comparação canônica.

Nomes vazios ou só com pontuação/sublinhados mostram matchName, preservando o original. More → Details → Look up registered name consulta o registro explicitamente.

## Selecionar o lote

Clique simples substitui. **Ctrl-clique** alterna um alvo/grupo. **Shift-clique** seleciona intervalo de linhas visíveis do mesmo tipo; **Ctrl+Shift** soma o intervalo.

Todas as linhas selecionadas recebem o **destaque nativo de cor**, que acompanha o tema/estado de foco do host. Marcas persistentes: **[x] selecionado**, **[-] grupo parcial**, **[ ] não selecionado**. Grupos parcialmente selecionados conservam `[-]` sem destaque de seleção completa. Duplo clique num grupo ou Left/Right recolhe/expande os filhos. Ctrl numa ocorrência de grupo selecionado pode excluí-la. Os botões usam só os membros selecionados que correspondem aos filtros.

Select Results escolhe todos os resultados correspondentes, inclusive outras páginas. Clear Selection limpa inclusive ocultos. Paging limita a 200 registros por página. Shift não atravessa páginas/filhos recolhidos; selecionar grupo pode incluir membros fora da página, informados no contador/confirmação. Ocultos por filtro ficam excluídos. More → Add to Selection é alternativa sem modificadores.

## Editar e atualizar

Edit Parameters prepara somente as ocorrências selecionadas relevantes e abre o editor. More → Read Parameters oferece a leitura separada para comparação. Valores novos começam vazios. Mixed Values considera valores estáticos e snapshots atuais de propriedades com keyframes, sem torná-las estáticas para comparação/cópia/presets. Previous values mostra cada valor com sua contagem de efeitos, por exemplo `200 (1); 100 (1)`. Pendências e confirmação mostram esses valores e o destino `150`. Valores não legíveis aparecem como Unavailable. Apply fecha o editor antes da confirmação/Batch. Cancel não escreve; recusar confirmação permite reabrir o draft na mesma seleção/revisão.

**Campos públicos e internos:** o editor exclui Compositing Options do AE, Effect Opacity, GPU Rendering e Connection Timestamp. Esses campos também ficam protegidos na escrita, remoção de keys e aplicação de presets antigos. A opacidade pública própria de outro efeito, como um controle normal chamado Opacity, permanece suportada. No perfil AI Color Match, somente **Intensity** aparece como ajuste numérico; botões, referência de layer, dados gráficos e campos privados não entram no editor. Valores existentes são mantidos; não há reset para 50 ou 100.

A API ExtendScript não informa de modo universal quais campos um plugin apresenta em sua interface. As regras usam identidades/caminhos e perfis de compatibilidade, sem confundir efeito renomeado, grupo recolhido ou grupo elided com visibilidade. Outros plugins podem precisar de perfis específicos. Esta versão não restaura valores internos alterados anteriormente; use Undo, se disponível, ou uma cópia anterior do projeto.

**View targets** mostra composição, layer, índice/nome do efeito, valor anterior e status de cada ocorrência: Editable (static), Single keyframe, Keyframed com quantidade de keys, Expression protected, Locked layer, Blocked ou Missing. O filtro Has keyframes inclui propriedades com uma única key.

**Remover keyframes do parâmetro escolhido:** marque **Remove keyframes (this parameter, all selected effects)**. Uma única key também pode ser apagada. Com novo valor, todos os efeitos selecionados recebem esse valor; com campo vazio ou Keep original values, cada efeito mantém seu próprio valor atual e as keys desse parâmetro são removidas. Apply mostra contagens e exige **I agree to remove ... keyframes**. Clear this change apaga o draft e desmarca a opção. Os keyframes dos outros parâmetros permanecem.

**Toda a seleção:** cada pendência deve atender todos os efeitos selecionados. Se faltou autorizar remoção de keys, Apply fica desabilitado e orienta a correção. Expressions, locks, tipos/menus incompatíveis e parâmetros ausentes bloqueiam o lote; View targets mostra o motivo. Não existe aceite para aplicar só parte da seleção no editor. Resolva o impedimento, limpe a pendência ou altere a seleção explicitamente. A pré-validação verifica todos os alvos antes da primeira escrita; erros posteriores do host ainda podem deixar alterações parciais, relatadas em Results.

**Exemplo Lumetri com valores diferentes:** procure Lumetri em Effects, escolha as ocorrências com Ctrl/Shift ou Select Results, use Edit Parameters. Selecione Vibrance, digite **20** em New value e deixe os outros parâmetros vazios. Apply e a confirmação alteram somente Vibrance dos destinos compatíveis. Exposição, saturação e todos os demais valores individuais permanecem como estavam. Não é necessário que os efeitos pertençam ao mesmo grupo de configuração.

**Curvas e controles gráficos:** números, vetores e cores expostos pelo efeito usam os campos numéricos existentes. Controles customizados/opacos, como algumas curvas, aparecem como Cannot edit safely com explicação e ficam bloqueados. Continuam preservados quando outro parâmetro é alterado; sua edição deve ser feita na interface do efeito no After Effects. O painel não incorpora um editor gráfico genérico nem replica dados privados do plugin. Keyframes são preservados por padrão; expressions permanecem protegidas. Veja [detalhes](docs/MIXED_VALUES_0.1.15.md).

Após operação concluída com mudanças e sem falha/incerteza, **Basic Refresh é automático**. Em edição/cópia de parâmetros, o plugin também relê somente os mesmos alvos recuperados com segurança. **Edit Parameters fica disponível novamente sem outro clique em Scan/Read Parameters.** Página e foco de ocorrência identificável são preservados; Results continua acessível. Há somente **Apply**: a janela permanece fechada. Clique novamente em Edit Parameters para continuar com os valores atuais, novos campos em branco e sem herdar autorização para remover keyframes.

Scan/Refresh manual continua Basic; Enable/Disable/Add/Remove não passam a analisar parâmetros automaticamente. Cancelar a atualização depois de Apply não desfaz os valores já aplicados. Se a releitura falhar, confira Results e execute a recuperação indicada. Erro/incerteza de escrita exige revisão e não inicia atualização/repetição automática. Efeitos que saem dos filtros são informados e não entram em outra escrita por engano.

Exemplo Glow 18: Search Glow → Select Results → Read Parameters → Groups (padrão Configuration/layer type): Text=50 (3), Adjustment=6 (12), Adjustment=7 (3). Selecionar apenas grupo 7 e mudar Intensity para 6 preserva Text/Radius. A seleção editada é relida automaticamente; para incluir outros alvos na comparação, selecione-os e leia seus parâmetros quando necessário. Valores são exemplos, nunca impostos ao projeto.

## Busca, alterações em lote e menus

**Find parameter** filtra as palavras digitadas pelo nome, caminho ou valor atual, sem ler novamente o projeto. O filtro ao lado mostra All parameters, Editable, Animated, Pending changes ou Unavailable. Limpar a busca não limpa alterações.

Preencha um parâmetro, escolha outro e preencha o segundo. A tabela **Pending parameter changes** mantém todas as alterações, inclusive as ocultas pela busca. Clique em uma pendência para voltar ao parâmetro. **Clear this change** descarta só a alteração atual; **Clear all changes** descarta o lote pendente. Esses botões não restauram valores já aplicados no projeto. Apply envia todas as pendências de uma vez, com uma confirmação e um grupo de Undo. Valores inválidos impedem aplicar o lote.

Na lista principal, **`* Nome` indica alteração pendente** e **`! Nome` indica valor inválido**. O título do parâmetro repete Pending change ou Invalid value, e a coluna New value mostra a proposta. As marcas acompanham os drafts durante busca/filtros e desaparecem quando são limpos ou aplicados. São propostas para o próximo lote, não um histórico de alterações anteriores. A confirmação continua listando cada alteração antes da escrita.

Em menus reconhecidos, New value apresenta **Keep original values** e as opções pelo nome. No Deep Glow 2, selecione Blend Mode e depois Add para trocar Screen por Add nos destinos compatíveis. Índices/separadores são preservados. Rótulos vêm de propertyParameters (AE 26+) ou de perfil verificado; o fallback específico do Deep Glow 2 cobre apenas Blend Mode. Não há garantia universal para todos os dropdowns ou plugins em hosts antigos. Menus reconhecidos sem opções válidas ficam indisponíveis.

Limites e unidades fornecidos pelo host são exibidos sem conversão ou suposição de escala. Efeitos com mapas de opções incompatíveis não são editados juntos. Um único parâmetro usa um editor compacto; controles de remoção de animação só aparecem quando aplicáveis. O último parâmetro é lembrado durante a sessão; a autorização para apagar keys não passa para o próximo lote.

## Copiar parâmetros e presets

1. Selecione ocorrência/grupo analisado e use **More → Copy Parameters...**.
2. Escolha a origem e as linhas estáticas; fica um snapshot no clipboard da sessão do painel.
3. Selecione destinos analisados do mesmo matchName, inclusive Ctrl/Shift, e use **Paste Parameters...**. Confira confirmação/Results.

Não há conversão entre plugins. Parâmetros animados/expressions são preservados nas escritas estáticas. Copy Settings From/Compare permanecem como alternativas, usando snapshots ou referência explícita do Effect Controls.

**Save Effect Preset...** usa a mesma escolha de origem/linhas e pede nome. Salva somente linhas estáticas de um único efeito, com omissões explícitas. Não inclui Enabled, keyframes, expressions, sets ou dados opacos.

**Presets...** permite editar um valor por vez, renomear, excluir com confirmação, aplicar aos efeitos existentes compatíveis e importar/exportar toda a biblioteca JSON. Editar o preset não altera o projeto. Arquivo: Folder.userData/FXExchanger/presets.json, separado das preferências, com staging/backups/rollback/concorrência. Não é um .ffx nativo.

Importação valida schema, IDs/nomes, paths, tipos e números finitos, sem executar código. Itens idênticos são ignorados; conflito cancela toda a importação sem sobrescrever. Exporte/revise o JSON antes de compartilhar: contém seus valores salvos.

**Add Effect... → All effects / Saved presets** cria uma nova instância em cada layer compatível selecionada. Não substitui efeitos existentes. Preset exige consentimento para aplicação parcial. Falha depois da criação pode deixar a instância no projeto; Results informa New effect instances. Não repetir sem revisar/considerar Undo. Camera/Light e outras layers sem capacidade são recusadas; layers bloqueadas são preservadas.

## Keyframes e curvas

More → Inspect Animation... lê somente os paths escolhidos de uma ou duas ocorrências, até 16 paths e 2.000 keys/path. A tabela mostra key, tempo em segundos, valor e curva; clicar mostra eases/interpolação/tangentes suportados. É **somente leitura**.

Edit Parameters pode remover todos os keyframes de um parâmetro numérico autorizado e substituir por valor fixo. Não edita pontos individuais, tempos ou easing, não copia animação nem remove expressions. O lote usa um grupo Undo. Se a remoção falhar depois de iniciada, Results informa incerteza e possíveis alterações parciais; não há retry ou rollback automático. Inspeção e presets continuam sem escrita de animação.

## Ações, resultados e suporte

Enable/Disable muda Enabled, nunca licença. Add Effect depende da capacidade da layer. Remove apaga efeitos inteiros, inclusive animação, após confirmação. Locate seleciona uma Timeline escolhida; pode alterar seleção do projeto, somente por ação explícita.

| Resultado | Significado |
|---|---|
| Written and Verified | Setter retornou e readback corresponde exatamente |
| Written but Verification Failed | Setter retornou; readback falhou/diferiu |
| Skipped | Não houve tentativa de mutação naquele parâmetro |
| Failed Before Write | Falha antes da invocação |
| Unknown After Host Error | Invocação pode ter alterado antes do erro |

Não há rollback/retry automático de escrita incerta. Novo efeito criado pode coexistir com falha em seus parâmetros. Contagens de efeitos/propriedades/eventos têm unidades distintas.

Help fica à direita; versão em Help/Diagnostics. Dock baixo usa scrollbar vertical; árvore rola separadamente. Page Up/Down navega fora da árvore/campos. A roda depende de eventos do host e ainda precisa de teste nativo. Results, confirmação e ajuda têm rolagem própria.

Help → Diagnostics funciona sem seleção; log não é transmitido. Revise caminhos/dados antes de compartilhar. Retry display recupera apresentação sem invalidar dados válidos. Cancel remove tarefas pendentes entre chamadas; não interrompe API síncrona bloqueante.

Não há Replace genérico, sets, Preview ou operação de licença. Não alterar Manager, ativação, antivírus ou instalações de terceiros. Execute [UI_QA](docs/UI_QA.md) antes de produção.
