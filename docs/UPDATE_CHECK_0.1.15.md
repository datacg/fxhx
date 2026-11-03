# Consulta de atualizações — FX Exchanger 0.1.15

Help → Check for updates faz uma consulta explícita à última Release estável de `datacg/fxhx`. Nenhuma consulta ocorre na inicialização, abertura da ajuda ou durante edição. O resultado diferencia versão nova, versão instalada igual/mais recente, ausência de Release e falha de consulta. Open Releases abre a página oficial no navegador; o plugin não baixa nem executa código remoto e não substitui o JSX instalado.

O transporte Windows usa `system.callSystem` e PowerShell com uma URL HTTPS fixa, TLS 1.2, perfil desativado, janela oculta e timeout HTTP de 10 segundos. Resolução DNS e inicialização do processo podem ampliar o tempo da chamada síncrona. Não há bypass de ExecutionPolicy, credenciais ou dados do projeto na requisição. O JSON contém somente tag, URL e flags da Release; é validado com limite de tamanho, versão numérica e URL exata desse repositório. Conteúdo remoto nunca entra no comando do sistema. O endpoint `/releases/latest` exclui drafts e prereleases.

A versão instalada fica em `FX.Updates.installed`, conferida contra package.json por teste e usada também em Help/Diagnostics. Futuras versões devem atualizar ambos. A publicação deve criar uma Release estável com tag `vMAJOR.MINOR.PATCH` ou `MAJOR.MINOR.PATCH`, além do commit/tag Git; sem Release, a consulta informa indisponibilidade.

Validação: seis testes novos cobrem comparação numérica, payloads/URLs inválidos, transporte fixo, falhas/retry, ausência de rede ao abrir Help e reentrada. Total: 253 testes aprovados. O comando PowerShell foi executado nesta máquina e retornou corretamente ausência de Release antes da criação do repositório. UI/callSystem dentro do After Effects permanecem pendentes.

Referências: [Releases API](https://docs.github.com/en/rest/releases/releases), [System.callSystem](https://ae-scripting.docsforadobe.dev/general/system/) e [Invoke-RestMethod](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-restmethod?view=powershell-5.1).
