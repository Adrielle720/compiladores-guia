# compiladores-guia

> **Esta é uma cópia do guia de [Oscar Rodrigues Filho](https://github.com/OscarRodriguesFilho/compiladores-guia)**, mantida por Adrielle para estudo.
> Os acréscimos são as seções **R5 · v2.0** e **R6 · v2.1**, com depurador animado em Java e perguntas de treino e extra credit de cada roteiro (arquivos em [`adrielle/`](adrielle/)). Todo o resto é trabalho do Oscar.
>
> 🔗 Esta versão: https://adrielle720.github.io/compiladores-guia/

**Sete Classes, Quatro Roteiros** — guia interativo da disciplina de Compiladores (Linguagens & Paradigmas, Insper).

🔗 **[Abrir o site](https://oscarrodriguesfilho.github.io/compiladores-guia/)**

## O que tem aqui

**Parte I · As aulas** — seis aulas, cada uma numa aba:

| aula | assunto | interativo |
|---|---|---|
| 4 | Diagrama sintático, tokenização, o embrião do Parser | percorredor do diagrama passo a passo |
| 5 | Expressões regulares, AFD/AFN, pumping, fechamento | bombeamento de `aⁿbⁿ` com controles |
| 6 | Precedência: EXPRESSION, TERM, FACTOR | o vaivém E→T→F traçado |
| 7 | Gramáticas livres de contexto e autômatos de pilha | **simulador de PDA** para parênteses |
| 8 | Árvores de derivação, ambiguidade e AST | derivação animada + as duas árvores de `3+4*2` |
| 9 | LL(k), LR(k), pumping para CFL, Chomsky | tabela shift/reduce passo a passo |

**Parte II · A teoria** — gramática (com derivação animada), autômatos (com simulador),
pumping lemma (regulares e livres de contexto), propriedades de fechamento,
hierarquia de Chomsky, e árvore de derivação vs. AST geradas ao vivo.

**Parte III · Os roteiros** — v0.0 a v1.2, cada um com o código-fonte da tag
correspondente e um **depurador** que executa aquela versão específica do compilador:
escreva uma expressão e percorra token a token, vendo o cursor do Lexer, a pilha de
chamadas e a árvore sendo construída. No fim de cada aba, o extra credit do roteiro
(`^`, `**`, `!`) com a análise de precedência.

**Parte IV · Referência** — todas as classes, todos os métodos, e o mapa de relações.

## Sobre o código

O site é um único `index.html` sem dependências externas — sem frameworks, sem CDN,
sem fontes remotas. Os depuradores reimplementam em JavaScript a gramática exata de
cada versão do compilador, e os diagramas são SVG escritos à mão.

## Estilo

O sistema visual é o mesmo do [raiz-lab](https://github.com/OscarRodriguesFilho/raiz-lab).
