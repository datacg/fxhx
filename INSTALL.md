# Instalação — FX Exchanger 0.1.15

Baixe o ZIP ou `FX Exchanger.jsx` em [Releases](https://github.com/datacg/fxhx/releases/latest).

## Painel dockável no Windows

1. Feche o painel e preserve uma cópia do JSX anterior, se houver.
2. Extraia o ZIP e copie somente `FX Exchanger.jsx` para `Scripts\ScriptUI Panels` dentro da pasta de instalação do After Effects.
3. Uma instalação padrão usa `%ProgramFiles%\Adobe\Adobe After Effects 2026\Support Files\Scripts\ScriptUI Panels`. Ajuste o ano e a pasta conforme sua instalação. Copiar para Program Files pode exigir permissão de administrador.
4. Abra o After Effects e escolha **Window → FX Exchanger.jsx**.
5. Confira **0.1.15 em Help**. Se o painel conservar código antigo, salve o trabalho e reinicie o After Effects manualmente.

Também é possível executar o JSX por **File → Scripts → Run Script File...** para abrir uma palette. Esse modo não verifica o comportamento dockável.

O painel funciona sem Node.js ou npm. A consulta opcional de atualizações usa Windows PowerShell e acesso à internet. Se a consulta falhar, a edição continua disponível e a página de Releases pode ser aberta no navegador.

## Atualizar

Em **Help → Check for updates**, consulte a última Release estável. **Open Releases** abre o download. Feche o painel, substitua o JSX instalado e reabra. A atualização não substitui o arquivo automaticamente.

Esta versão tem testes automatizados em mocks. A validação dentro do After Effects permanece pendente; consulte [VALIDATION.md](VALIDATION.md) e [docs/UI_QA.md](docs/UI_QA.md).
