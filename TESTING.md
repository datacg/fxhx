# Testes

No Windows, com Node.js 18 ou superior:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run release:candidate   # pacote de teste, marcado como não validado no AE
npm.cmd run release             # exige docs/validation/ae-host-<versão>.json
```

`check` gera `dist/FXHX.jsx` e executa 282 testes Node/mocks. `release` também gera e verifica o ZIP com Windows tar, whitelist, SHA-256 e comparação do JSX, e só roda quando existe o registro do [checklist no host](docs/HOST_SMOKE_CHECKLIST.md). Os testes não iniciam o After Effects.

As fixtures usam objetos em memória para representar composições, layers, efeitos e controles ScriptUI. A cobertura inclui seleção nativa simulada, escopos, agrupamento, valores mistos, edição de toda a seleção, menus, keyframes, presets, falhas de escrita/readback, recuperação, cache, persistência e consulta de atualizações.

`tests/updates.test.cjs` simula o transporte de rede, valida versões e URLs e verifica que a consulta só ocorre ao clicar. Não faz chamadas reais ao GitHub na suíte.

`npm.cmd run host:prepare` apenas prepara uma fixture bloqueada por padrão em `artifacts/`. Não inicia o host e não autoriza testes sobre projetos reais.

O [checklist no host](docs/HOST_SMOKE_CHECKLIST.md) é obrigatório para cada release; [docs/UI_QA.md](docs/UI_QA.md) traz verificações detalhadas por versão. Mocks não certificam comportamento visual, cliques, docking ou desempenho dentro do host.
