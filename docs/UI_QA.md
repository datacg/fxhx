# Validação manual — FX Exchanger 0.1.15

Execute em um projeto temporário, preservando seus arquivos de trabalho. Os itens abaixo ainda precisam de validação dentro do After Effects.

- [ ] Abrir o painel dockável e conferir Help/versão. Abrir não deve iniciar scan, modal nem consulta de rede.
- [ ] Search/Scan por escopo, filtros e Effects/Groups/Layer; conferir Ctrl/Shift, seleção por grupo e alvos fora da página.
- [ ] Radius 200 estático e 100 com keys em efeitos selecionados: Mixed Values, valores anteriores com contagens e valores por alvo. Preparar 150 sem autorizar remoção deve bloquear Apply; autorizar deve permitir 2/2.
- [ ] Preparar Radius 150, Threshold Mode Luminance e Threshold 65; conferir três pendências, anteriores/destinos e aplicação em todos os alvos num único Undo.
- [ ] Limpar uma única key de Threshold Mode sem novo valor; preservar o modo atual. Repetir com novo valor e com várias keys.
- [ ] Limpar keys com valores diferentes e campo vazio; manter cada valor por alvo. Cancelar confirmação não escreve; reabrir conserva a proposta. Após sucesso, reabrir com valores atuais e sem autorização herdada.
- [ ] Expressions, locks, menus incompatíveis e parâmetros ausentes devem bloquear o lote do editor. Conferir que keys de outros parâmetros não são removidas.
- [ ] Comparar configurações, copiar parâmetros escolhidos e salvar/editar/importar presets sem incluir animation/expressions.
- [ ] Conferir Results, readback, falhas e Undo; não repetir escritas incertas automaticamente.
- [ ] Help → Check for updates: versão atual, versão nova quando publicada e falha de conexão. Open Releases deve abrir somente a página oficial. A consulta não deve ocorrer ao abrir Help.
- [ ] Alternar menus, números e vetores; buscar sem resultados e voltar. Conferir campos, valores anteriores e pendências em 100/150/200% DPI e docks pequenos.
