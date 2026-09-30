import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Scanner;

// ============================================================================
// REFERÊNCIA DO ROTEIRO 6 (v2.1) usada pelo depurador do site.
// É o main.java do Roteiro 5 (v2.0) com os acréscimos do Roteiro 6 marcados
// com "R6:". Serve pra estudar - a sua versão é você quem escreve!
// Os comentários "//#chave" no fim das linhas marcam a linha que o
// depurador destaca; o site remove esses marcadores antes de mostrar.
// ============================================================================

public class Main {
    public static void main(String[] args) throws Exception {
        String conteudo = new String(Files.readAllBytes(Paths.get(args[0]))); //#main_read
        conteudo = conteudo + "\n"; //#main_nl

        String codigoLimpo = PrePro.filter(conteudo); //#main_prepro

        Node raiz = Parser.run(codigoLimpo); //#main_parse

        SymbolTable st = new SymbolTable(); //#main_st
        raiz.evaluate(st); //#main_eval
    }
}

// ===================== Pré-processamento =====================
class PrePro {
    static String filter(String codigo) {
        return codigo.replaceAll("//.*", ""); //#prepro
    }
}

// ===================== Tabela de Símbolos =====================
class Variable {
    int value;

    Variable(int value) {
        this.value = value;
    }
}

class SymbolTable {
    private HashMap<String, Variable> table = new HashMap<String, Variable>();

    HashMap<String, Variable> getTable() {
        return table;
    }

    void setTable(HashMap<String, Variable> table) {
        this.table = table;
    }

    int getValue(String nome) {
        if (!table.containsKey(nome)) { //#st_get_chk
            throw new RuntimeException("[Semantic] Variable " + nome + " not declared"); //#st_get_err
        }
        return table.get(nome).value; //#st_get_ret
    }

    void setValue(String nome, int valor) {
        if (table.containsKey(nome)) { //#st_set_chk
            table.get(nome).value = valor; //#st_set_upd
        } else {
            table.put(nome, new Variable(valor)); //#st_set_new
        }
    }
}

// ===================== Tokens =====================
// R6: 12 tipos novos - operadores booleanos (AND, OR, NOT), relacionais
// (EQ, GT, LT), palavras reservadas (IF, WHILE, ELSE, READ) e chaves
enum TipoToken {
    NUMERO, PLUS, MINUS, MULT, DIV, OPEN_PAR, CLOSE_PAR,
    ASSIGN, END, PRINT, IDEN, EOF,
    AND, OR, NOT, EQ, GT, LT,
    IF, WHILE, ELSE, READ,
    OPEN_BRA, CLOSE_BRA
}

class Token {
    TipoToken tipo;
    int valor;
    String nome;

    Token(TipoToken tipo, int valor) {
        this.tipo = tipo;
        this.valor = valor;
    }

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
        while (position < source.length() //#lex_ws
                && Character.isWhitespace(source.charAt(position))
                && source.charAt(position) != '\n') {
            position++;
        }

        if (position >= source.length()) {
            next = new Token(TipoToken.EOF, 0); //#lex_eof

        } else if (source.charAt(position) == '\n') {
            next = new Token(TipoToken.END, 0); //#lex_end
            position++;

        } else if (source.charAt(position) == '+') {
            next = new Token(TipoToken.PLUS, 0); //#lex_plus
            position++;

        } else if (source.charAt(position) == '-') {
            next = new Token(TipoToken.MINUS, 0); //#lex_minus
            position++;

        } else if (source.charAt(position) == '*') {
            next = new Token(TipoToken.MULT, 0); //#lex_mult
            position++;

        } else if (source.charAt(position) == '/') {
            next = new Token(TipoToken.DIV, 0); //#lex_div
            position++;

        } else if (source.charAt(position) == '(') {
            next = new Token(TipoToken.OPEN_PAR, 0); //#lex_open
            position++;

        } else if (source.charAt(position) == ')') {
            next = new Token(TipoToken.CLOSE_PAR, 0); //#lex_close
            position++;

        } else if (source.charAt(position) == '=') {
            // R6: olha UM caractere à frente - "==" é comparação,
            // "=" sozinho continua sendo atribuição
            if (position + 1 < source.length() && source.charAt(position + 1) == '=') { //#lex_eq_chk
                next = new Token(TipoToken.EQ, 0); //#lex_eq
                position += 2;
            } else {
                next = new Token(TipoToken.ASSIGN, 0); //#lex_assign
                position++;
            }

        } else if (source.charAt(position) == '&') {
            // R6: "&&" é UM token - um '&' sozinho não existe na linguagem
            if (position + 1 < source.length() && source.charAt(position + 1) == '&') { //#lex_and_chk
                next = new Token(TipoToken.AND, 0); //#lex_and
                position += 2;
            } else {
                throw new RuntimeException("[Lexer] Invalid Symbol &"); //#lex_and_err
            }

        } else if (source.charAt(position) == '|') {
            // R6: mesma ideia pro "||"
            if (position + 1 < source.length() && source.charAt(position + 1) == '|') { //#lex_or_chk
                next = new Token(TipoToken.OR, 0); //#lex_or
                position += 2;
            } else {
                throw new RuntimeException("[Lexer] Invalid Symbol |"); //#lex_or_err
            }

        } else if (source.charAt(position) == '!') {
            next = new Token(TipoToken.NOT, 0); //#lex_not
            position++;

        } else if (source.charAt(position) == '>') {
            next = new Token(TipoToken.GT, 0); //#lex_gt
            position++;

        } else if (source.charAt(position) == '<') {
            next = new Token(TipoToken.LT, 0); //#lex_lt
            position++;

        } else if (source.charAt(position) == '{') {
            next = new Token(TipoToken.OPEN_BRA, 0); //#lex_obra
            position++;

        } else if (source.charAt(position) == '}') {
            next = new Token(TipoToken.CLOSE_BRA, 0); //#lex_cbra
            position++;

        } else if (Character.isDigit(source.charAt(position))) {
            String acumulado = "";
            while (position < source.length() && Character.isDigit(source.charAt(position))) { //#lex_num_loop
                acumulado += source.charAt(position);
                position++;
            }
            next = new Token(TipoToken.NUMERO, Integer.parseInt(acumulado)); //#lex_num

        } else if (Character.isLetter(source.charAt(position))) {
            String acumulado = "";
            while (position < source.length() //#lex_word_loop
                    && (Character.isLetterOrDigit(source.charAt(position)) || source.charAt(position) == '_')) {
                acumulado += source.charAt(position);
                position++;
            }
            // R6: mais palavras reservadas na mesma "peneira" do Println
            if (acumulado.equals("Println")) { //#lex_kw_chk
                next = new Token(TipoToken.PRINT, 0); //#lex_print
            } else if (acumulado.equals("if")) {
                next = new Token(TipoToken.IF, 0); //#lex_if
            } else if (acumulado.equals("for")) {
                // em Go, "for" faz o papel do while - por isso o token é WHILE
                next = new Token(TipoToken.WHILE, 0); //#lex_while
            } else if (acumulado.equals("else")) {
                next = new Token(TipoToken.ELSE, 0); //#lex_else
            } else if (acumulado.equals("Scanln")) {
                next = new Token(TipoToken.READ, 0); //#lex_read
            } else {
                next = new Token(TipoToken.IDEN, acumulado); //#lex_iden
            }

        } else {
            throw new RuntimeException("[Lexer] Invalid Symbol " + source.charAt(position)); //#lex_err
        }
    }
}

// ===================== AST =====================
abstract class Node {
    Object value;
    ArrayList<Node> children = new ArrayList<Node>();

    abstract int evaluate(SymbolTable st);
}

class IntVal extends Node {
    IntVal(int valor) {
        this.value = valor;
    }

    int evaluate(SymbolTable st) {
        return (Integer) value; //#ev_int
    }
}

class UnOp extends Node {
    UnOp(String operador, Node operando) {
        this.value = operador;
        this.children.add(operando);
    }

    int evaluate(SymbolTable st) {
        int resultado = children.get(0).evaluate(st); //#ev_un_child
        if (value.equals("-")) {
            return -resultado; //#ev_un_neg
        } else if (value.equals("!")) {
            // R6: não existe booleano de verdade - 0 é falso, qualquer outro é verdadeiro
            return (resultado == 0) ? 1 : 0; //#ev_un_not
        } else {
            return resultado; //#ev_un_pos
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
        int esquerdo = children.get(0).evaluate(st); //#ev_bin_l
        int direito = children.get(1).evaluate(st); //#ev_bin_r

        if (value.equals("+")) {
            return esquerdo + direito; //#ev_bin_plus
        } else if (value.equals("-")) {
            return esquerdo - direito; //#ev_bin_minus
        } else if (value.equals("*")) {
            return esquerdo * direito; //#ev_bin_mult
        } else if (value.equals("/")) {
            if (direito == 0) { //#ev_bin_div_chk
                throw new RuntimeException("[Semantic] Division by zero"); //#ev_bin_div_err
            }
            return esquerdo / direito; //#ev_bin_div
        } else if (value.equals("==")) {
            // R6: relacionais devolvem 1 (verdadeiro) ou 0 (falso)
            return (esquerdo == direito) ? 1 : 0; //#ev_bin_eq
        } else if (value.equals(">")) {
            return (esquerdo > direito) ? 1 : 0; //#ev_bin_gt
        } else if (value.equals("<")) {
            return (esquerdo < direito) ? 1 : 0; //#ev_bin_lt
        } else if (value.equals("&&")) {
            // R6: repara que os DOIS filhos já foram avaliados lá em cima -
            // aqui não tem curto-circuito como no && do Java
            return (esquerdo != 0 && direito != 0) ? 1 : 0; //#ev_bin_and
        } else if (value.equals("||")) {
            return (esquerdo != 0 || direito != 0) ? 1 : 0; //#ev_bin_or
        } else {
            throw new RuntimeException("[Semantic] Invalid operator " + value);
        }
    }
}

class Identifier extends Node {
    Identifier(String nome) {
        this.value = nome;
    }

    int evaluate(SymbolTable st) {
        return st.getValue((String) value); //#ev_iden
    }
}

class Print extends Node {
    Print(Node expressao) {
        this.children.add(expressao);
    }

    int evaluate(SymbolTable st) {
        int resultado = children.get(0).evaluate(st); //#ev_print_child
        System.out.println(resultado); //#ev_print_out
        return 0;
    }
}

class Assignment extends Node {
    Assignment(Node identificador, Node expressao) {
        this.children.add(identificador);
        this.children.add(expressao);
    }

    int evaluate(SymbolTable st) {
        int valor = children.get(1).evaluate(st); //#ev_asg_child
        String nome = (String) children.get(0).value; //#ev_asg_name
        st.setValue(nome, valor); //#ev_asg_set
        return 0;
    }
}

class Block extends Node {
    int evaluate(SymbolTable st) {
        for (Node filho : children) { //#ev_block_for
            filho.evaluate(st); //#ev_block_child
        }
        return 0;
    }
}

class NoOp extends Node {
    int evaluate(SymbolTable st) {
        return 0; //#ev_noop
    }
}

// R6: If tem 2 filhos (condição, bloco do "então") ou 3 (+ bloco do else)
class If extends Node {
    If(Node condicao, Node entao, Node senao) {
        this.children.add(condicao);
        this.children.add(entao);
        if (senao != null) {
            this.children.add(senao);
        }
    }

    int evaluate(SymbolTable st) {
        if (children.get(0).evaluate(st) != 0) { //#ev_if_cond
            children.get(1).evaluate(st); //#ev_if_then
        } else if (children.size() > 2) { //#ev_if_has_else
            children.get(2).evaluate(st); //#ev_if_else
        }
        return 0; //#ev_if_end
    }
}

// R6: While tem sempre 2 filhos - a condição é REAVALIADA a cada volta
class While extends Node {
    While(Node condicao, Node corpo) {
        this.children.add(condicao);
        this.children.add(corpo);
    }

    int evaluate(SymbolTable st) {
        while (children.get(0).evaluate(st) != 0) { //#ev_while_cond
            children.get(1).evaluate(st); //#ev_while_body
        }
        return 0; //#ev_while_end
    }
}

// R6: Read não tem filhos - o valor vem de fora do programa (do terminal)
class Read extends Node {
    // UM Scanner só pro programa inteiro: se cada Scanln criasse o seu,
    // o primeiro poderia "engolir" no buffer linhas que eram do segundo
    static Scanner scanner = new Scanner(System.in);

    int evaluate(SymbolTable st) {
        if (!scanner.hasNextLine()) { //#ev_read_chk
            throw new RuntimeException("[Semantic] Scanln: no input available"); //#ev_read_eof
        }
        String linha = scanner.nextLine().trim(); //#ev_read_line
        try {
            return Integer.parseInt(linha); //#ev_read_ret
        } catch (NumberFormatException e) {
            throw new RuntimeException("[Semantic] Scanln: invalid integer " + linha); //#ev_read_err
        }
    }
}

// ===================== Parser =====================
class Parser {
    static Lexer lexer;

    static Node parseFactor() { //#pf_enter
        if (lexer.next.tipo == TipoToken.NUMERO) { //#pf_num_chk
            Node node = new IntVal(lexer.next.valor); //#pf_num
            lexer.selectNext(); //#pf_num_next
            return node;

        } else if (lexer.next.tipo == TipoToken.PLUS) { //#pf_plus_chk
            lexer.selectNext(); //#pf_plus_next
            Node filho = parseFactor(); //#pf_plus_call
            return new UnOp("+", filho); //#pf_plus_ret

        } else if (lexer.next.tipo == TipoToken.MINUS) { //#pf_minus_chk
            lexer.selectNext(); //#pf_minus_next
            Node filho = parseFactor(); //#pf_minus_call
            return new UnOp("-", filho); //#pf_minus_ret

        } else if (lexer.next.tipo == TipoToken.NOT) { //#pf_not_chk
            // R6: "!" é unário, igualzinho ao "-", só muda o operador
            lexer.selectNext(); //#pf_not_next
            Node filho = parseFactor(); //#pf_not_call
            return new UnOp("!", filho); //#pf_not_ret

        } else if (lexer.next.tipo == TipoToken.OPEN_PAR) { //#pf_par_chk
            lexer.selectNext(); //#pf_par_next
            // R6: dentro do parênteses agora cabe uma expressão BOOLEANA inteira
            Node node = parseBoolExpression(); //#pf_par_call
            if (lexer.next.tipo != TipoToken.CLOSE_PAR) { //#pf_par_close_chk
                throw new RuntimeException("[Parser] Expected )"); //#pf_par_err
            }
            lexer.selectNext(); //#pf_par_close_next
            return node; //#pf_par_ret

        } else if (lexer.next.tipo == TipoToken.IDEN) { //#pf_iden_chk
            Node node = new Identifier(lexer.next.nome); //#pf_iden
            lexer.selectNext(); //#pf_iden_next
            return node;

        } else if (lexer.next.tipo == TipoToken.READ) { //#pf_read_chk
            // R6: Scanln ( ) - é um FACTOR porque devolve um valor, dá pra
            // usar no meio de uma conta: x = Scanln() + 1
            lexer.selectNext(); //#pf_read_next
            if (lexer.next.tipo != TipoToken.OPEN_PAR) { //#pf_read_open_chk
                throw new RuntimeException("[Parser] Expected ("); //#pf_read_open_err
            }
            lexer.selectNext(); //#pf_read_open_next
            if (lexer.next.tipo != TipoToken.CLOSE_PAR) { //#pf_read_close_chk
                throw new RuntimeException("[Parser] Expected )"); //#pf_read_close_err
            }
            lexer.selectNext(); //#pf_read_close_next
            return new Read(); //#pf_read_ret

        } else {
            throw new RuntimeException("[Parser] Unexpected token in factor: " + lexer.next.tipo); //#pf_err
        }
    }

    static Node parseTerm() { //#pt_enter
        Node node = parseFactor(); //#pt_first
        while (lexer.next.tipo == TipoToken.MULT || lexer.next.tipo == TipoToken.DIV) { //#pt_while
            String operador = (lexer.next.tipo == TipoToken.MULT) ? "*" : "/"; //#pt_op
            lexer.selectNext(); //#pt_op_next
            Node direito = parseFactor(); //#pt_right
            node = new BinOp(operador, node, direito); //#pt_binop
        }
        return node; //#pt_ret
    }

    static Node parseExpression() { //#pe_enter
        Node node = parseTerm(); //#pe_first
        while (lexer.next.tipo == TipoToken.PLUS || lexer.next.tipo == TipoToken.MINUS) { //#pe_while
            String operador = (lexer.next.tipo == TipoToken.PLUS) ? "+" : "-"; //#pe_op
            lexer.selectNext(); //#pe_op_next
            Node direito = parseTerm(); //#pe_right
            node = new BinOp(operador, node, direito); //#pe_binop
        }
        return node; //#pe_ret
    }

    // R6: mesmo molde do parseExpression, um degrau ACIMA na precedência:
    // REL_EXPRESSION = EXPRESSION, { ("==" | ">" | "<"), EXPRESSION }
    static Node parseRelExpression() { //#pr_enter
        Node node = parseExpression(); //#pr_first
        while (lexer.next.tipo == TipoToken.EQ || lexer.next.tipo == TipoToken.GT || lexer.next.tipo == TipoToken.LT) { //#pr_while
            String operador = (lexer.next.tipo == TipoToken.EQ) ? "==" : (lexer.next.tipo == TipoToken.GT) ? ">" : "<"; //#pr_op
            lexer.selectNext(); //#pr_op_next
            Node direito = parseExpression(); //#pr_right
            node = new BinOp(operador, node, direito); //#pr_binop
        }
        return node; //#pr_ret
    }

    // R6: BOOL_TERM = REL_EXPRESSION, { "&&", REL_EXPRESSION }
    static Node parseBoolTerm() { //#pbt_enter
        Node node = parseRelExpression(); //#pbt_first
        while (lexer.next.tipo == TipoToken.AND) { //#pbt_while
            lexer.selectNext(); //#pbt_op_next
            Node direito = parseRelExpression(); //#pbt_right
            node = new BinOp("&&", node, direito); //#pbt_binop
        }
        return node; //#pbt_ret
    }

    // R6: BOOL_EXPRESSION = BOOL_TERM, { "||", BOOL_TERM } - o degrau mais
    // de cima: || é quem tem a MENOR precedência de todas
    static Node parseBoolExpression() { //#pbe_enter
        Node node = parseBoolTerm(); //#pbe_first
        while (lexer.next.tipo == TipoToken.OR) { //#pbe_while
            lexer.selectNext(); //#pbe_op_next
            Node direito = parseBoolTerm(); //#pbe_right
            node = new BinOp("||", node, direito); //#pbe_binop
        }
        return node; //#pbe_ret
    }

    // R6: BLOCK = "{", { STATEMENT }, "}" - parecido com o parseProgram,
    // só que o laço para no "}" em vez de parar no EOF
    static Node parseBlock() { //#pb_enter
        if (lexer.next.tipo != TipoToken.OPEN_BRA) { //#pb_open_chk
            throw new RuntimeException("[Parser] Expected {"); //#pb_open_err
        }
        lexer.selectNext(); //#pb_open_next
        Node bloco = new Block(); //#pb_block
        while (lexer.next.tipo != TipoToken.CLOSE_BRA) { //#pb_while
            if (lexer.next.tipo == TipoToken.EOF) { //#pb_eof_chk
                throw new RuntimeException("[Parser] Expected }"); //#pb_eof_err
            }
            Node statement = parseStatement(); //#pb_stmt
            bloco.children.add(statement); //#pb_add
        }
        lexer.selectNext(); //#pb_close_next
        return bloco; //#pb_ret
    }

    static Node parseStatement() { //#ps_enter

        if (lexer.next.tipo == TipoToken.PRINT) { //#ps_print_chk
            lexer.selectNext(); //#ps_print_next
            if (lexer.next.tipo != TipoToken.OPEN_PAR) { //#ps_print_open_chk
                throw new RuntimeException("[Parser] Expected ("); //#ps_print_open_err
            }
            lexer.selectNext(); //#ps_print_open_next
            Node expressao = parseBoolExpression(); //#ps_print_expr
            if (lexer.next.tipo != TipoToken.CLOSE_PAR) { //#ps_print_close_chk
                throw new RuntimeException("[Parser] Expected )"); //#ps_print_close_err
            }
            lexer.selectNext(); //#ps_print_close_next
            Node printNode = new Print(expressao); //#ps_print_node

            if (lexer.next.tipo != TipoToken.END) { //#ps_print_end_chk
                throw new RuntimeException("[Parser] Expected end of line"); //#ps_print_end_err
            }
            lexer.selectNext(); //#ps_print_end_next
            return printNode; //#ps_print_ret

        } else if (lexer.next.tipo == TipoToken.IDEN) { //#ps_iden_chk
            String nome = lexer.next.nome; //#ps_iden_name
            Node idNode = new Identifier(nome); //#ps_iden_node
            lexer.selectNext(); //#ps_iden_next

            if (lexer.next.tipo != TipoToken.ASSIGN) { //#ps_assign_chk
                throw new RuntimeException("[Parser] Expected ="); //#ps_assign_err
            }
            lexer.selectNext(); //#ps_assign_next

            Node expressao = parseBoolExpression(); //#ps_asg_expr
            Node assignNode = new Assignment(idNode, expressao); //#ps_asg_node

            if (lexer.next.tipo != TipoToken.END) { //#ps_asg_end_chk
                throw new RuntimeException("[Parser] Expected end of line"); //#ps_asg_end_err
            }
            lexer.selectNext(); //#ps_asg_end_next
            return assignNode; //#ps_asg_ret

        } else if (lexer.next.tipo == TipoToken.IF) { //#ps_if_chk
            // R6: IF = "if", BOOL_EXPRESSION, BLOCK, [ "else", BLOCK ]
            lexer.selectNext(); //#ps_if_next
            Node condicao = parseBoolExpression(); //#ps_if_cond
            Node entao = parseBlock(); //#ps_if_then
            Node senao = null;
            if (lexer.next.tipo == TipoToken.ELSE) { //#ps_else_chk
                lexer.selectNext(); //#ps_else_next
                senao = parseBlock(); //#ps_else_block
            }
            Node ifNode = new If(condicao, entao, senao); //#ps_if_node

            if (lexer.next.tipo != TipoToken.END) { //#ps_if_end_chk
                throw new RuntimeException("[Parser] Expected end of line"); //#ps_if_end_err
            }
            lexer.selectNext(); //#ps_if_end_next
            return ifNode; //#ps_if_ret

        } else if (lexer.next.tipo == TipoToken.WHILE) { //#ps_while_chk
            // R6: FOR = "for", BOOL_EXPRESSION, BLOCK - o "while" do Go
            lexer.selectNext(); //#ps_while_next
            Node condicao = parseBoolExpression(); //#ps_while_cond
            Node corpo = parseBlock(); //#ps_while_body
            Node whileNode = new While(condicao, corpo); //#ps_while_node

            if (lexer.next.tipo != TipoToken.END) { //#ps_while_end_chk
                throw new RuntimeException("[Parser] Expected end of line"); //#ps_while_end_err
            }
            lexer.selectNext(); //#ps_while_end_next
            return whileNode; //#ps_while_ret

        } else if (lexer.next.tipo == TipoToken.END) { //#ps_empty_chk
            lexer.selectNext(); //#ps_empty_next
            return new NoOp(); //#ps_noop

        } else {
            throw new RuntimeException("[Parser] Unexpected token in statement: " + lexer.next.tipo); //#ps_err
        }
    }

    static Node parseProgram() { //#pp_enter
        Node bloco = new Block(); //#pp_block
        while (lexer.next.tipo != TipoToken.EOF) { //#pp_while
            Node statement = parseStatement(); //#pp_stmt
            bloco.children.add(statement); //#pp_add
        }
        return bloco; //#pp_ret
    }

    static Node run(String code) { //#run_enter
        lexer = new Lexer(code); //#run_lexer
        lexer.selectNext(); //#run_first
        Node raiz = parseProgram(); //#run_prog

        if (lexer.next.tipo != TipoToken.EOF) { //#run_eof_chk
            throw new RuntimeException("[Parser] Unexpected token " + lexer.next.tipo); //#run_err
        }
        return raiz; //#run_ret
    }
}
