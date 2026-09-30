import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;

public class Main {
    public static void main(String[] args) throws Exception {
        // agora a entrada vem de um ARQUIVO, não mais de args[0] direto como texto -
        // args[0] é o NOME do arquivo, precisamos ler o conteúdo dele
        String conteudo = new String(Files.readAllBytes(Paths.get(args[0])));
        // o enunciado pede pra garantir um "\n" no final, senão a última linha
        // do arquivo não teria um token END pra fechar o último Statement
        conteudo = conteudo + "\n";

        // Pré-processamento ACONTECE ANTES do Lexer - remove comentários
        // antes de qualquer análise léxica começar
        String codigoLimpo = PrePro.filter(conteudo);

        // Parser.run() agora começa em parseProgram(), não mais parseExpression() -
        // o ponto de entrada da linguagem agora é "um programa inteiro", não uma expressão só
        Node raiz = Parser.run(codigoLimpo);

        // cria a tabela de símbolos UMA VEZ, fora da árvore, e passa como
        // argumento pro evaluate() da raiz - ela vai ser repassada adiante,
        // pra baixo, em CADA chamada de evaluate() dos filhos
        SymbolTable st = new SymbolTable();
        raiz.evaluate(st);
        // repara que não tem "System.out.println(raiz.evaluate(st))" aqui -
        // quem imprime agora é o próprio nó Print, lá dentro do evaluate()
    }
}

// ===================== Pré-processamento =====================
class PrePro {
    // remove tudo de "//" até o fim da linha, mas preserva o "\n" -
    // por isso a regex "//.*" e não "//.*\n": o ponto (.) já não cruza
    // quebra de linha por padrão em Java, então o \n sobrevive sozinho
    static String filter(String codigo) {
        return codigo.replaceAll("//.*", "");
    }
}

// ===================== Tabela de Símbolos =====================
// Variable é só um "envelope" pro valor de uma variável - existe separado
// de int puro porque no futuro pode ganhar mais atributos (tipo do dado,
// somente-leitura, etc), sem precisar mudar a SymbolTable
class Variable {
    int value;

    Variable(int value) {
        this.value = value;
    }
}

class SymbolTable {
    // atributo "table" tratado como property (getter/setter), guardando
    // nome da variável -> objeto Variable
    private HashMap<String, Variable> table = new HashMap<String, Variable>();

    HashMap<String, Variable> getTable() {
        return table;
    }

    void setTable(HashMap<String, Variable> table) {
        this.table = table;
    }

    // busca o VALOR de uma variável - erro semântico se ela nunca foi criada
    int getValue(String nome) {
        if (!table.containsKey(nome)) {
            throw new RuntimeException("[Semantic] Variable " + nome + " not declared");
        }
        return table.get(nome).value;
    }

    // cria (se não existir) ou atualiza (se já existir) o valor de uma variável
    void setValue(String nome, int valor) {
        if (table.containsKey(nome)) {
            table.get(nome).value = valor;
        } else {
            table.put(nome, new Variable(valor));
        }
    }
}

// ===================== Tokens =====================
// 4 tipos novos: ASSIGN ('='), END ('\n'), PRINT (palavra reservada
// "Println"), IDEN (identificador/nome de variável)
enum TipoToken {
    NUMERO, PLUS, MINUS, MULT, DIV, OPEN_PAR, CLOSE_PAR,
    ASSIGN, END, PRINT, IDEN, EOF
}

class Token {
    TipoToken tipo;
    int valor;   // usado só quando tipo == NUMERO
    String nome; // usado só quando tipo == IDEN (o nome da variável)

    // construtor pra tokens "normais" (número ou símbolos sem nome associado)
    Token(TipoToken tipo, int valor) {
        this.tipo = tipo;
        this.valor = valor;
    }

    // construtor separado pra IDEN, que carrega uma String (o nome), não um int
    Token(TipoToken tipo, String nome) {
        this.tipo = tipo;
        this.nome = nome;
    }
}

// ===================== Lexer =====================
class Lexer {
    String source;
    int position;
    Token next;

    Lexer(String source) {
        this.source = source;
        this.position = 0;
    }

    void selectNext() {
        // pula espaço e tab, mas CUIDADO: '\n' também conta como
        // "whitespace" pro Character.isWhitespace(), só que agora ele
        // precisa virar um TOKEN (END), não ser silenciosamente ignorado -
        // por isso a condição aqui exclui explicitamente o '\n'
        while (position < source.length()
                && Character.isWhitespace(source.charAt(position))
                && source.charAt(position) != '\n') {
            position++;
        }

        if (position >= source.length()) {
            next = new Token(TipoToken.EOF, 0);

        } else if (source.charAt(position) == '\n') {
            // quebra de linha agora é um token de verdade - marca fim de Statement
            next = new Token(TipoToken.END, 0);
            position++;

        } else if (source.charAt(position) == '+') {
            next = new Token(TipoToken.PLUS, 0);
            position++;

        } else if (source.charAt(position) == '-') {
            next = new Token(TipoToken.MINUS, 0);
            position++;

        } else if (source.charAt(position) == '*') {
            next = new Token(TipoToken.MULT, 0);
            position++;

        } else if (source.charAt(position) == '/') {
            next = new Token(TipoToken.DIV, 0);
            position++;

        } else if (source.charAt(position) == '(') {
            next = new Token(TipoToken.OPEN_PAR, 0);
            position++;

        } else if (source.charAt(position) == ')') {
            next = new Token(TipoToken.CLOSE_PAR, 0);
            position++;

        } else if (source.charAt(position) == '=') {
            next = new Token(TipoToken.ASSIGN, 0);
            position++;

        } else if (Character.isDigit(source.charAt(position))) {
            String acumulado = "";
            while (position < source.length() && Character.isDigit(source.charAt(position))) {
                acumulado += source.charAt(position);
                position++;
            }
            next = new Token(TipoToken.NUMERO, Integer.parseInt(acumulado));

        } else if (Character.isLetter(source.charAt(position))) {
            // identificador PRECISA começar com letra (é por isso que "1x"
            // e "_x" são inválidos - eles caem nos outros ramos, não neste)
            // mas pode CONTINUAR com letra, dígito ou underscore
            String acumulado = "";
            while (position < source.length()
                    && (Character.isLetterOrDigit(source.charAt(position)) || source.charAt(position) == '_')) {
                acumulado += source.charAt(position);
                position++;
            }
            // truque do enunciado: trata como identificador comum primeiro,
            // e só DEPOIS checa se bateu com uma palavra reservada
            if (acumulado.equals("Println")) {
                next = new Token(TipoToken.PRINT, 0);
            } else {
                next = new Token(TipoToken.IDEN, acumulado);
            }

        } else {
            throw new RuntimeException("[Lexer] Invalid Symbol " + source.charAt(position));
        }
    }
}

// ===================== AST =====================
abstract class Node {
    Object value;
    ArrayList<Node> children = new ArrayList<Node>();

    // MUDANÇA-CHAVE do roteiro: evaluate() agora recebe a SymbolTable -
    // toda variável precisa desse "estado compartilhado" pra saber os valores
    abstract int evaluate(SymbolTable st);
}

class IntVal extends Node {
    IntVal(int valor) {
        this.value = valor;
    }

    int evaluate(SymbolTable st) {
        // IntVal nem usa o "st" de verdade - só recebe porque a assinatura
        // do método é a mesma pra todo mundo (polimorfismo)
        return (Integer) value;
    }
}

class UnOp extends Node {
    UnOp(String operador, Node operando) {
        this.value = operador;
        this.children.add(operando);
    }

    int evaluate(SymbolTable st) {
        // repassa "st" pro filho - ele pode precisar dela lá dentro
        // (por exemplo, se o operando for uma variável)
        int resultado = children.get(0).evaluate(st);
        if (value.equals("-")) {
            return -resultado;
        } else {
            return resultado;
        }
    }
}

class BinOp extends Node {
    BinOp(String operador, Node esquerdo, Node direito) {
        this.value = operador;
        this.children.add(esquerdo);
        this.children.add(direito);
    }

    int evaluate(SymbolTable st) {
        int esquerdo = children.get(0).evaluate(st);
        int direito = children.get(1).evaluate(st);

        if (value.equals("+")) {
            return esquerdo + direito;
        } else if (value.equals("-")) {
            return esquerdo - direito;
        } else if (value.equals("*")) {
            return esquerdo * direito;
        } else if (value.equals("/")) {
            if (direito == 0) {
                throw new RuntimeException("[Semantic] Division by zero");
            }
            return esquerdo / direito;
        } else {
            throw new RuntimeException("[Semantic] Invalid operator " + value);
        }
    }
}

// Identifier: folha da árvore, representa o USO de uma variável (ex: em "x + 1")
// repara a diferença de Assignment: aqui SIM queremos o VALOR atual da variável
class Identifier extends Node {
    Identifier(String nome) {
        this.value = nome; // guarda o NOME (String), não o valor numérico
    }

    int evaluate(SymbolTable st) {
        // consulta a tabela de símbolos pelo nome, pra saber o valor ATUAL
        return st.getValue((String) value);
    }
}

// Print: 1 filho, imprime o resultado do filho - não retorna nada de útil
class Print extends Node {
    Print(Node expressao) {
        this.children.add(expressao);
    }

    int evaluate(SymbolTable st) {
        int resultado = children.get(0).evaluate(st);
        System.out.println(resultado);
        return 0; // dummy - Print não tem "resultado" que alguém use depois
    }
}

// Assignment: 2 filhos, mas NÃO é um BinOp - a semântica é bem diferente:
// filho[0] é o NOME da variável (não se calcula "o valor" de um nome),
// filho[1] é a expressão que calcula o valor a ser guardado
class Assignment extends Node {
    Assignment(Node identificador, Node expressao) {
        this.children.add(identificador); // índice 0: NÃO chamamos evaluate() nele
        this.children.add(expressao);     // índice 1: esse sim é calculado
    }

    int evaluate(SymbolTable st) {
        int valor = children.get(1).evaluate(st); // calcula o lado direito
        // pega o NOME direto do value do Identifier - "não faz sentido"
        // chamar evaluate() nele, porque isso tentaria BUSCAR um valor
        // que ainda nem existe (ou existe com valor antigo, que não é o que queremos)
        String nome = (String) children.get(0).value;
        st.setValue(nome, valor); // guarda na tabela de símbolos
        return 0; // dummy - Assignment também não devolve nada útil
    }
}

// Block: representa o PROGRAMA inteiro (ou qualquer bloco de instruções) -
// número de filhos é variável, um filho por linha/instrução do arquivo
class Block extends Node {
    int evaluate(SymbolTable st) {
        // simplesmente executa cada instrução, uma atrás da outra, em ordem
        for (Node filho : children) {
            filho.evaluate(st);
        }
        return 0; // dummy
    }
}

// NoOp: representa uma linha vazia - literalmente não faz nada
class NoOp extends Node {
    int evaluate(SymbolTable st) {
        return 0; // não faz mesmo nada - é um "não-operador"
    }
}

// ===================== Parser =====================
class Parser {
    static Lexer lexer;

    static Node parseFactor() {
        if (lexer.next.tipo == TipoToken.NUMERO) {
            Node node = new IntVal(lexer.next.valor);
            lexer.selectNext();
            return node;

        } else if (lexer.next.tipo == TipoToken.PLUS) {
            lexer.selectNext();
            Node filho = parseFactor();
            return new UnOp("+", filho);

        } else if (lexer.next.tipo == TipoToken.MINUS) {
            lexer.selectNext();
            Node filho = parseFactor();
            return new UnOp("-", filho);

        } else if (lexer.next.tipo == TipoToken.OPEN_PAR) {
            lexer.selectNext();
            Node node = parseExpression();
            if (lexer.next.tipo != TipoToken.CLOSE_PAR) {
                throw new RuntimeException("[Parser] Expected )");
            }
            lexer.selectNext();
            return node;

        } else if (lexer.next.tipo == TipoToken.IDEN) {
            // NOVO: usar uma variável dentro de uma expressão, tipo "x + 1"
            Node node = new Identifier(lexer.next.nome);
            lexer.selectNext();
            return node;

        } else {
            throw new RuntimeException("[Parser] Unexpected token in factor: " + lexer.next.tipo);
        }
    }

    static Node parseTerm() {
        Node node = parseFactor();
        while (lexer.next.tipo == TipoToken.MULT || lexer.next.tipo == TipoToken.DIV) {
            String operador = (lexer.next.tipo == TipoToken.MULT) ? "*" : "/";
            lexer.selectNext();
            Node direito = parseFactor();
            node = new BinOp(operador, node, direito);
        }
        return node;
    }

    static Node parseExpression() {
        Node node = parseTerm();
        while (lexer.next.tipo == TipoToken.PLUS || lexer.next.tipo == TipoToken.MINUS) {
            String operador = (lexer.next.tipo == TipoToken.PLUS) ? "+" : "-";
            lexer.selectNext();
            Node direito = parseTerm();
            node = new BinOp(operador, node, direito);
        }
        return node;
    }

    // NOVO: trata UMA instrução (uma "linha" da linguagem), decidindo qual
    // das 3 alternativas seguir só olhando o token atual
    static Node parseStatement() {

        if (lexer.next.tipo == TipoToken.PRINT) {
            // Println ( EXPRESSION )
            lexer.selectNext(); // consome "Println"
            if (lexer.next.tipo != TipoToken.OPEN_PAR) {
                throw new RuntimeException("[Parser] Expected (");
            }
            lexer.selectNext(); // consome "("
            Node expressao = parseExpression();
            if (lexer.next.tipo != TipoToken.CLOSE_PAR) {
                throw new RuntimeException("[Parser] Expected )");
            }
            lexer.selectNext(); // consome ")"
            Node printNode = new Print(expressao);

            if (lexer.next.tipo != TipoToken.END) {
                throw new RuntimeException("[Parser] Expected end of line");
            }
            lexer.selectNext(); // consome o '\n' que fecha a instrução
            return printNode;

        } else if (lexer.next.tipo == TipoToken.IDEN) {
            // IDENTIFIER "=" EXPRESSION
            String nome = lexer.next.nome; // guarda o nome ANTES de avançar
            Node idNode = new Identifier(nome);
            lexer.selectNext(); // consome o identificador

            if (lexer.next.tipo != TipoToken.ASSIGN) {
                throw new RuntimeException("[Parser] Expected =");
            }
            lexer.selectNext(); // consome o '='

            Node expressao = parseExpression();
            Node assignNode = new Assignment(idNode, expressao);

            if (lexer.next.tipo != TipoToken.END) {
                throw new RuntimeException("[Parser] Expected end of line");
            }
            lexer.selectNext(); // consome o '\n'
            return assignNode;

        } else if (lexer.next.tipo == TipoToken.END) {
            // linha vazia: ε seguido de EOL, direto - vira um NoOp
            lexer.selectNext(); // consome o '\n' sozinho
            return new NoOp();

        } else {
            throw new RuntimeException("[Parser] Unexpected token in statement: " + lexer.next.tipo);
        }
    }

    // NOVO ponto de entrada: um programa é uma sequência de Statements,
    // até bater EOF - cada Statement vira um filho do Block
    static Node parseProgram() {
        Node bloco = new Block();
        while (lexer.next.tipo != TipoToken.EOF) {
            Node statement = parseStatement();
            bloco.children.add(statement);
        }
        return bloco;
    }

    static Node run(String code) {
        lexer = new Lexer(code);
        lexer.selectNext();
        Node raiz = parseProgram(); // era parseExpression() antes - agora é o programa inteiro

        if (lexer.next.tipo != TipoToken.EOF) {
            throw new RuntimeException("[Parser] Unexpected token " + lexer.next.tipo);
        }
        return raiz;
    }
}