# Roteiro 6 — depurador animado (Java)

Acréscimo ao site do Oscar: a seção **R6 · v2.1**, que fica em "Os roteiros", logo depois do R4.

| arquivo | o que é |
|---|---|
| `secao.html` | o conteúdo da seção (gramática, antes/depois, testes, pegadinhas) |
| `r6.css` | estilo do depurador, que reaproveita as classes `an-*` da animação da Colinha |
| `depurador-r6.js` | o depurador animado: fita de tokens, pilha de chamadas, AST, código Java ativo, SymbolTable, stdin e saída |
| `motor.js` | reimplementação em JS do compilador Java, validada contra o `javac` (130 casos idênticos, projeto `lingpar-guia`) |
| `Roteiro6.java` | a referência Java do Roteiro 6; os comentários `//#chave` marcam as linhas que o depurador acende |
| `montar.js` | injeta tudo no `index.html` entre marcadores `<!-- R6:... -->` |

Depois de editar qualquer arquivo daqui:

```sh
node r6/montar.js
```

O script pode rodar quantas vezes você quiser: ele remove a injeção anterior antes de inserir de novo, e o `index.html` continua sendo um arquivo único, sem dependências.
