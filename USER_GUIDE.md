# Guia de uso — FXHX 0.1.16

O painel encontra efeitos no projeto e altera os parâmetros deles em lote, com confirmação e um único Undo. A interface segue o idioma do After Effects; os nomes entre parênteses são os rótulos em inglês.

## 1. Encontrar efeitos

O topo do painel tem três linhas:

| Linha | Controles |
|---|---|
| **Escopo (Scope)** | Composição ativa, Escolher composições ou Projeto inteiro. **Filtros...** restringe por tipo de layer, label, estado e animação. |
| **Buscar (Find)** | Digite um nome de efeito, layer ou composição e pressione **Enter**. A primeira busca lista os efeitos do escopo; as seguintes filtram na hora, sem reler o projeto. |
| **Ver (View)** | **Efeitos** (um por linha), **Grupos** (efeitos com os mesmos valores juntos) ou **Layers** (inclui layers sem efeitos). **Presets...** e **Atualizar/Listar (Refresh/Scan)** ficam aqui. Durante uma listagem, **Cancelar** ocupa o lugar de Atualizar e a barra de progresso mostra o andamento. |

Abrir o painel não lê nada. Valores de parâmetros só são lidos quando você pede (Editar parâmetros ou Mais > Ler parâmetros).

## 2. Selecionar

- **Clique** seleciona um resultado. **Ctrl-clique** adiciona ou remove. **Shift-clique** seleciona um intervalo; **Ctrl+Shift** soma o intervalo.
- `[x]` marca selecionados e `[-]` um grupo parcialmente selecionado.
- **Selecionar resultados (Select Results)** pega tudo o que a busca encontrou, inclusive em outras páginas (listas longas têm páginas de 200).
- Duplo clique (ou setas Esquerda/Direita) recolhe e expande grupos.
- As ações só usam itens selecionados que correspondem à busca e aos filtros atuais. A linha de resumo avisa quando há selecionados ocultos ou em outras páginas.

## 3. Editar parâmetros

Selecione efeitos **do mesmo tipo** e clique em **Editar parâmetros...**. Na primeira vez, o painel lê só os efeitos selecionados e então abre o editor.

**À esquerda:** a lista de parâmetros, com busca por nome ou valor e o filtro Todos / Editáveis / Com keyframes / Alterações pendentes / Indisponíveis. A coluna *Aplica-se a* mostra em quantos efeitos selecionados a alteração pode ser aplicada (ex.: `3/3`).

**À direita (Parâmetro selecionado):**

- valor atual; quando os efeitos têm valores diferentes, aparece *Mixed Values* e a lista *Previous values* com contagens, por exemplo `200 (1); 100 (1)`;
- **Novo valor**: deixe em branco para manter o valor de cada efeito. A vírgula decimal é aceita (`12,5`). Textos inválidos ficam marcados com `!` e uma mensagem;
- vetores mostram campos **X/Y/Z**; cores mostram **R/G/B/A de 0 a 1**, um campo **hex** (`#FF8000`) e **Escolher...** para o seletor de cores do sistema;
- menus mostram as opções pelo nome, com *Manter valores originais* no topo;
- parâmetros liga/desliga mostram uma **caixa de seleção** com o estado atual ("Sem alteração (agora Desligado)"). Clique para definir em todos os efeitos selecionados; **Número...** troca para o campo numérico e **Caixa de seleção** volta, caso um slider que esteja em 0 ou 1 seja confundido com caixa de seleção;
- **Ver alvos (View targets)** mostra cada composição/layer/efeito, o valor atual e por que um alvo está bloqueado.

**Embaixo:** todas as alterações pendentes, mesmo as escondidas pela busca. Clique numa para voltar a ela. `*` marca pendência e `!` um valor a corrigir. **Limpar esta alteração** e **Limpar todas** só descartam o que ainda não foi aplicado.

**Aplicar N alterações** envia tudo num só lote. A confirmação mostra uma tabela *Parâmetro / Atual (efeitos) / Novo valor* e o botão **Aplicar a N efeitos**. **Enter na confirmação cancela**: aplicar sempre exige um clique. Depois de aplicar, a lista é mantida e só os efeitos editados são lidos de novo (Remover efeitos e Adicionar efeito relistam o escopo); clique em Editar parâmetros para continuar.

Cada alteração pendente precisa valer para **todos** os efeitos selecionados. Se um alvo tiver expression, layer travada, keyframes não autorizados ou parâmetro ausente, Aplicar fica bloqueado e Ver alvos explica o motivo. Ajuste a seleção ou limpe a alteração.

**Exemplo:** buscar `lumetri`, Selecionar resultados, Editar parâmetros, escolher *Vibrance*, digitar `20`, Aplicar 1 alteração, Aplicar a N efeitos. Só Vibrance muda; exposição, saturação e os demais valores de cada efeito ficam como estavam.

## 4. Keyframes

Keyframes são preservados por padrão. Para trocar um parâmetro animado por um valor fixo, marque **Remover keyframes (todos os efeitos selecionados)** nesse parâmetro:

- com um novo valor, todos os efeitos recebem esse valor fixo;
- com o campo em branco, cada efeito mantém o seu valor atual, agora sem keys.

A confirmação pede um segundo consentimento com a contagem de keys. Os outros parâmetros mantêm a animação. **Mais > Inspecionar animação...** mostra tempos, valores e curvas, apenas para leitura.

## 5. Copiar e presets

- **Mais > Copiar parâmetros...** guarda valores estáticos escolhidos; selecione efeitos do mesmo tipo e use **Colar parâmetros...**.
- **Copiar de outro efeito...** aplica os valores de um efeito de referência.
- **Salvar preset de efeito...** guarda valores escolhidos de um efeito. Em **Presets...** você edita vários valores de uma vez (com os mesmos campos do editor), renomeia, exclui, importa e exporta. Editar um preset não altera o projeto.
- **Adicionar efeito... > Presets salvos** cria um efeito **novo** com esses valores; os existentes não são substituídos.

Presets nunca contêm keyframes, expressions nem dados internos. O arquivo é `%APPDATA%\FXExchanger\presets.json`, com backups automáticos.

## 6. Outras ações

No painel: **Ativar/Desativar** (o Enabled do efeito), **Adicionar efeito...** (selecione uma layer; use Ver > Layers para layers sem efeitos) e **Localizar** (seleciona a layer na Timeline).

Em **Mais...**: Ler parâmetros, Copiar/Colar parâmetros, Comparar..., Inspecionar animação..., Remover efeitos, Seleção..., Agrupamento..., Detalhes... e Diagnóstico....

## 7. Resultados e segurança

Cada operação é **um** passo de Undo (Ctrl+Z). Antes de escrever, todos os alvos são conferidos de novo; depois, cada valor é lido de volta. **Resultados...** mostra o que aconteceu com cada alvo:

| Resultado | Significado |
|---|---|
| Written and Verified | Gravado e conferido. Se o AE guardou o número com a própria precisão (comum em cores), isso é aceito e anotado. |
| Written but Verification Failed | Gravado, mas o valor lido é outro (arredondado ou limitado pelo efeito). |
| Skipped | Nada foi tentado nesse parâmetro (por exemplo, animado sem autorização). |
| Failed Before Write | Falhou antes de gravar; nada mudou. |
| Unknown After Host Error | O AE deu erro durante a gravação; o valor pode ter mudado. |

Escritas incertas nunca são repetidas automaticamente: confira no Effect Controls, use Ctrl+Z se precisar e clique em Atualizar antes de tentar de novo.

**Campos protegidos:** Compositing Options do AE, Effect Opacity, GPU Rendering, Connection Timestamp e outros campos internos não aparecem no editor e não são gravados. No AI Color Match, só *Intensity* é editável. Controles gráficos opacos (algumas curvas) ficam bloqueados; edite-os no próprio efeito. O ExtendScript não informa de forma universal quais campos um plugin exibe, então alguns plugins de terceiros podem precisar de regras próprias.

## 8. Problemas

- O AE pode parar de responder durante operações longas; a barra de progresso mostra até onde foi. Cancelar não interrompe uma chamada do AE já em andamento.
- **Ajuda > Verificar atualizações** precisa da preferência *Allow Scripts to Write Files and Access Network* e pode pausar o AE por alguns segundos. **Abrir Releases** sempre funciona.
- **Ajuda > Diagnóstico...** gera um log técnico para relatar problemas, sem valores do projeto nem dados de licença.

Instalação e problemas comuns: [INSTALL.md](INSTALL.md).
