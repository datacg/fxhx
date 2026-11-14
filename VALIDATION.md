# Validação — FXHX 0.1.16

**282 testes automatizados aprovados**, com fixtures em memória, build ES3 e verificação de identidade entre fontes e JSX. O ZIP é extraído com Windows tar e conferido por whitelist, SHA-256 e identidade do JSX.

Os testes cobrem seleção, escopos, valores mistos, edição de toda a seleção, remoção de keys, limites, menus, presets, proteção de expressions e dados opacos, falhas do host, readback, recuperação e ausência de consultas de rede na inicialização. Na 0.1.16 entram também: vírgula decimal, tolerância de precisão no readback, entrada de cores e caixas de seleção, refresh sem relistar o projeto, interface em português e o gate de release.

## Validação no After Effects

O release definitivo exige o registro `docs/validation/ae-host-<versão>.json` com todos os itens do [checklist no host](docs/HOST_SMOKE_CHECKLIST.md) aprovados. Os pontos mais sensíveis são layout em 100/150/200% de DPI, seletor de cor, detecção de caixas de seleção em plugins de terceiros, tempo de Apply em projetos grandes e a interface em português.

Os testes automatizados não iniciam o After Effects, não criam projetos reais e não consultam licenças de terceiros.

O painel faz pré-validação antes de escrever e usa um grupo Undo por operação. APIs síncronas podem falhar depois dessa validação e deixar mudanças parciais. Results diferencia falhas anteriores à escrita, escritas confirmadas e resultados incertos; não há retry nem rollback automático.
