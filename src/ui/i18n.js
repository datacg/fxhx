// Interface language. English strings are the keys; translations apply to
// static labels (buttons, titles, column headers, fixed hints). Messages
// built from data stay in English. Logic never compares translated text:
// controls keep their English key in `fxTitle` / `fxKey`.
//
// Language: the FXHX_LANG environment variable ("en" or "pt") wins;
// otherwise After Effects' $.locale (pt_BR, pt_PT -> pt). Default: en.
FX.I18N = (function () {
    var PT = {
        '* pending change   ! needs correction': '* alteração pendente   ! precisa de correção',
        '0 effects selected': '0 efeitos selecionados',
        'Action': 'Ação',
        'Active Composition': 'Composição ativa',
        'Add Effect...': 'Adicionar efeito...',
        'Add to Selection': 'Adicionar à seleção',
        'All effects': 'Todos os efeitos',
        'All parameters': 'Todos os parâmetros',
        'Animated': 'Animado',
        'Animation Inspection': 'Inspeção de animação',
        'Any': 'Qualquer',
        'Applies to': 'Aplica-se a',
        'Apply': 'Aplicar',
        'Apply closes the editor. To make more changes, use Edit Parameters again.':
            'Aplicar fecha o editor. Para mais alterações, use Editar parâmetros de novo.',
        'Cancel': 'Cancelar',
        'Check GitHub for a newer version. Only runs when you click Check for updates.':
            'Procura uma versão nova no GitHub. Só roda quando você clica em Verificar atualizações.',
        'Check for updates': 'Verificar atualizações',
        'Checkbox': 'Caixa de seleção',
        'Choose': 'Escolher',
        'Choose Compositions': 'Escolher composições',
        'Choose Timeline composition': 'Escolher composição da Timeline',
        'Choose a scope, then type a name and press Enter (or Search) to list effects.':
            'Escolha o escopo, digite um nome e pressione Enter (ou Buscar) para listar os efeitos.',
        'Choose compositions': 'Escolher composições',
        'Choose copy reference': 'Escolher referência para copiar',
        'Choose effect to apply': 'Escolher efeito',
        'Choose source': 'Escolher origem',
        'Choose...': 'Escolher...',
        'Clear': 'Limpar',
        'Clear Selection': 'Limpar seleção',
        'Clear all changes': 'Limpar todas',
        'Clear search': 'Limpar busca',
        'Clear this change': 'Limpar esta alteração',
        'Close': 'Fechar',
        'Compare configurations': 'Comparar configurações',
        'Compare...': 'Comparar...',
        'Composition': 'Composição',
        'Confirm changes': 'Confirmar alterações',
        'Copy From Another Effect...': 'Copiar de outro efeito...',
        'Copy Parameters': 'Copiar parâmetros',
        'Copy Parameters...': 'Copiar parâmetros...',
        'Current': 'Atual',
        'Current (effects)': 'Atual (efeitos)',
        'Curve': 'Curva',
        'Details...': 'Detalhes...',
        'Diagnostics...': 'Diagnóstico...',
        'Disable': 'Desativar',
        'Edit Parameters': 'Editar parâmetros',
        'Edit Parameters...': 'Editar parâmetros...',
        'Edit any number of parameters, then Save preset. Only the saved preset changes, not the project.':
            'Edite quantos parâmetros quiser e clique em Salvar preset. Só o preset muda, não o projeto.',
        'Edit preset': 'Editar preset',
        'Edit values...': 'Editar valores...',
        'Editable': 'Editáveis',
        'Effect': 'Efeito',
        'Effect details': 'Detalhes do efeito',
        'Effect presets': 'Presets de efeito',
        'Effects': 'Efeitos',
        'Enable': 'Ativar',
        'Entire Project': 'Projeto inteiro',
        'FXHX Help': 'Ajuda do FXHX',
        'FXHX diagnostics': 'Diagnóstico do FXHX',
        'Filters...': 'Filtros...',
        'Find': 'Buscar',
        'Grouping': 'Agrupamento',
        'Grouping...': 'Agrupamento...',
        'Groups': 'Grupos',
        'Has keyframes': 'Com keyframes',
        'Keep original values': 'Manter valores originais',
        'Keep saved value': 'Manter valor salvo',
        'Help': 'Ajuda',
        'I understand: only compatible effects will change.': 'Entendo: só efeitos compatíveis serão alterados.',
        'Inspect Animation...': 'Inspecionar animação...',
        'Inspect Selected': 'Inspecionar selecionados',
        'Invert Selection': 'Inverter seleção',
        'Layer': 'Layer',
        'Layer and effect filters': 'Filtros de layer e efeito',
        'Layers': 'Layers',
        'Locate': 'Localizar',
        'Locate selected': 'Localizar selecionado',
        'More Actions': 'Mais ações',
        'More...': 'Mais...',
        'New value': 'Novo valor',
        'Next': 'Próxima',
        'Number...': 'Número...',
        'Off': 'Desligado',
        'On': 'Ligado',
        'Unchanged (mixed)': 'Sem alteração (valores diferentes)',
        'Unchanged (now Off)': 'Sem alteração (agora Desligado)',
        'Unchanged (now On)': 'Sem alteração (agora Ligado)',
        'Will set: Off': 'Vai definir: Desligado',
        'Will set: On': 'Vai definir: Ligado',
        'No': 'Não',
        'Open Releases': 'Abrir Releases',
        'Operation results': 'Resultados da operação',
        'Operation selection': 'Seleção da operação',
        'Parameter': 'Parâmetro',
        'Parameter occurrences': 'Ocorrências do parâmetro',
        'Paste Parameters...': 'Colar parâmetros...',
        'Pending changes': 'Alterações pendentes',
        'Pending parameter': 'Parâmetro pendente',
        'Pick...': 'Escolher...',
        'Presets...': 'Presets...',
        'Previous': 'Anterior',
        'Previous -> New value': 'Anterior -> Novo valor',
        'Previous value': 'Valor anterior',
        'Property': 'Propriedade',
        'Property value...': 'Valor de propriedade...',
        'Read Parameters': 'Ler parâmetros',
        'Refresh': 'Atualizar',
        'Remove Effects': 'Remover efeitos',
        'Remove highlighted': 'Remover destacados',
        'Remove keyframes (all selected effects)': 'Remover keyframes (todos os efeitos selecionados)',
        'Rename...': 'Renomear...',
        'Results...': 'Resultados...',
        'Save': 'Salvar',
        'Save Effect Preset...': 'Salvar preset de efeito...',
        'Save log...': 'Salvar log...',
        'Save preset': 'Salvar preset',
        'Save report...': 'Salvar relatório...',
        'Saved presets': 'Presets salvos',
        'Scan': 'Listar',
        'Scope': 'Escopo',
        'Search': 'Buscar',
        'Select All': 'Selecionar tudo',
        'Select Results': 'Selecionar resultados',
        'Selected parameter': 'Parâmetro selecionado',
        'Selection...': 'Seleção...',
        'Show all properties': 'Mostrar todas as propriedades',
        'Static': 'Estático',
        'Status': 'Status',
        'Technical details': 'Detalhes técnicos',
        'These actions affect visible results only.': 'Estas ações afetam só os resultados visíveis.',
        'Time (s)': 'Tempo (s)',
        'Unavailable': 'Indisponíveis',
        'Use filters': 'Usar filtros',
        'Use selected': 'Usar selecionados',
        'Use selection': 'Usar seleção',
        'Use view': 'Usar visualização',
        'Value': 'Valor',
        'View': 'Ver',
        'View targets': 'Ver alvos',
        'Yes': 'Sim'
    };
    var language = null;
    function detect() {
        var forced = '', locale = '';
        try {
            if (typeof $ !== 'undefined' && typeof $.getenv === 'function') {
                forced = String($.getenv('FXHX_LANG') || '').toLowerCase();
            }
        } catch (ignoredEnv) {}
        if (forced === 'en' || forced === 'pt') {
            return forced;
        }
        try {
            if (typeof $ !== 'undefined' && $.locale) {
                locale = String($.locale).toLowerCase();
            }
        } catch (ignoredLocale) {}
        return /^pt/.test(locale) ? 'pt' : 'en';
    }
    function current() {
        if (language === null) {
            language = detect();
        }
        return language;
    }
    function t(text) {
        if (current() === 'pt' && FX.U.own(PT, text)) {
            return PT[text];
        }
        return text;
    }
    function list(items) {
        var out = [], i;
        for (i = 0; i < items.length; i++) { out.push(t(items[i])); }
        return out;
    }
    // Button labels with counts.
    function applyChanges(total) {
        if (current() === 'pt') {
            if (!total) { return 'Aplicar'; }
            return 'Aplicar ' + total + (total === 1 ? ' alteração' : ' alterações');
        }
        if (!total) { return 'Apply'; }
        return 'Apply ' + total + (total === 1 ? ' change' : ' changes');
    }
    function applyTo(layers, count) {
        if (current() === 'pt') {
            if (layers) { return 'Adicionar a ' + count + ' layers'; }
            return 'Aplicar a ' + count + (count === 1 ? ' efeito' : ' efeitos');
        }
        if (layers) { return 'Add to ' + count + ' layers'; }
        return 'Apply to ' + count + (count === 1 ? ' effect' : ' effects');
    }
    return {
        t: t,
        applyChanges: applyChanges,
        applyTo: applyTo,
        list: list,
        language: current,
        // For tests and tooling; null re-detects.
        use: function (code) { language = code; },
        dictionary: function () { return PT; }
    };
})();
