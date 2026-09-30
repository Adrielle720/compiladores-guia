/* =========================================================================
   PERGUNTAS DE CADA ROTEIRO
   Para um roteiro novo, acrescente PERGUNTAS.r7 = { ... } no mesmo formato
   e ponha <div data-perguntas="r7"></div> na seção dele.

   Formato do texto (dentro de String.raw`...`):
     «código»                  código na linha
     ~~~ ... ~~~               bloco de código (em linhas próprias)
     **negrito**               destaque
     - item                    lista
     linha em branco           novo parágrafo
     @@v2.0|programa@@         botão que abre o programa no depurador
     @@v2.1|programa##stdin@@  idem, com entrada do terminal
   (use \n dentro de @@...@@ para quebrar linha no programa)
   ========================================================================= */
var PERGUNTAS = window.PERGUNTAS = window.PERGUNTAS || {};

/* ============================================================ ROTEIRO 5 */
PERGUNTAS.r5 = {
  titulo: "Roteiro 5 · v2.0",
  grupos: [
    { id: "rot", nome: "Sobre o roteiro", itens: [
      { p: String.raw`O que mudou na forma de o compilador receber o código-fonte, e por quê?`,
        r: String.raw`Até o Roteiro 4, «args[0]» ERA o programa («java Main "1+2"»). Agora «args[0]» é o **nome de um arquivo**, e a main() lê o conteúdo com «Files.readAllBytes(Paths.get(args[0]))».

O motivo: a linguagem passou a ter várias linhas (um statement por linha). Um programa com quebras de linha não cabe direito num argumento de terminal.` },
      { p: String.raw`Por que a main() faz «conteudo = conteudo + "\n"» logo depois de ler o arquivo?`,
        d: "Pense no que o parseStatement() exige no fim de cada linha.",
        r: String.raw`Todo statement precisa terminar em END (o token do «\n»). Se o arquivo não terminar com quebra de linha, o último statement veria **EOF** no lugar de END e daria «[Parser] Expected end of line».

Com o «\n» extra, a última linha sempre fecha certinho. Se o arquivo já terminava com «\n», sobra uma linha vazia no fim, que vira um NoOp inofensivo.

@@v2.0|x = 2\nPrintln(x * x)@@` },
      { p: String.raw`Em que etapa os comentários desaparecem? Por que não é o Lexer que cuida deles?`,
        r: String.raw`No **pré-processamento**: «PrePro.filter()» roda na main(), antes de o Lexer ser criado. O Lexer nunca vê um comentário, e por isso a EBNF nem precisa falar deles.

As perguntas do slide:
- «// //» é um comentário só: tudo a partir do primeiro «//» some.
- O comentário fecha no fim da linha, e o «\n» fica.
- Não entra na EBNF, porque não existe mais quando a análise começa.

@@v2.0|a = 7 // fim de linha\n// linha inteira\nPrintln(a) // // dois de uma vez@@` },
      { p: String.raw`Por que a SymbolTable é criada na main(), DEPOIS do «Parser.run()», e não dentro do Parser?`,
        r: String.raw`Porque o Parser só **monta** a árvore, sem executar nada. Os valores das variáveis só existem na **execução** (no «evaluate()»). O slide diz: "a SymbolTable NÃO existe durante a ação do Parser".

Consequência prática: «Println(y)» com y inexistente passa pelo Parser sem problema e só estoura depois, como «[Semantic] Variable y not declared». No depurador, o painel da SymbolTable diz "ainda não existe" durante toda a fase 1.

@@v2.0|x = 1\nPrintln(x + y)@@` },
      { p: String.raw`Classifique cada erro como [Lexer], [Parser] ou [Semantic]: «_x = 3» · «1x = 3» · «x = 3 +» · «println(3)» · «Println(y)» · «x = 1 / 0»`,
        d: "Lexer: caractere que não começa token. Parser: tokens válidos em ordem errada. Semantic: só dá para saber executando.",
        r: String.raw`- «_x = 3» → «[Lexer] Invalid Symbol _». Nenhum token começa com '_'.
- «1x = 3» → «[Parser] Unexpected token in statement: NUMERO». O Lexer gera NUMERO(1) e IDEN(x), os dois válidos, mas nenhuma linha começa com número.
- «x = 3 +» → «[Parser] Unexpected token in factor: END». Faltou o operando da direita.
- «println(3)» → «[Parser] Expected =». Com p minúsculo, "println" é um IDEN, e IDEN no começo da linha só pode ser atribuição.
- «Println(y)» → «[Semantic] Variable y not declared».
- «x = 1 / 0» → «[Semantic] Division by zero».

@@v2.0|1x = 3@@ @@v2.0|println(3)@@` },
      { p: String.raw`Por que «Print.evaluate()» e «Assignment.evaluate()» devolvem 0?`,
        r: String.raw`Porque são **statements**, não expressões: eles fazem algo (imprimir, guardar), mas não produzem valor. O 0 é só um "dummy" para cumprir a assinatura «abstract int evaluate(SymbolTable st)», que é a mesma para todo nó (polimorfismo). Ninguém usa esse 0.

Compare com o funcional (Aula 10): lá não existe statement, e até o «let» é uma expressão.` },
      { p: String.raw`Para que existe a classe «Variable», se ela só guarda um «int»?`,
        r: String.raw`Ela é um **envelope**. Hoje guarda só «value», mas no futuro pode ganhar tipo, "somente leitura" (const) etc. sem mudar a SymbolTable, que continua sendo «HashMap<String, Variable>». O extra credit do roteiro (variáveis imutáveis) usa exatamente isso: veja "Implemente você".` }
    ]},
    { id: "fun", nome: "Sobre as funções", itens: [
      { p: String.raw`«Lexer.selectNext()»: o laço que pula brancos tem a condição extra «source.charAt(position) != '\n'». O que aconteceria sem ela?`,
        r: String.raw`«Character.isWhitespace('\n')» é true, então a quebra de linha seria pulada como se fosse espaço e **nunca viraria o token END**. Em «x = 1» seguido de «Println(x)», o parseStatement leria «x = 1» e esperaria END, mas encontraria PRINT: «[Parser] Expected end of line».

~~~
while (position < source.length()
        && Character.isWhitespace(source.charAt(position))
        && source.charAt(position) != '\n') {   // <- o '\n' vira token
    position++;
}
~~~` },
      { p: String.raw`Como o Lexer decide se uma palavra é «PRINT» ou «IDEN»?`,
        r: String.raw`Ele acumula letras, dígitos e «_» como se fosse um identificador qualquer e só **depois** compara com a palavra reservada: «if (acumulado.equals("Println"))». A comparação diferencia maiúsculas de minúsculas, então «println» vira IDEN. É a técnica pedida no roteiro, e ela escala bem: no Roteiro 6 é só acrescentar «else if» para if/for/else/Scanln.` },
      { p: String.raw`«parseStatement()»: como ele escolhe o caminho, e o que devolve para uma linha vazia?`,
        r: String.raw`Olha **só o token atual** (LL(1)):
- PRINT → «Println ( EXPRESSION )», vira um nó Print
- IDEN → «IDEN = EXPRESSION», vira um Assignment
- END → linha vazia, vira um **NoOp**
- qualquer outro → «[Parser] Unexpected token in statement: …»

Os dois primeiros caminhos terminam conferindo END e consumindo o «\n». Na linha vazia, o próprio END é consumido.` },
      { p: String.raw`No caminho da atribuição, por que «String nome = lexer.next.nome;» vem ANTES de «lexer.selectNext()»?`,
        r: String.raw`Porque «selectNext()» **sobrescreve** «lexer.next». Depois de avançar, o token atual passa a ser o «=», e o nome da variável se perde. Guarde o que você precisa do token antes de consumir: o Roteiro 3 já fazia isso com o operador («String operador = …» antes do «selectNext()»).` },
      { p: String.raw`«parseProgram()»: quando o laço para, e quem vira filho do Block?`,
        r: String.raw`Para quando «lexer.next.tipo == EOF». **Todo** statement vira filho, inclusive os NoOp das linhas vazias. Um arquivo com 5 linhas (contando o «\n» extra da main) dá um Block com uns 5 ou 6 filhos. No depurador você vê os NoOp na árvore.` },
      { p: String.raw`Depois de «parseProgram()», o «run()» ainda confere «if (lexer.next.tipo != EOF)». Essa checagem pode disparar?`,
        r: String.raw`**Não.** O «parseProgram()» só devolve quando o token atual já é EOF, então a condição é sempre falsa. É uma sobra do Roteiro 4, quando o run() chamava «parseExpression()», que podia parar no meio (em «1 1», por exemplo). Deixar é inofensivo (é programação defensiva), mas vale saber explicar na prova.` },
      { p: String.raw`«Assignment.evaluate()»: por que ele avalia só o filho [1] e pega o nome direto do «value» do filho [0]?`,
        r: String.raw`O filho [0] é um Identifier usado como **alvo**, não como valor. Chamar «evaluate()» nele faria «st.getValue(nome)»:
- na primeira atribuição, estouraria «[Semantic] Variable x not declared», porque a variável ainda não existe;
- nas seguintes, buscaria o valor **antigo**, que não interessa.

Então: avalia o lado direito, lê o nome com «(String) children.get(0).value» e chama «st.setValue(nome, valor)».` },
      { p: String.raw`«SymbolTable.setValue» cria ou atualiza? E o que o «getValue» faz se a variável não existe?`,
        r: String.raw`**Os dois.** Se o nome já está na tabela, atualiza o «value» do Variable que já existe. Senão, faz «put(nome, new Variable(valor))». O «getValue» lança «[Semantic] Variable nome not declared». É o único erro que a SymbolTable lança, e o roteiro exige o prefixo [Semantic].

@@v2.0|x = 1\nx = x + 1\nPrintln(x)@@` },
      { p: String.raw`«PrePro.filter» usa «replaceAll("//.*", "")». Por que o «\n» do fim da linha sobrevive?`,
        r: String.raw`Porque, em regex Java, o «.» **não casa com quebra de linha**. O «//.*» vai até o último caractere antes do «\n» e para. Se a regex fosse «//.*\n», a linha seguinte grudaria na do comentário e o Parser daria «Expected end of line».` }
    ]},
    { id: "imp", nome: "Implemente você", extra: true, itens: [
      { p: String.raw`**Novo símbolo:** o operador de resto «%», com a mesma precedência de «*» e «/». O que muda em cada parte?`,
        d: "Mesma precedência de * e / quer dizer: mesmo degrau da escada.",
        r: String.raw`**EBNF**: só o TERM muda.
~~~
TERM = FACTOR, { ("*" | "/" | "%"), FACTOR } ;
~~~
**Lexer**: um tipo novo no enum (MOD) e um ramo novo:
~~~
} else if (source.charAt(position) == '%') {
    next = new Token(TipoToken.MOD, 0);
    position++;
~~~
**Parser**: só o «parseTerm()», na condição do while e na escolha do operador. parseExpression e parseFactor **não mudam**, porque a precedência vem do degrau:
~~~
while (tipo == MULT || tipo == DIV || tipo == MOD) {
    String operador = tipo == MULT ? "*" : tipo == DIV ? "/" : "%";
~~~
**AST**: nenhuma classe nova. É um BinOp("%"):
~~~
} else if (value.equals("%")) {
    if (direito == 0) throw new RuntimeException("[Semantic] Division by zero");
    return esquerdo % direito;
~~~
**Testes**: «Println(7 % 3)» → 1 · «Println(1 + 7 % 3 * 2)» → 3 · «Println(-7 % 3)» → -1 (em Java, o sinal do resto é o do dividendo).` },
      { p: String.raw`**Variável imutável:** «const x = 1». Depois disso, «x = 2» tem que dar erro. O que muda, e que tipo de erro é?`,
        d: "O Parser consegue saber, olhando só a linha «x = 2», que x é constante?",
        r: String.raw`**EBNF**: um caminho novo no STATEMENT.
~~~
STATEMENT  = ( λ | ASSIGNMENT | CONST_DECL | PRINT ), "\n" ;
CONST_DECL = "const", IDENTIFIER, "=", EXPRESSION ;
~~~
**Lexer**: «const» é palavra reservada, na mesma peneira do Println:
~~~
} else if (acumulado.equals("const")) {
    next = new Token(TipoToken.CONST, 0);
~~~
**Parser**: um ramo novo no parseStatement, igual ao da atribuição com um token a mais na frente:
~~~
} else if (lexer.next.tipo == TipoToken.CONST) {
    lexer.selectNext();                                   // consome "const"
    if (lexer.next.tipo != TipoToken.IDEN)
        throw new RuntimeException("[Parser] Expected identifier after const");
    String nome = lexer.next.nome;
    lexer.selectNext();
    if (lexer.next.tipo != TipoToken.ASSIGN)
        throw new RuntimeException("[Parser] Expected =");
    lexer.selectNext();
    Node node = new ConstDecl(new Identifier(nome), parseExpression());
    // ... confere END como nos outros caminhos
~~~
**Variable** ganha um campo, e é por isso que ela era um envelope:
~~~
class Variable {
    int value;
    boolean constante;
    Variable(int value, boolean constante) { ... }
}
~~~
**SymbolTable**:
~~~
void declareConst(String nome, int valor) {
    if (table.containsKey(nome))
        throw new RuntimeException("[Semantic] Variable " + nome + " already declared");
    table.put(nome, new Variable(valor, true));
}
void setValue(String nome, int valor) {
    if (table.containsKey(nome)) {
        if (table.get(nome).constante)
            throw new RuntimeException("[Semantic] Cannot assign to constant " + nome);
        table.get(nome).value = valor;
    } else {
        table.put(nome, new Variable(valor, false));
    }
}
~~~
**Por que é [Semantic]**: a linha «x = 2» sozinha está sintaticamente perfeita. Só dá para recusar sabendo que, **numa linha anterior**, x virou const. Essa é uma restrição sensível ao contexto (Aula 11), e a gramática livre de contexto do Parser não consegue expressá-la.

**Testes**: «const x = 1» + «Println(x)» → 1 · «const x = 1» + «x = 2» → [Semantic] · «const x = 1» + «const x = 2» → [Semantic] already declared.` },
      { p: String.raw`**Constante de pré-processamento:** «define N = 10», que substitui N pelo valor antes do Lexer. O que muda na EBNF?`,
        d: "Leia de novo o enunciado do extra credit: \"o símbolo deixa de existir antes da etapa léxica\".",
        r: String.raw`**EBNF: nada.** Nem Lexer, nem Parser, nem AST. Tudo acontece no **PrePro**, e a gramática nunca vê o N.

**PrePro**, depois de remover os comentários:
- encontra as linhas «define NOME = valor» (regex com MULTILINE: «^\s*define\s+([A-Za-z]\w*)\s*=\s*(.*)$»);
- guarda NOME → valor num mapa e troca a linha por "", **mantendo o «\n»**;
- no resto do texto, troca «\bNOME\b» por «(valor)».

Os **parênteses** importam: com «define N = 1 + 1», «N * 2» vira «(1 + 1) * 2» = 4. Sem eles, viraria «1 + 1 * 2» = 3. É o bug clássico das macros de C.

Consequência: «N = 1» vira «10 = 1», que dá «[Parser] Unexpected token in statement: NUMERO», exatamente o "Parser Error" do enunciado.` },
      { p: String.raw`**Comentário de bloco:** «/* ... */», que pode ocupar várias linhas. Onde implementar, e que cuidado tomar?`,
        r: String.raw`No **PrePro**, antes do «//»:
~~~
Matcher m = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL).matcher(codigo);
StringBuilder sb = new StringBuilder();
while (m.find()) {
    // troca o comentário SÓ pelas quebras de linha que ele tinha
    String quebras = m.group().replaceAll("[^\n]", "");
    m.appendReplacement(sb, quebras);
}
m.appendTail(sb);
~~~
Cuidados:
- «DOTALL» faz o «.» atravessar linhas, e o «*?» (preguiçoso) para no **primeiro** «*/».
- Manter os «\n» evita juntar duas linhas numa só (senão «x = 1 /* … */ y = 2» em linhas diferentes viraria um erro).
- Um «/*» sem fechamento sobra no código, e o Lexer o lê como DIV + MULT, dois tokens válidos! O erro sairia do **Parser** e seria confuso. Melhor lançar um erro próprio no PrePro.` },
      { p: String.raw`**Println com vários argumentos:** «Println(x, y, x + y)» imprime «1 2 3». Mudanças?`,
        r: String.raw`**EBNF**:
~~~
PRINT = "Println", "(", EXPRESSION, { ",", EXPRESSION }, ")" ;
~~~
**Lexer**: token COMMA para «,».

**Parser**, no caminho do PRINT: depois da primeira expressão, um while (as chaves da EBNF viram while):
~~~
Node printNode = new Print();
printNode.children.add(parseExpression());
while (lexer.next.tipo == TipoToken.COMMA) {
    lexer.selectNext();
    printNode.children.add(parseExpression());
}
~~~
**AST**: o Print passa a ter **n** filhos. O evaluate avalia todos e imprime separados por espaço, como o «fmt.Println» do Go.` },
      { p: String.raw`**Atribuição composta:** «x += 2». Dá para fazer sem nenhuma classe nova de nó?`,
        d: "Açúcar sintático: o Parser monta com peças que já existem.",
        r: String.raw`**Dá.** «x += e» é só um jeito curto de escrever «x = x + e».

**EBNF**:
~~~
ASSIGNMENT = IDENTIFIER, ( "=" | "+=" ), EXPRESSION ;
~~~
**Lexer**: no ramo do «+», olha um caractere à frente (como o «==» do Roteiro 6): se vier «=», é PLUS_ASSIGN e avança 2.

**Parser**: no caminho do IDEN, aceita ASSIGN ou PLUS_ASSIGN. Para PLUS_ASSIGN, monta:
~~~
Node dir = parseExpression();
Node assign = new Assignment(new Identifier(nome),
        new BinOp("+", new Identifier(nome), dir));
~~~
De brinde, «y += 1» sem y declarado já dá «[Semantic] Variable y not declared», porque o Identifier do lado direito faz getValue. Repare que «x + = 1», com espaço, vira PLUS e depois ASSIGN, e dá erro de Parser.` },
      { p: String.raw`**Declaração obrigatória:** «var x = 1» antes de usar, e erro ao redeclarar ou atribuir sem declarar.`,
        r: String.raw`**EBNF**:
~~~
STATEMENT = ( λ | DECLARATION | ASSIGNMENT | PRINT ), "\n" ;
DECLARATION = "var", IDENTIFIER, [ "=", EXPRESSION ] ;
~~~
Os colchetes viram um «if»: o valor inicial é opcional, e sem ele vale 0 (como no Go).

**Lexer**: palavra reservada VAR. **AST**: um nó novo, «VarDec(id, expr?)», com 1 ou 2 filhos.

**SymbolTable**: separe as duas operações:
- «declare(nome, v)»: erro «[Semantic] Variable x already declared» se já existe;
- «setValue(nome, v)»: agora dá erro «[Semantic] Variable x not declared» se **não** existe, em vez de criar.

É o primeiro passo para tipos: no Go, «var x int».` }
    ]}
  ]
};

/* ============================================================ ROTEIRO 6 */
PERGUNTAS.r6 = {
  titulo: "Roteiro 6 · v2.1",
  grupos: [
    { id: "rot", nome: "Sobre o roteiro", itens: [
      { p: String.raw`Por que a palavra «for» gera o token «WHILE»?`,
        r: String.raw`Porque em Go **não existe while**: o «for cond { }» faz esse papel. O enunciado nomeia o token pelo significado (WHILE) e não pela grafia. O nó da AST também é «While», com 2 filhos: condição e corpo.` },
      { p: String.raw`A linguagem não tem tipo booleano. Como ficam verdadeiro e falso?`,
        r: String.raw`Tudo é int. Relacionais e lógicos **devolvem 1 ou 0**, e If e While testam «!= 0»: qualquer valor diferente de 0 conta como verdadeiro.

@@v2.1|Println(3 > 2)\nif 5 {\n    Println(7)\n}@@` },
      { p: String.raw`Por que «} else {» precisa estar na mesma linha? O que acontece com «}» numa linha e «else {» na de baixo?`,
        r: String.raw`O «\n» depois do «}» é o END que **fecha o statement do if**. A linha de baixo começa com ELSE, e nenhum statement começa com ELSE: «[Parser] Unexpected token in statement: ELSE». O Go tem a mesma regra.

@@v2.1|if 1 {\n    Println(1)\n}\nelse {\n    Println(2)\n}@@` },
      { p: String.raw`Qual a ordem de precedência, e onde ela "mora" no código?`,
        r: String.raw`Da mais forte para a mais fraca: unários «! + -» → «* /» → «+ -» → «== > <» → «&&» → «||».

Ela mora na **escada de funções**: parseBoolExpression (||) chama parseBoolTerm (&&), que chama parseRelExpression, que chama parseExpression, parseTerm e parseFactor. Quanto mais fundo, mais cedo o nó é montado e mais forte o operador.

@@v2.1|Println(1 + 2 * 3 == 7 && !0 || 0)@@` },
      { p: String.raw`Por que «Scanln()» fica no FACTOR, e o «Println» no STATEMENT?`,
        r: String.raw`**Scanln devolve um valor**, então pode aparecer no meio de uma conta: «x = Scanln() + 1». Por isso fica no degrau mais fundo, junto com números e variáveis. **Println não devolve nada**, é uma ação, então é statement.` },
      { p: String.raw`O que acontece com «i = 0» e «for i < 3 { Println(i) }»?`,
        r: String.raw`Laço infinito: ninguém muda o i, então a condição nunca chega a 0. O Java imprime 0 para sempre. O depurador para em 20 000 passos e avisa.

@@v2.1|i = 0\nfor i < 3 {\n    Println(i)\n}@@` }
    ]},
    { id: "fun", nome: "Sobre as funções", itens: [
      { p: String.raw`No Lexer, por que testar «position + 1 < source.length()» antes de olhar o caractere seguinte ao «=»?`,
        r: String.raw`Para não ler fora da String. Se o «=» for o último caractere, «charAt(position + 1)» lançaria «StringIndexOutOfBoundsException», uma exceção sem prefixo e que não explica nada. Com o «\n» que a main acrescenta isso não acontece na prática, mas o Lexer não deve depender disso.` },
      { p: String.raw`«parseBlock()» confere «EOF» dentro do laço. Se não conferisse, o que aconteceria em «if 1 {» sem fechar?`,
        r: String.raw`O laço chamaria «parseStatement()» com EOF, que lançaria «[Parser] Unexpected token in statement: EOF». Continua sendo erro, mas a mensagem não diz o problema. Conferindo antes, a mensagem vira «[Parser] Expected }», que aponta exatamente o que faltou.

@@v2.1|if 1 {\nPrintln(1)@@` },
      { p: String.raw`«parseRelExpression» usa while, então aceita «3 > 2 > 1». Quanto isso vale?`,
        d: "Associativo à esquerda: (3 > 2) > 1.",
        r: String.raw`**0!** Primeiro «3 > 2» dá 1, depois «1 > 1» dá 0. O resultado surpreende quem lê como matemática. Em Go isso nem compila, porque «bool > int» é erro de tipo. É um bom argumento para a tipagem forte (exercício adicional do roteiro).

@@v2.1|Println(3 > 2 > 1)@@` },
      { p: String.raw`Num laço que dá 3 voltas, quantas vezes «While.evaluate()» avalia a condição?`,
        r: String.raw`**4.** Três vezes dá diferente de 0 e o corpo roda; na quarta dá 0 e o laço termina. No depurador, a pilha mostra «volta» e «condicao» a cada iteração.` },
      { p: String.raw`Por que o «Scanner» do nó «Read» é «static»?`,
        r: String.raw`Para existir **um só** Scanner no programa inteiro. O Scanner lê o stdin em blocos (buffer). Se cada Scanln criasse o seu, o primeiro poderia puxar para o buffer dele linhas que eram do segundo, e o segundo não encontraria nada.` },
      { p: String.raw`O BinOp avalia os dois filhos antes de olhar o operador. Qual a consequência para «&&» e «||»? Como fazer curto-circuito?`,
        r: String.raw`**Não há curto-circuito**: «1 > 0 || 1 / 0 == 0» dá «[Semantic] Division by zero», mesmo com o lado esquerdo já verdadeiro. Para ter curto-circuito, trate && e || **antes** de avaliar o filho direito:
~~~
int esquerdo = children.get(0).evaluate(st);
if (value.equals("&&") && esquerdo == 0) return 0;
if (value.equals("||") && esquerdo != 0) return 1;
int direito = children.get(1).evaluate(st);
~~~
@@v2.1|if 1 > 0 || 1 / 0 == 0 {\n    Println(1)\n}@@` },
      { p: String.raw`O «else» é opcional. Como isso aparece na EBNF e no código?`,
        r: String.raw`Na EBNF são os colchetes: «IF = "if", BOOL_EXPRESSION, BLOCK, [ "else", BLOCK ]». No código, **colchete vira if**: «if (lexer.next.tipo == TipoToken.ELSE) { … }». O nó If fica com 2 ou 3 filhos, e o evaluate confere «children.size() > 2».` }
    ]},
    { id: "imp", nome: "Implemente você", extra: true, itens: [
      { p: String.raw`**Novos símbolos:** «!=», «>=» e «<=». Dá para fazer sem mexer no BinOp?`,
        d: "a >= b é o mesmo que !(a < b).",
        r: String.raw`**Lexer**: lookahead de 1, como no «==». «!» seguido de «=» vira NE; senão, NOT. «<» e «>» seguidos de «=» viram LE e GE.

**EBNF**: só o REL_EXPRESSION.
~~~
REL_EXPRESSION = EXPRESSION, { ("==" | "!=" | ">" | "<" | ">=" | "<="), EXPRESSION } ;
~~~
**Sem mexer no BinOp** (açúcar no parseRelExpression):
~~~
if (op == NE) node = new UnOp("!", new BinOp("==", node, dir));
if (op == GE) node = new UnOp("!", new BinOp("<", node, dir));
if (op == LE) node = new UnOp("!", new BinOp(">", node, dir));
~~~
O jeito direto também vale: três ramos novos no BinOp.evaluate. O slide da Aula 12 aponta exatamente esse caminho: "os demais relacionais podem ser obtidos via operações booleanas".` },
      { p: String.raw`**else if:** «} else if c {» sem abrir outro bloco. O que muda?`,
        r: String.raw`**EBNF**:
~~~
IF = "if", BOOL_EXPRESSION, BLOCK, [ "else", ( BLOCK | IF ) ] ;
~~~
**Parser**: separe o if numa função «parseIf()» que **não** consome o END. Assim o else pode chamá-la de novo, e o END é consumido uma vez só, no fim:
~~~
static Node parseIf() {
    lexer.selectNext();                        // consome "if"
    Node cond = parseBoolExpression();
    Node entao = parseBlock(), senao = null;
    if (lexer.next.tipo == TipoToken.ELSE) {
        lexer.selectNext();
        senao = (lexer.next.tipo == TipoToken.IF) ? parseIf() : parseBlock();
    }
    return new If(cond, entao, senao);
}
~~~
**AST**: nada novo. O else-if é um If pendurado como 3º filho de outro If.` },
      { p: String.raw`**for estilo C:** «for i = 0; i < n; i = i + 1 { ... }». Que problema de LL(1) aparece?`,
        d: "Os dois tipos de for podem começar com o mesmo token.",
        r: String.raw`**EBNF**:
~~~
FOR = "for", ( BOOL_EXPRESSION | ASSIGNMENT, ";", BOOL_EXPRESSION, ";", ASSIGNMENT ), BLOCK ;
~~~
**O problema**: «for i < n» e «for i = 0» começam os dois com IDEN. Olhando só 1 token não dá para escolher o caminho. Saída: ler o IDEN, guardar o nome e olhar o **próximo**. Se for ASSIGN, é o for do C; senão, monta o Identifier e continua a expressão. Isso é, na prática, um lookahead de 2.

**AST**: nenhum nó novo, porque é açúcar sintático:
~~~
Block[ Assignment(init),
       While(cond, Block[ ...corpo..., Assignment(passo) ]) ]
~~~
**Lexer**: token SEMICOLON.` },
      { p: String.raw`**if como expressão** (extra credit): «n = if x > 2 { 5 } else { 3 }». Onde encaixar, e por que é a maior precedência?`,
        r: String.raw`No **FACTOR**, porque é algo que devolve valor, como um número:
~~~
FACTOR = ... | "if", BOOL_EXPRESSION, "{", BOOL_EXPRESSION, "}",
               "else", "{", BOOL_EXPRESSION, "}" ;
~~~
Fica no degrau mais fundo, e por isso tem a maior precedência. Aqui o else é **obrigatório**, porque a expressão tem que valer alguma coisa.

**AST**: um nó «Ternary» com 3 filhos; «evaluate()» devolve o valor do filho 1 ou do 2. Não há ambiguidade com o if-statement: o parseStatement só vê «if» no começo da linha, e o parseFactor só é chamado depois de um «=», de um «(» etc.` },
      { p: String.raw`**break:** sair do for no meio. Como o While fica sabendo?`,
        r: String.raw`**Lexer**: BREAK (palavra reservada). **EBNF**: «STATEMENT = ( … | "break" ), "\n"». **AST**: um nó Break cujo evaluate **lança um sinal** que o While captura:
~~~
class BreakSinal extends RuntimeException {}
// Break.evaluate:  throw new BreakSinal();
// While.evaluate:
while (children.get(0).evaluate(st) != 0) {
    try { children.get(1).evaluate(st); }
    catch (BreakSinal b) { break; }
}
~~~
O break fora de um laço sobe até a main e precisa virar um erro com prefixo. Dá para pegar no Parser com um contador de profundidade de laços, que é mais cedo e com mensagem melhor.` },
      { p: String.raw`**repeat … until** (exercício adicional): o corpo roda pelo menos uma vez.`,
        r: String.raw`**EBNF**: «REPEAT = "repeat", BLOCK, "until", BOOL_EXPRESSION ;»
**Lexer**: REPEAT e UNTIL. **AST**: «RepeatUntil(corpo, cond)»:
~~~
int evaluate(SymbolTable st) {
    do {
        children.get(0).evaluate(st);
    } while (children.get(1).evaluate(st) == 0);   // até a condição ser verdadeira
    return 0;
}
~~~
Repare que é o **contrário** do while: repete enquanto a condição for falsa.` },
      { p: String.raw`**Tipagem forte** (exercício adicional): o que muda para «if 5 { }» e «3 > 2 > 1» virarem erro?`,
        r: String.raw`- **Variable** ganha «tipo» (é o envelope, de novo).
- O **evaluate()** deixa de devolver int puro e passa a devolver um par (valor, tipo), por exemplo uma classe «Valor».
- **BinOp** confere os tipos: aritméticos pedem int e int e dão int; relacionais pedem int e dão bool; && e || pedem bool.
- **If/While** exigem bool na condição: «if 5» vira «[Semantic] Condition must be bool».
- Declaração com tipo: «var x int», e a atribuição confere se os tipos batem.

Isso é análise semântica de verdade. Dá para fazer numa passada separada pela árvore (type checking) antes de executar.` }
    ]}
  ]
};
