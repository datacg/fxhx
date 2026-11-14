# Smoke test no After Effects — obrigatório antes de cada release

Os testes em Node usam mocks. Eles não comprovam layout do ScriptUI, docking, teclado, DPI nem escrita real no projeto. `npm run release` só gera o pacote quando existe um registro aprovado deste checklist para a versão exata. Para um build de teste sem validação, use `npm run release:candidate` (o MANIFEST sai com `hostValidated: false`).

Tempo estimado: 30 a 40 minutos. Use **uma cópia** de um projeto de teste com:

- 3 layers com **Glow** (dois com Radius 100 estático, um com Radius animado em 2 keys);
- 2 layers com um efeito que tenha um parâmetro de **cor** (ex.: Fill ou Tint);
- 1 layer de texto sem efeitos.

## Checklist

Marque cada item como `pass` ou `fail` no registro JSON (modelo no fim).

| ID | Verificação |
|---|---|
| `install-and-open` | Apagar o `FX Exchanger.jsx` antigo, copiar `FXHX.jsx` para `ScriptUI Panels`, reiniciar o AE e abrir em **Window > FXHX.jsx**. O painel abre sem diálogos, sem listar efeitos, mostra FXHX 0.1.16 em Help e os presets salvos antes continuam em Presets.... |
| `search-and-select` | Digitar `glow` e Enter: 3 efeitos listados. Clique, Ctrl-clique e Shift-clique selecionam como esperado, com destaque e `[x]`. |
| `editor-two-pane-layout` | Edit Parameters abre com lista à esquerda e "Selected parameter" à direita. Redimensionar a janela: nada é cortado e a lista cresce. Trocar entre parâmetro numérico, menu e cor: o campo de entrada continua visível. |
| `decimal-comma` | Em Radius, digitar `12,5`: pendência mostra `12.5` e Apply aplica 12.5. Digitar `abc`: aparece `!` e a mensagem "enter a number". |
| `checkbox-parameter` | Em efeitos com um parâmetro liga/desliga (ex.: *Repeat Edge Pixels* do Gaussian Blur, ou o Checkbox Control), o editor mostra uma caixa de seleção com "Unchanged (now Off)". Marcar mostra "Will set: On", a confirmação mostra Off → On e o Effect Controls fica marcado. **Number...** troca para campo numérico e **Checkbox** volta para a caixa de seleção. Um slider em 0 com faixa 0–100 **não** deve virar checkbox. |
| `apply-speed` | Em escopo Entire Project (projeto com centenas de layers), editar um parâmetro de 2–3 efeitos: o painel termina em poucos segundos, sem relistar o projeto (a barra mostra "Reading parameters", não "Listing effects"). Disable em um efeito também termina sem relistar. Remove Effects ainda relista. |
| `color-hex-and-picker` | Em um parâmetro de cor, os campos mostram R/G/B/A. Digitar `#FF8000` no campo hex preenche R=1, G=0.502, B=0. **Pick...** abre o seletor do sistema e preenche os campos. O valor aplicado bate com o Effect Controls (e o resultado é "Written and Verified", não "Verification Failed"). |
| `apply-and-undo` | Duas alterações pendentes: o botão mostra "Apply 2 changes"; a confirmação tem tabela Parâmetro / Atual / Novo e o botão "Apply to N effects". Depois de aplicar, **um** Ctrl+Z desfaz tudo. |
| `enter-cancels-confirmation` | Com o cursor num campo do editor, Enter **não** aplica. Na confirmação, Enter fecha **sem** aplicar (nada muda no projeto). |
| `keyframe-removal` | No Glow animado, marcar "Remove keyframes" sem valor: confirmação pede o consentimento com a contagem de keys; após aplicar, Radius fica estático com o valor atual. Os outros parâmetros mantêm suas keys. |
| `progress-and-cancel` | Em escopo Entire Project com um projeto maior, a barra de progresso aparece durante a listagem e o botão Refresh vira Cancel. Cancel interrompe; a barra some e Refresh volta. |
| `presets-multi-edit` | Salvar preset de um Glow, abrir Presets > Edit values..., alterar dois parâmetros (um com vírgula decimal) e salvar: ambos ficam no preset; o projeto não muda. |
| `dpi-100-150-200` | Repetir a abertura do painel e do editor com a escala do Windows em 100%, 150% e 200%: textos dos botões não são cortados e as linhas do topo não se sobrepõem. |
| `docked-resize-and-scroll` | Painel encaixado em dock estreito e baixo: barra de rolagem aparece, Page Up/Down funcionam fora da lista, a lista rola sozinha. |
| `portuguese-locale` | Com AE em português (ou variável `FXHX_LANG=pt`), botões e títulos aparecem em português e os filtros (Animated/Static) continuam funcionando. Com `FXHX_LANG=en`, tudo volta para inglês. |
| `update-check` | Help > Check for updates com a opção de rede do AE desligada: mensagem explica a preferência, sem travar. Com a opção ligada: resultado em até ~10 s. Open Releases abre o navegador. |

## Registro

Salve como `docs/validation/ae-host-<versão>.json` e faça commit junto com o release:

```json
{
  "product": "FXHX",
  "version": "0.1.16",
  "aeVersion": "26.5",
  "tester": "Nome",
  "date": "2026-11-20",
  "checks": {
    "install-and-open": "pass",
    "search-and-select": "pass",
    "editor-two-pane-layout": "pass",
    "decimal-comma": "pass",
    "checkbox-parameter": "pass",
    "apply-speed": "pass",
    "color-hex-and-picker": "pass",
    "apply-and-undo": "pass",
    "enter-cancels-confirmation": "pass",
    "keyframe-removal": "pass",
    "progress-and-cancel": "pass",
    "presets-multi-edit": "pass",
    "dpi-100-150-200": "pass",
    "docked-resize-and-scroll": "pass",
    "portuguese-locale": "pass",
    "update-check": "pass"
  },
  "notes": ""
}
```

Qualquer `fail` bloqueia o release. Registre o problema em `notes`, corrija e repita o checklist.
