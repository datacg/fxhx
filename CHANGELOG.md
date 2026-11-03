# Changelog

## 0.1.15 — primeira versão pública

- Busca de efeitos por escopo, seleção por ocorrência/layer/grupo e comparação de configurações legíveis.
- Edição de vários parâmetros em um único lote, com busca, filtros, pendências e revisão antes de aplicar.
- Mixed Values inclui valores atuais de propriedades com keyframes. Valores anteriores agrupados por contagem e detalhados por alvo.
- Cada pendência deve atender todos os efeitos selecionados. Proteções, tipos, menus, limites e autorização de keys são conferidos antes da primeira escrita.
- Remoção explícita de keyframes por parâmetro, incluindo uma única key. Campo vazio preserva o valor atual de cada alvo.
- Cópia de parâmetros estáticos escolhidos e presets de um efeito. Expressions, dados opacos e campos internos conhecidos ficam protegidos.
- Help → Check for updates consulta a última Release estável de datacg/fxhx. Open Releases abre o download para instalação manual.
- 253 testes automatizados aprovados, build ES3 e pacote verificado. Validação nativa pendente.
