# Validação — FX Exchanger 0.1.15

**253 testes automatizados aprovados**, com fixtures em memória, build ES3 e verificação de identidade entre fontes e JSX. O ZIP é extraído com Windows tar e conferido por whitelist, SHA-256 e identidade do JSX.

Os testes cobrem seleção, escopos, valores mistos, revisão por alvo, edição de toda a seleção, remoção de keys, limites, menus, presets, proteção de expressions/dados opacos, falhas do host, readback, recuperação e ausência de consultas de rede na inicialização.

A consulta de atualizações tem testes de comparação numérica, validação de respostas/URLs, falhas de conexão, retry e reentrada. Seu comando PowerShell também foi executado no Windows. Esses testes não substituem a execução de `system.callSystem` dentro do After Effects.

## Pendente no host

- Layout, foco, teclado, DPI, docking e scroll.
- Escrita, readback, atualização da seleção e Undo em efeitos reais.
- Menus e controles de plugins de terceiros.
- Remoção de uma ou várias keys e consulta de atualizações pela interface do AE.

Use o [roteiro manual](docs/UI_QA.md). Os testes automatizados não iniciam o After Effects, não criam projetos reais e não consultam licenças de terceiros.

O painel faz pré-validação antes de escrever e usa um grupo Undo por operação. APIs síncronas podem falhar depois dessa validação e deixar mudanças parciais. Results diferencia falhas anteriores à escrita, escritas confirmadas e resultados incertos; não há retry nem rollback automático.
