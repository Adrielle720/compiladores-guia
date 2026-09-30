# Acréscimos da Adrielle

Tudo que não é do site original do Oscar fica nesta pasta. O `montar.js` injeta essas peças no `index.html`, entre marcadores `<!-- ADR:... -->`.

| arquivo | o que é |
|---|---|
| `secao-r5.html`, `secao-r6.html` | as seções **R5 · v2.0** e **R6 · v2.1** em "Os roteiros", logo depois do R4 |
| `depurador.js` | depurador animado (`<div data-java-dep="v2.0">`): fita de tokens, pilha de chamadas, AST, código Java ativo, SymbolTable, stdin e saída |
| `perguntas.js` | **as perguntas de cada roteiro**: sobre o roteiro, sobre as funções e "implemente você" (extra credit) |
| `perguntas-ui.js` | os cartões de pergunta (`<div data-perguntas="r5">`), com dica, resposta e marcação sei/revisar |
| `estilo.css` | estilo, que reaproveita as classes `an-*`, `.btn` e `.preset` do site |
| `motor.js` | reimplementação em JS de cada versão do compilador Java, validada contra o `javac` (130 casos idênticos) |
| `Roteiro5.java` + `marcas-r5.json` | o `main.java` original (tag v2.0.2) e o mapa chave → linha que o depurador acende |
| `Roteiro6.java` | a referência do Roteiro 6; os comentários `//#chave` marcam as linhas |

Depois de editar qualquer arquivo daqui:

```sh
node adrielle/montar.js
```

O script pode rodar quantas vezes você quiser.

## A cada roteiro novo

1. **Perguntas**: em `perguntas.js`, acrescente `PERGUNTAS.r7 = { titulo, grupos: [...] }`, no mesmo formato dos outros, com os três grupos (*Sobre o roteiro*, *Sobre as funções* e *Implemente você*, este com `extra: true`). O formato do texto está descrito no começo do arquivo.
2. **Seção**: crie `secao-r7.html` com `<section id="r7" class="painel">` e, dentro dela, `<div data-perguntas="r7"></div>`.
3. **Depurador** (opcional): o `motor.js` precisa ganhar a nova versão; depois acrescente o fonte Java em `JAVA_FONTES` (no `montar.js`) e os exemplos em `EXEMPLOS` (no `depurador.js`).
4. Em `montar.js`, acrescente o roteiro na lista `ROTEIROS`. O link na barra lateral sai sozinho.
