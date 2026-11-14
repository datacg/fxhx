# Instalação — FXHX 0.1.16

## Painel encaixável (recomendado)

1. Feche o painel se ele estiver aberto e guarde uma cópia do JSX anterior, se houver.
2. Copie `FXHX.jsx` (do ZIP da release ou de `dist/`) para:
   `C:\Program Files\Adobe\Adobe After Effects <versão>\Support Files\Scripts\ScriptUI Panels\`
   A pasta Program Files pode pedir permissão de administrador.
3. Reinicie o After Effects. Se o AE já estava aberto, salve o trabalho antes: o engine de scripts pode manter a versão antiga na memória até reiniciar.
4. Abra **Window > FXHX.jsx** e encaixe o painel onde preferir.
5. Confira a versão em **Help**: deve mostrar 0.1.16.

## Atualizando de uma versão chamada "FX Exchanger" (até 0.1.15)

O arquivo passou a se chamar `FXHX.jsx`. **Apague o `FX Exchanger.jsx` antigo** de `ScriptUI Panels`; senão o menu Window mostra os dois painéis. Preferências e presets continuam em `%APPDATA%\FXExchanger\` e são reaproveitados automaticamente.

## Executar uma vez, sem instalar

**File > Scripts > Run Script File...** e escolha o JSX. Ele abre como janela flutuante. Para usar encaixado, instale como acima.

## Preferências do After Effects

- **Check for updates** precisa de *Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network*. Sem essa opção, o painel avisa e **Open Releases** continua funcionando. A verificação pode pausar o AE por alguns segundos.
- Presets e preferências também precisam de permissão de escrita. Eles ficam em `%APPDATA%\FXExchanger\` (`state.json` e `presets.json`, com backups automáticos).

## Idioma

A interface segue o idioma do After Effects. Para forçar: defina a variável de ambiente `FXHX_LANG=pt` ou `FXHX_LANG=en` e reinicie o AE.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| O painel não aparece em Window | Confira se o arquivo está em `ScriptUI Panels` (não em `Scripts`) e reinicie o AE. |
| A versão em Help continua antiga | Reinicie o After Effects; o engine guarda o script anterior. |
| "Network access is off" | Ative a preferência de scripts acima ou use Open Releases. |
| Uma operação mostra "Unknown" ou "Verification Failed" | Abra **Results...**, confira no Effect Controls, use Ctrl+Z se necessário e clique em **Refresh** antes de repetir. O painel nunca repete escritas incertas sozinho. |
| Precisa reportar um problema | **Help > Diagnostics...** salva um log técnico, sem valores do projeto nem dados de licença. Revise os caminhos antes de compartilhar. |

## Desinstalar

Apague `FXHX.jsx` de `ScriptUI Panels` e, se quiser, a pasta `%APPDATA%\FXExchanger\`.
