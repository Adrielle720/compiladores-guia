/* ============================================================================
   MOTOR — reimplementação em JavaScript de cada versão do compilador Java.
   Cada função espelha o método Java de mesmo nome, na mesma ordem, e chama
   T.s("chave", "narração") no ponto em que a linha correspondente do Java
   executa. A chave aponta para a linha marcada em java/<versão>.java.
   Roda no navegador (window.Motor) e no Node (module.exports), para os testes
   compararem o resultado com o do Java de verdade.
   ========================================================================== */
(function (G) {
  "use strict";

  // ---------------------------------------------------------------- Java ---
  // Aritmética de int de 32 bits, igual à do Java (estoura e dá a volta).
  var I = {
    add: function (a, b) { return (a + b) | 0; },
    sub: function (a, b) { return (a - b) | 0; },
    mul: function (a, b) { return Math.imul(a, b); },
    div: function (a, b) { return (a / b) | 0; }, // trunca em direção ao zero
    neg: function (a) { return (-a) | 0; }
  };

  function isDigit(c) { return c >= "0" && c <= "9"; }
  var RE_LETTER = /\p{L}/u, RE_LETDIG = /[\p{L}\p{Nd}]/u, RE_ZS = /[\p{Zs}\u2028\u2029]/u;
  function isLetter(c) { return RE_LETTER.test(c); }
  function isLetterOrDigit(c) { return RE_LETDIG.test(c); }
  // Character.isWhitespace: separadores Unicode (menos os "não quebráveis")
  // e \t \n \u000B \f \r \u001C..\u001F
  function isWhitespace(c) {
    if (c === "\u00A0" || c === "\u2007" || c === "\u202F") return false;
    var n = c.charCodeAt(0);
    if ((n >= 9 && n <= 13) || (n >= 0x1c && n <= 0x1f)) return true;
    return RE_ZS.test(c);
  }
  // String.trim() do Java: tira tudo que for <= ' ' nas pontas
  function javaTrim(s) {
    var a = 0, b = s.length;
    while (a < b && s.charCodeAt(a) <= 32) a++;
    while (b > a && s.charCodeAt(b - 1) <= 32) b--;
    return s.substring(a, b);
  }
  // Integer.parseInt(s) para as cadeias que o Lexer monta
  function parseIntJava(s) {
    var ok = /^[+-]?[0-9]+$/.test(s);
    if (ok) {
      var n = Number(s);
      if (n >= -2147483648 && n <= 2147483647) return n;
    }
    throw new JavaError("java.lang.NumberFormatException", 'For input string: "' + s + '"' + (ok ? "" : ""), null, "Java");
  }

  function JavaError(cls, msg, k, origem) {
    this.cls = cls;          // classe Java da exceção
    this.msg = msg;          // mensagem, exatamente como o Java imprime
    this.k = k;              // chave da linha que lançou
    this.origem = origem;    // "Lexer" | "Parser" | "Semantic" | "Java"
  }
  JavaError.prototype.toString = function () { return "Exception in thread \"main\" " + this.cls + ": " + this.msg; };
  function LimiteErro(n) { this.n = n; }

  // Tira o prefixo [Lexer]/[Parser]/[Semantic] da mensagem
  function origemDe(msg) {
    var m = /^\[(Lexer|Parser|Semantic|Main)\]/.exec(msg);
    return m ? m[1] : "Java";
  }

  // --------------------------------------------------------------- Trace ---
  function Trace(o) {
    o = o || {};
    this.max = o.max || 60000;
    this.steps = [];
    this.tokens = [];      // {tipo, txt, v, a, b, s}
    this.nodes = [];       // {id, cls, value, kids:[{id,s}], a, b, s}
    this.frames = [];      // {fn, k, loc, no}
    this.st = null;        // tabela de símbolos (copiada a cada escrita)
    this.stAlt = null;     // nome da última variável escrita
    this.out = [];
    this.vals = [];        // {s, id, v}  valor devolvido por um evaluate()
    this.cur = -1;         // índice do token em lexer.next
    this.pos = 0;          // lexer.position
    this.lastEnd = 0;      // fim do último token consumido
    this.hl = null;        // trecho do fonte em destaque [a, b)
    this.fase = "main";
    this.map = null;       // posição no código limpo -> posição no arquivo
    this.lidos = 0;        // linhas de stdin já consumidas
  }
  Trace.prototype.conv = function (hl) {
    if (!hl || !this.map) return hl;
    var m = this.map, a = m[Math.min(hl[0], m.length - 1)];
    var b = hl[1] > hl[0] ? m[Math.min(hl[1] - 1, m.length - 1)] + 1 : a;
    return [a, b];
  };
  Trace.prototype.s = function (k, narr, x) {
    x = x || {};
    if (this.steps.length >= this.max) throw new LimiteErro(this.max);
    var top = this.frames[this.frames.length - 1];
    if (top) top.k = k;
    var fr = new Array(this.frames.length);
    for (var i = 0; i < this.frames.length; i++) {
      var f = this.frames[i];
      fr[i] = { fn: f.fn, k: f.k, loc: f.loc ? Object.assign({}, f.loc) : null, no: f.no };
    }
    this.steps.push({
      k: k, narr: narr, fase: x.fase || this.fase,
      hl: this.conv(x.hl !== undefined ? x.hl : this.hl),
      pos: this.pos, cur: this.cur, nt: this.tokens.length,
      fr: fr, st: this.st, stAlt: x.stAlt || null, nout: this.out.length,
      node: x.node != null ? x.node : null, erro: x.erro || null, lidos: this.lidos
    });
  };
  Trace.prototype.enter = function (fn, loc, no) {
    var f = { fn: fn, k: null, loc: loc || null, no: no != null ? no : null };
    this.frames.push(f);
    return f;
  };
  Trace.prototype.leave = function () { this.frames.pop(); };
  Trace.prototype.loc = function (nome, v) {
    var f = this.frames[this.frames.length - 1];
    if (!f.loc) f.loc = {};
    f.loc[nome] = v;
  };
  Trace.prototype.tok = function (tipo, txt, v, a, b) {
    this.tokens.push({ tipo: tipo, txt: txt, v: v, a: a, b: b, s: this.steps.length, ca: this.conv([a, b]) });
    this.cur = this.tokens.length - 1;
    return this.tokens[this.cur];
  };
  Trace.prototype.node = function (cls, value, kids, a, b) {
    var n = { id: this.nodes.length, cls: cls, value: value, kids: [], a: a, b: b, s: this.steps.length, ca: this.conv([a, b]) };
    for (var i = 0; i < kids.length; i++) if (kids[i]) n.kids.push({ id: kids[i].id, s: this.steps.length });
    this.nodes.push(n);
    return n;
  };
  Trace.prototype.link = function (pai, filho) { pai.kids.push({ id: filho.id, s: this.steps.length }); };
  Trace.prototype.val = function (node, v) { this.vals.push({ s: this.steps.length, id: node.id, v: v }); };
  Trace.prototype.stSet = function (nome, v) {
    var novo = Object.assign({}, this.st || {});
    novo[nome] = v;
    this.st = novo;
  };
  // registra o passo de erro e lança
  Trace.prototype.erro = function (k, cls, msg, narr) {
    var origem = origemDe(msg);
    if (cls !== "java.lang.RuntimeException" && origem === "Java") origem = "Java";
    this.s(k, narr, { fase: "erro", erro: { cls: cls, msg: msg, origem: origem } });
    throw new JavaError(cls, msg, k, origem);
  };

  function mostra(c) {
    if (c === "\n") return "\\n";
    if (c === "\t") return "\\t";
    if (c === "\r") return "\\r";
    if (c === " ") return "espaço";
    return c;
  }

  // ======================================================================
  //  v0.0 — Roteiro 1: uma função só, lendo caractere por caractere
  // ======================================================================
  function runV00(T, entrada) {
    T.enter("Main.main");
    T.s("main_enter", "O programa começa pelo main(). O texto digitado no terminal chega em args[0].", { hl: null });
    T.s("main_args", "Confere se veio algum argumento. Veio: \"" + entrada + "\".");
    T.s("main_call", "Chama avaliar(args[0]). Nesta versão não existe Lexer nem Parser: uma função faz tudo.");
    var r = avaliar(T, entrada);
    T.out.push(String(r));
    T.s("main_print", "System.out.println(" + r + "): imprime o resultado e o programa termina.", { hl: null });
    T.leave();
  }
  function avaliar(T, entrada) {
    T.fase = "lexer";
    T.enter("Main.avaliar", { posicao: 0, resultado: 0 });
    var posicao = 0, resultado = 0, tamanho = entrada.length, numero, ini;
    function upd() { T.loc("posicao", posicao); T.loc("resultado", resultado); T.pos = posicao; }
    T.s("av_enter", "Entra em avaliar(). posicao = 0 aponta para o primeiro caractere; resultado começa em 0.", { hl: [0, Math.min(1, tamanho)] });
    ini = posicao;
    while (posicao < tamanho && entrada[posicao] === " ") posicao++;
    upd();
    if (posicao > ini) T.s("av_ws1", "Pula " + (posicao - ini) + " espaço(s) do começo.", { hl: [ini, posicao] });
    if (posicao >= tamanho || !isDigit(entrada[posicao])) {
      T.erro("av_err1", "java.lang.IllegalArgumentException", "Sintaxe inválida: esperado número no início.",
        posicao >= tamanho ? "A entrada acabou sem nenhum número: não há o que calcular." :
          "O primeiro caractere útil é '" + mostra(entrada[posicao]) + "', que não é dígito. A conta tem que começar com um número.");
    }
    T.s("av_chk1", "O caractere '" + entrada[posicao] + "' é dígito: dá para começar a ler o primeiro número.", { hl: [posicao, posicao + 1] });
    numero = 0; ini = posicao;
    while (posicao < tamanho && isDigit(entrada[posicao])) {
      var d = entrada.charCodeAt(posicao) - 48;
      numero = I.add(I.mul(numero, 10), d);
      posicao++;
      T.loc("numero", numero); upd();
      T.s("av_num1_acc", "Lê o dígito '" + entrada[posicao - 1] + "': numero = numero × 10 + " + d + " = " + numero + ".", { hl: [ini, posicao] });
    }
    resultado = numero; upd();
    T.s("av_res", "O primeiro número (" + numero + ") vira o resultado inicial.", { hl: [ini, posicao] });
    for (;;) {
      if (!(posicao < tamanho)) break;
      T.s("av_while", "Ainda há caracteres depois da posição " + posicao + ": volta do laço principal.", { hl: [posicao, posicao + 1] });
      ini = posicao;
      while (posicao < tamanho && entrada[posicao] === " ") posicao++;
      upd();
      if (posicao > ini) T.s("av_ws2", "Pula " + (posicao - ini) + " espaço(s) antes do operador.", { hl: [ini, posicao] });
      if (posicao >= tamanho) {
        T.s("av_break", "Só havia espaços até o fim: sai do laço.", { hl: null });
        break;
      }
      var operador = entrada[posicao];
      T.loc("operador", operador);
      T.s("av_op", "Guarda o caractere atual como operador: '" + mostra(operador) + "'.", { hl: [posicao, posicao + 1] });
      if (operador !== "+" && operador !== "-") {
        T.erro("av_op_err", "java.lang.IllegalArgumentException", "Sintaxe inválida: operador incorreto.",
          "'" + mostra(operador) + "' não é + nem -. Nesta versão só existem esses dois operadores.");
      }
      posicao++; upd();
      T.s("av_op_adv", "Operador válido. Avança uma posição.", { hl: [posicao - 1, posicao] });
      ini = posicao;
      while (posicao < tamanho && entrada[posicao] === " ") posicao++;
      upd();
      if (posicao > ini) T.s("av_ws3", "Pula " + (posicao - ini) + " espaço(s) depois do operador.", { hl: [ini, posicao] });
      if (posicao >= tamanho || !isDigit(entrada[posicao])) {
        T.erro("av_err2", "java.lang.IllegalArgumentException", "Sintaxe inválida: esperado número após operador.",
          posicao >= tamanho ? "A entrada acabou logo depois do operador: faltou o segundo número." :
            "Depois do operador veio '" + mostra(entrada[posicao]) + "', mas era preciso um dígito.");
      }
      numero = 0; ini = posicao;
      while (posicao < tamanho && isDigit(entrada[posicao])) {
        var d2 = entrada.charCodeAt(posicao) - 48;
        numero = I.add(I.mul(numero, 10), d2);
        posicao++;
        T.loc("numero", numero); upd();
        T.s("av_num2_acc", "Lê o dígito '" + entrada[posicao - 1] + "': numero = " + numero + ".", { hl: [ini, posicao] });
      }
      if (operador === "+") {
        resultado = I.add(resultado, numero); upd();
        T.s("av_plus", "Aplica a soma: resultado += " + numero + " → " + resultado + ".", { hl: [ini, posicao] });
      } else {
        resultado = I.sub(resultado, numero); upd();
        T.s("av_minus", "Aplica a subtração: resultado -= " + numero + " → " + resultado + ".", { hl: [ini, posicao] });
      }
    }
    T.s("av_ret", "Fim da entrada. avaliar() devolve " + resultado + ".", { hl: null });
    T.leave();
    T.fase = "main";
    return resultado;
  }

  // ======================================================================
  //  v1.x — Roteiros 2, 3 e 4: Lexer + Parser, entrada pela linha de comando
  // ======================================================================
  function LexerV1(T, source, ver) {
    this.T = T; this.source = source; this.position = 0; this.next = null; this.ver = ver;
  }
  LexerV1.prototype.selectNext = function () {
    var T = this.T, s = this.source, fase = T.fase;
    if (this.next) T.lastEnd = this.next.b;
    T.enter("Lexer.selectNext");
    T.fase = "lexer";
    var ini = this.position;
    while (this.position < s.length && s[this.position] === " ") this.position++;
    T.pos = this.position;
    if (this.position > ini) T.s("lex_ws", "Pula " + (this.position - ini) + " espaço(s). Nesta versão só o caractere ' ' conta como espaço.", { hl: [ini, this.position] });
    var p = this.position, c = s[p], t;
    if (p >= s.length) {
      this.next = t = mkTok1(T, "EOF", "", p, p);
      T.s("lex_eof", "Chegou ao fim do texto: next = Token(\"EOF\", \"\"). Não há mais nada para ler.", { hl: [p, p] });
    } else if (c === "+") { this.simbolo("PLUS", c, "lex_plus"); }
    else if (c === "-") { this.simbolo("MINUS", c, "lex_minus"); }
    else if (this.ver !== "1.0" && c === "*") { this.simbolo("MULT", c, "lex_mult"); }
    else if (this.ver !== "1.0" && c === "/") { this.simbolo("DIV", c, "lex_div"); }
    else if (this.ver !== "1.0" && c === "(") { this.simbolo("OPEN_PAR", c, "lex_open"); }
    else if (this.ver !== "1.0" && c === ")") { this.simbolo("CLOSE_PAR", c, "lex_close"); }
    else if (isDigit(c)) {
      var acc = "";
      while (this.position < s.length && isDigit(s[this.position])) { acc += s[this.position]; this.position++; }
      T.pos = this.position;
      T.s("lex_num_loop", "É dígito: continua lendo enquanto vier dígito. Juntou \"" + acc + "\".", { hl: [p, this.position] });
      var v;
      try { v = parseIntJava(acc); } catch (e) {
        T.erro("lex_num", e.cls, e.msg, "\"" + acc + "\" não cabe num int de Java (máximo 2147483647). Integer.parseInt lança NumberFormatException.");
      }
      this.next = t = mkTok1(T, "INT", acc, p, this.position, v);
      T.s("lex_num", "Converte \"" + acc + "\" em número: next = Token(\"INT\", " + v + ").", { hl: [p, this.position] });
    } else {
      T.erro("lex_err", "java.lang.RuntimeException", "[Lexer] Invalid Symbol " + c,
        "'" + mostra(c) + "' não é espaço, operador nem dígito. O Lexer não sabe que token é esse: erro léxico.");
    }
    T.leave();
    T.fase = fase;
    return t;
  };
  LexerV1.prototype.simbolo = function (tipo, c, k) {
    var T = this.T, p = this.position;
    this.next = mkTok1(T, tipo, c, p, p + 1, c);
    this.position++;
    T.pos = this.position;
    T.s(k, "Achou '" + c + "': next = Token(\"" + tipo + "\", \"" + c + "\") e position avança para " + this.position + ".", { hl: [p, p + 1] });
  };
  function mkTok1(T, tipo, txt, a, b, v) {
    var t = T.tok(tipo, txt, v, a, b);
    return { type: tipo, value: v, a: a, b: b, idx: T.cur };
  }
  function nomeTok1(t) { return t.type === "INT" ? "INT(" + t.value + ")" : t.type; }

  function runV1(T, src, ver) {
    T.enter("Main.main");
    T.s("main_src", "codigoFonte = args[0] = \"" + src + "\". O texto chega inteiro, numa String só.", { hl: [0, src.length] });
    var lexer = null;

    function next() { return lexer.next; }
    function consome(k, narr) { T.s(k, narr, { hl: [next().a, next().b] }); lexer.selectNext(); }
    function perr(k, esperado) {
      T.erro(k, "java.lang.RuntimeException", "[Parser] Unexpected token " + next().type + ", expected " + esperado,
        "O Parser esperava " + esperado + " aqui, mas o token atual é " + nomeTok1(next()) + ". Erro sintático.");
    }

    // ---- v1.0: parseExpression faz tudo
    function parseExpression10() {
      T.enter("Parser.parseExpression", { resultado: null });
      T.fase = "parser";
      T.s("pe_enter", "Entra em parseExpression(). Segue o diagrama: INT, depois (+|- INT) quantas vezes vier.", { hl: [next().a, next().b] });
      if (next().type !== "INT") perr("pe_int_err", "INT");
      var resultado = next().value;
      T.loc("resultado", resultado);
      T.s("pe_res", "O token atual é " + nomeTok1(next()) + ": resultado = " + resultado + ".", { hl: [next().a, next().b] });
      consome("pe_next1", "Já usou o número: pede o próximo token ao Lexer.");
      while (next().type === "PLUS" || next().type === "MINUS") {
        var operador = next().type;
        T.loc("operador", operador);
        T.s("pe_op", "Veio " + operador + ": guarda o operador antes de avançar.", { hl: [next().a, next().b] });
        consome("pe_op_next", "Pede o próximo token: tem que ser um número.");
        if (next().type !== "INT") perr("pe_int2_err", "INT");
        if (operador === "PLUS") {
          resultado = I.add(resultado, next().value); T.loc("resultado", resultado);
          T.s("pe_add", "Soma: resultado += " + next().value + " → " + resultado + ".", { hl: [next().a, next().b] });
        } else {
          resultado = I.sub(resultado, next().value); T.loc("resultado", resultado);
          T.s("pe_sub", "Subtrai: resultado -= " + next().value + " → " + resultado + ".", { hl: [next().a, next().b] });
        }
        consome("pe_next2", "Consome o número e pede o próximo token.");
      }
      T.s("pe_ret", "O token atual (" + nomeTok1(next()) + ") não é + nem -: sai do laço e devolve " + resultado + ".", { hl: [next().a, next().b] });
      T.leave();
      return resultado;
    }

    // ---- v1.1: EXPRESSION / TERM / FACTOR calculando direto
    function parseFactor11() {
      T.enter("Parser.parseFactor");
      T.fase = "parser";
      var t = next();
      T.s("pf_enter", "Entra em parseFactor() com o token " + nomeTok1(t) + ".", { hl: [t.a, t.b] });
      var r;
      if (t.type === "PLUS") {
        T.s("pf_plus_chk", "É um + unário: o FACTOR é '+' seguido de outro FACTOR.", { hl: [t.a, t.b] });
        consome("pf_plus_next", "Consome o '+'.");
        r = parseFactor11();
        T.s("pf_plus_ret", "Volta da recursão com " + r + ". O + unário não muda o valor: devolve " + r + ".", { hl: null });
        T.leave(); return r;
      }
      if (t.type === "MINUS") {
        T.s("pf_minus_chk", "É um - unário: o FACTOR é '-' seguido de outro FACTOR.", { hl: [t.a, t.b] });
        consome("pf_minus_next", "Consome o '-'.");
        r = parseFactor11();
        var neg = I.neg(r);
        T.s("pf_minus_ret", "Volta da recursão com " + r + " e troca o sinal: devolve " + neg + ".", { hl: null });
        T.leave(); return neg;
      }
      if (t.type === "OPEN_PAR") {
        T.s("pf_par_chk", "É um '(': dentro vem uma EXPRESSION inteira.", { hl: [t.a, t.b] });
        consome("pf_par_next", "Consome o '('.");
        T.s("pf_par_call", "Chama parseExpression() de novo, recursivamente, para o que está entre parênteses.", { hl: [next().a, next().b] });
        r = parseExpression11();
        T.loc("resultado", r);
        if (next().type !== "CLOSE_PAR") perr("pf_par_err", "CLOSE_PAR");
        consome("pf_par_close_next", "Achou o ')'. Consome e fecha o parêntese.");
        T.s("pf_par_ret", "Devolve " + r + ": o valor de dentro dos parênteses.", { hl: null });
        T.leave(); return r;
      }
      if (t.type === "INT") {
        r = t.value;
        T.loc("resultado", r);
        T.s("pf_int", "É um número: resultado = " + r + ".", { hl: [t.a, t.b] });
        consome("pf_int_next", "Consome o número.");
        T.s("pf_int_ret", "Devolve " + r + ".", { hl: null });
        T.leave(); return r;
      }
      T.erro("pf_err", "java.lang.RuntimeException", "[Parser] Unexpected token " + t.type + ", expected INT, PLUS, MINUS or OPEN_PAR",
        "Um FACTOR tem que começar com número, +, - ou '('. Veio " + nomeTok1(t) + ".");
    }
    function parseTerm11() {
      T.enter("Parser.parseTerm", { resultado: null });
      T.fase = "parser";
      T.s("pt_enter", "Entra em parseTerm(): um FACTOR, depois (* ou / FACTOR) quantas vezes vier.", { hl: [next().a, next().b] });
      T.s("pt_first", "Chama parseFactor() para o primeiro operando.", { hl: [next().a, next().b] });
      var resultado = parseFactor11();
      T.loc("resultado", resultado);
      while (next().type === "MULT" || next().type === "DIV") {
        var op = next().type;
        T.loc("operador", op);
        T.s("pt_op", "Veio " + op + ": guarda o operador.", { hl: [next().a, next().b] });
        consome("pt_op_next", "Consome o operador. O próximo token deve começar um FACTOR.");
        var d;
        if (op === "MULT") {
          T.s("pt_mult", "resultado *= parseFactor(): chama parseFactor() para o operando da direita.", { hl: [next().a, next().b] });
          d = parseFactor11();
          resultado = I.mul(resultado, d);
          T.loc("resultado", resultado);
          T.s("pt_mult", "Multiplica: resultado = " + resultado + ".", { hl: null });
        } else {
          T.s("pt_div", "resultado /= parseFactor(): chama parseFactor() para o divisor.", { hl: [next().a, next().b] });
          d = parseFactor11();
          if (d === 0) T.erro("pt_div", "java.lang.ArithmeticException", "/ by zero",
            "O divisor deu 0. Nesta versão ninguém confere isso antes: a própria JVM lança ArithmeticException.");
          resultado = I.div(resultado, d);
          T.loc("resultado", resultado);
          T.s("pt_div", "Divisão inteira: resultado = " + resultado + ".", { hl: null });
        }
      }
      T.s("pt_ret", "Não veio * nem /: devolve " + resultado + ".", { hl: null });
      T.leave();
      return resultado;
    }
    function parseExpression11() {
      T.enter("Parser.parseExpression", { resultado: null });
      T.fase = "parser";
      T.s("pe_enter", "Entra em parseExpression(): um TERM, depois (+ ou - TERM) quantas vezes vier.", { hl: [next().a, next().b] });
      T.s("pe_first", "Chama parseTerm() para o primeiro operando.", { hl: [next().a, next().b] });
      var resultado = parseTerm11();
      T.loc("resultado", resultado);
      while (next().type === "PLUS" || next().type === "MINUS") {
        var op = next().type;
        T.loc("operador", op);
        T.s("pe_op", "Veio " + op + ": guarda o operador.", { hl: [next().a, next().b] });
        consome("pe_op_next", "Consome o operador. O próximo pedaço é um TERM.");
        var d;
        if (op === "PLUS") {
          T.s("pe_add", "resultado += parseTerm(): chama parseTerm() para o operando da direita.", { hl: [next().a, next().b] });
          d = parseTerm11();
          resultado = I.add(resultado, d); T.loc("resultado", resultado);
          T.s("pe_add", "Soma: resultado = " + resultado + ".", { hl: null });
        } else {
          T.s("pe_sub", "resultado -= parseTerm(): chama parseTerm() para o operando da direita.", { hl: [next().a, next().b] });
          d = parseTerm11();
          resultado = I.sub(resultado, d); T.loc("resultado", resultado);
          T.s("pe_sub", "Subtrai: resultado = " + resultado + ".", { hl: null });
        }
      }
      T.s("pe_ret", "Não veio + nem -: devolve " + resultado + ".", { hl: null });
      T.leave();
      return resultado;
    }

    // ---- v1.2: mesmas funções, mas montando nós da AST
    function parseFactor12() {
      T.enter("Parser.parseFactor");
      T.fase = "parser";
      var t = next(), a0 = t.a, no;
      T.s("pf_enter", "Entra em parseFactor() com o token " + nomeTok1(t) + ".", { hl: [t.a, t.b] });
      if (t.type === "PLUS" || t.type === "MINUS") {
        var op = t.type;
        T.loc("operador", op);
        T.s("pf_un_op", "É um " + (op === "PLUS" ? "+" : "-") + " unário: guarda \"" + op + "\".", { hl: [t.a, t.b] });
        consome("pf_un_next", "Consome o sinal.");
        T.s("pf_un_call", "Chama parseFactor() de novo para montar o operando.", { hl: [next().a, next().b] });
        var filho = parseFactor12();
        no = T.node("UnOp", op, [filho], a0, T.lastEnd);
        T.s("pf_un_ret", "Cria UnOp(\"" + op + "\") com 1 filho e devolve o nó.", { node: no.id, hl: [a0, T.lastEnd] });
        T.leave(); return no;
      }
      if (t.type === "OPEN_PAR") {
        T.s("pf_par_chk", "É um '(': dentro vem uma EXPRESSION.", { hl: [t.a, t.b] });
        consome("pf_par_next", "Consome o '('.");
        T.s("pf_par_call", "Chama parseExpression() para montar a subárvore de dentro.", { hl: [next().a, next().b] });
        no = parseExpression12();
        if (next().type !== "CLOSE_PAR") perr("pf_par_err", "CLOSE_PAR");
        consome("pf_par_close_next", "Achou o ')'. Consome.");
        T.s("pf_par_ret", "Devolve o nó de dentro. Os parênteses não viram nó: a forma da árvore já guarda a ordem.", { node: no.id, hl: null });
        T.leave(); return no;
      }
      if (t.type === "INT") {
        no = T.node("IntVal", t.value, [], t.a, t.b);
        T.s("pf_int", "É um número: cria IntVal(" + t.value + "), uma folha.", { node: no.id, hl: [t.a, t.b] });
        consome("pf_int_next", "Consome o número.");
        T.s("pf_int_ret", "Devolve o nó IntVal(" + t.value + ").", { node: no.id, hl: null });
        T.leave(); return no;
      }
      T.erro("pf_err", "java.lang.RuntimeException", "[Parser] Unexpected token " + t.type + ", expected INT, PLUS, MINUS or OPEN_PAR",
        "Um FACTOR tem que começar com número, +, - ou '('. Veio " + nomeTok1(t) + ".");
    }
    function parseTerm12() {
      T.enter("Parser.parseTerm");
      T.fase = "parser";
      var a0 = next().a;
      T.s("pt_enter", "Entra em parseTerm().", { hl: [next().a, next().b] });
      T.s("pt_first", "Chama parseFactor() para o primeiro operando.", { hl: [next().a, next().b] });
      var no = parseFactor12();
      while (next().type === "MULT" || next().type === "DIV") {
        var op = next().type;
        T.loc("operador", op);
        T.s("pt_op", "Veio " + op + ": o nó que já temos vai virar o filho da esquerda.", { hl: [next().a, next().b] });
        consome("pt_op_next", "Consome o operador.");
        T.s("pt_right", "Chama parseFactor() para montar o filho da direita.", { hl: [next().a, next().b] });
        var dir = parseFactor12();
        no = T.node("BinOp", op, [no, dir], a0, T.lastEnd);
        T.s("pt_binop", "Cria BinOp(\"" + op + "\") com os dois filhos. Ele passa a ser o nó atual.", { node: no.id, hl: [a0, T.lastEnd] });
      }
      T.s("pt_ret", "Não veio * nem /: devolve o nó.", { node: no.id, hl: null });
      T.leave();
      return no;
    }
    function parseExpression12() {
      T.enter("Parser.parseExpression");
      T.fase = "parser";
      var a0 = next().a;
      T.s("pe_enter", "Entra em parseExpression().", { hl: [next().a, next().b] });
      T.s("pe_first", "Chama parseTerm() para o primeiro operando.", { hl: [next().a, next().b] });
      var no = parseTerm12();
      while (next().type === "PLUS" || next().type === "MINUS") {
        var op = next().type;
        T.loc("operador", op);
        T.s("pe_op", "Veio " + op + ": o nó atual vai virar o filho da esquerda.", { hl: [next().a, next().b] });
        consome("pe_op_next", "Consome o operador.");
        T.s("pe_right", "Chama parseTerm() para montar o filho da direita.", { hl: [next().a, next().b] });
        var dir = parseTerm12();
        no = T.node("BinOp", op, [no, dir], a0, T.lastEnd);
        T.s("pe_binop", "Cria BinOp(\"" + op + "\"). Encadeando assim, 1-2-3 vira (1-2)-3: associativo à esquerda.", { node: no.id, hl: [a0, T.lastEnd] });
      }
      T.s("pe_ret", "Não veio + nem -: devolve o nó.", { node: no.id, hl: null });
      T.leave();
      return no;
    }
    function eval12(n) {
      T.enter(n.cls + ".evaluate", null, n.id);
      T.fase = "eval";
      var r, e, d;
      if (n.cls === "IntVal") {
        r = n.value;
        T.val(n, r);
        T.s("ev_int", "IntVal só devolve o número que guarda: " + r + ".", { node: n.id, hl: [n.a, n.b] });
      } else if (n.cls === "UnOp") {
        T.s("ev_un_child", "UnOp pede ao único filho que se avalie primeiro.", { node: n.id, hl: [n.a, n.b] });
        var x = eval12(T.nodes[n.kids[0].id]);
        T.loc("operando", x);
        if (n.value === "PLUS") { r = x; T.val(n, r); T.s("ev_un_pos", "Operador PLUS: devolve +" + x + " = " + r + ".", { node: n.id, hl: [n.a, n.b] }); }
        else { r = I.neg(x); T.val(n, r); T.s("ev_un_neg", "Operador MINUS: devolve -(" + x + ") = " + r + ".", { node: n.id, hl: [n.a, n.b] }); }
      } else {
        T.s("ev_bin_l", "BinOp(\"" + n.value + "\") avalia primeiro o filho da esquerda.", { node: n.id, hl: [n.a, n.b] });
        e = eval12(T.nodes[n.kids[0].id]);
        T.loc("esquerda", e);
        T.s("ev_bin_r", "Esquerda = " + e + ". Agora avalia o filho da direita.", { node: n.id, hl: [n.a, n.b] });
        d = eval12(T.nodes[n.kids[1].id]);
        T.loc("direita", d);
        if (n.value === "PLUS") { r = I.add(e, d); T.val(n, r); T.s("ev_bin_plus", e + " + " + d + " = " + r + ".", { node: n.id, hl: [n.a, n.b] }); }
        else if (n.value === "MINUS") { r = I.sub(e, d); T.val(n, r); T.s("ev_bin_minus", e + " - " + d + " = " + r + ".", { node: n.id, hl: [n.a, n.b] }); }
        else if (n.value === "MULT") { r = I.mul(e, d); T.val(n, r); T.s("ev_bin_mult", e + " × " + d + " = " + r + ".", { node: n.id, hl: [n.a, n.b] }); }
        else {
          if (d === 0) T.erro("ev_bin_div_err", "java.lang.RuntimeException", "[Semantic] Division by zero",
            "O divisor avaliou para 0. Não é erro de escrita, é o valor que não faz sentido: erro semântico.");
          r = I.div(e, d); T.val(n, r);
          T.s("ev_bin_div", e + " / " + d + " = " + r + " (divisão inteira).", { node: n.id, hl: [n.a, n.b] });
        }
      }
      T.leave();
      return r;
    }

    function run() {
      T.enter("Parser.run");
      T.fase = "parser";
      lexer = new LexerV1(T, src, ver);
      T.s("run_lexer", "Cria um Lexer em cima do texto. position = 0, next = null.", { hl: [0, 0] });
      T.s("run_first", "Pede o primeiro token, para o Parser já ter algo para olhar.", { hl: [0, 0] });
      lexer.selectNext();
      var r;
      if (ver === "1.0") { T.s("run_expr", "Chama parseExpression(): ela lê e calcula ao mesmo tempo.", { hl: [next().a, next().b] }); r = parseExpression10(); }
      else if (ver === "1.1") { T.s("run_expr", "Chama parseExpression(), o diagrama de fora (menor precedência).", { hl: [next().a, next().b] }); r = parseExpression11(); }
      else { T.s("run_expr", "Chama parseExpression(), que agora devolve a raiz de uma árvore.", { hl: [next().a, next().b] }); r = parseExpression12(); }
      T.fase = "parser";
      if (next().type !== "EOF") perr("run_err", "EOF");
      T.s("run_ret", "O que sobrou é EOF: a entrada inteira foi usada. " + (ver === "1.2" ? "Devolve a raiz da AST." : "Devolve " + r + "."), { hl: null, node: ver === "1.2" ? r.id : null });
      T.leave();
      return r;
    }

    T.s("main_run", "Chama Parser.run(codigoFonte).", { hl: [0, src.length] });
    var res = run();
    T.fase = "main";
    if (ver === "1.2") {
      T.s("main_eval", "A árvore está pronta. Só agora a conta acontece: raiz.evaluate().", { node: res.id, hl: null });
      res = eval12(res);
      T.fase = "main";
    }
    T.out.push(String(res));
    T.s("main_print", "System.out.println(" + res + ").", { hl: null });
    T.leave();
  }

  // ======================================================================
  //  v2.0 / v2.1 — Roteiros 5 e 6: arquivo, statements, variáveis, if/for
  // ======================================================================
  var R6_KW = { "if": "IF", "for": "WHILE", "else": "ELSE", "Scanln": "READ" };

  function LexerV2(T, source, r6) {
    this.T = T; this.source = source; this.position = 0; this.next = null; this.r6 = r6;
  }
  LexerV2.prototype.selectNext = function () {
    var T = this.T, s = this.source, fase = T.fase;
    if (this.next) T.lastEnd = this.next.b;
    T.enter("Lexer.selectNext");
    T.fase = "lexer";
    var ini = this.position;
    while (this.position < s.length && isWhitespace(s[this.position]) && s[this.position] !== "\n") this.position++;
    T.pos = this.position;
    if (this.position > ini) T.s("lex_ws", "Pula " + (this.position - ini) + " caractere(s) em branco. O '\\n' NÃO é pulado: ele vira token.", { hl: [ini, this.position] });
    var p = this.position, c = s[p], r6 = this.r6;
    if (p >= s.length) {
      this.tk("EOF", "", p, p, "lex_eof", "Fim do código: next = EOF.");
    } else if (c === "\n") {
      this.tk("END", "\\n", p, p + 1, "lex_end", "Quebra de linha: vira o token END, que fecha um statement.");
    } else if (c === "+") { this.tk("PLUS", c, p, p + 1, "lex_plus"); }
    else if (c === "-") { this.tk("MINUS", c, p, p + 1, "lex_minus"); }
    else if (c === "*") { this.tk("MULT", c, p, p + 1, "lex_mult"); }
    else if (c === "/") { this.tk("DIV", c, p, p + 1, "lex_div"); }
    else if (c === "(") { this.tk("OPEN_PAR", c, p, p + 1, "lex_open"); }
    else if (c === ")") { this.tk("CLOSE_PAR", c, p, p + 1, "lex_close"); }
    else if (c === "=") {
      if (r6 && p + 1 < s.length && s[p + 1] === "=") {
        this.tk("EQ", "==", p, p + 2, "lex_eq", "Achou '=' e olhou UM caractere à frente: outro '='. Então é '==' (EQ), um token só.");
      } else {
        this.tk("ASSIGN", c, p, p + 1, "lex_assign", r6 ? "Achou '=' e o próximo caractere não é '=': é atribuição (ASSIGN)." : null);
      }
    }
    else if (r6 && c === "&") {
      if (p + 1 < s.length && s[p + 1] === "&") this.tk("AND", "&&", p, p + 2, "lex_and", "Achou '&&': token AND.");
      else T.erro("lex_and_err", "java.lang.RuntimeException", "[Lexer] Invalid Symbol &", "Um '&' sozinho não existe na linguagem. Só '&&'.");
    }
    else if (r6 && c === "|") {
      if (p + 1 < s.length && s[p + 1] === "|") this.tk("OR", "||", p, p + 2, "lex_or", "Achou '||': token OR.");
      else T.erro("lex_or_err", "java.lang.RuntimeException", "[Lexer] Invalid Symbol |", "Um '|' sozinho não existe na linguagem. Só '||'.");
    }
    else if (r6 && c === "!") { this.tk("NOT", c, p, p + 1, "lex_not"); }
    else if (r6 && c === ">") { this.tk("GT", c, p, p + 1, "lex_gt"); }
    else if (r6 && c === "<") { this.tk("LT", c, p, p + 1, "lex_lt"); }
    else if (r6 && c === "{") { this.tk("OPEN_BRA", c, p, p + 1, "lex_obra"); }
    else if (r6 && c === "}") { this.tk("CLOSE_BRA", c, p, p + 1, "lex_cbra"); }
    else if (isDigit(c)) {
      var acc = "";
      while (this.position < s.length && isDigit(s[this.position])) { acc += s[this.position]; this.position++; }
      T.pos = this.position;
      T.s("lex_num_loop", "É dígito: acumula enquanto vier dígito. acumulado = \"" + acc + "\".", { hl: [p, this.position] });
      var v;
      try { v = parseIntJava(acc); } catch (e) {
        T.erro("lex_num", e.cls, e.msg, "\"" + acc + "\" não cabe num int de Java (máximo 2147483647). Integer.parseInt lança NumberFormatException.");
      }
      this.position = p; // tk() avança de novo
      this.tk("NUMERO", acc, p, p + acc.length, "lex_num", "Converte \"" + acc + "\" com Integer.parseInt: token NUMERO(" + v + ").", v);
    }
    else if (isLetter(c)) {
      var w = "";
      while (this.position < s.length && (isLetterOrDigit(s[this.position]) || s[this.position] === "_")) { w += s[this.position]; this.position++; }
      T.pos = this.position;
      T.s("lex_word_loop", "É letra: acumula letras, dígitos e '_'. acumulado = \"" + w + "\".", { hl: [p, this.position] });
      this.position = p;
      if (w === "Println") {
        T.s("lex_kw_chk", "Confere se \"" + w + "\" é palavra reservada. É: Println.", { hl: [p, p + w.length] });
        this.tk("PRINT", w, p, p + w.length, "lex_print", "Palavra reservada: token PRINT (não é uma variável).");
      } else if (r6 && R6_KW.hasOwnProperty(w)) {
        T.s("lex_kw_chk", "Confere se \"" + w + "\" é palavra reservada. É: " + w + ".", { hl: [p, p + w.length] });
        var tp = R6_KW[w];
        this.tk(tp, w, p, p + w.length, { IF: "lex_if", WHILE: "lex_while", ELSE: "lex_else", READ: "lex_read" }[tp],
          tp === "WHILE" ? "\"for\" vira o token WHILE: em Go o for faz o papel do while." : "Palavra reservada: token " + tp + ".");
      } else {
        T.s("lex_kw_chk", "Confere se \"" + w + "\" é palavra reservada. Não é.", { hl: [p, p + w.length] });
        this.tk("IDEN", w, p, p + w.length, "lex_iden", "Não é reservada: é um identificador, token IDEN(" + w + ").", w);
      }
    } else {
      T.erro("lex_err", "java.lang.RuntimeException", "[Lexer] Invalid Symbol " + c,
        "'" + mostra(c) + "' não começa nenhum token da linguagem" + (c === "_" ? " (identificador não pode começar com '_')" : "") + ". Erro léxico.");
    }
    T.leave();
    T.fase = fase;
  };
  LexerV2.prototype.tk = function (tipo, txt, a, b, k, narr, v) {
    var T = this.T;
    var t = T.tok(tipo, txt, v, a, b);
    this.next = { tipo: tipo, valor: tipo === "NUMERO" ? v : 0, nome: tipo === "IDEN" ? v : null, a: a, b: b, idx: T.cur };
    this.position = b;
    T.pos = b;
    T.s(k, narr || ("Achou '" + txt + "': next = " + tipo + "."), { hl: [a, b] });
    return t;
  };
  function nomeTok2(t) {
    if (t.tipo === "NUMERO") return "NUMERO(" + t.valor + ")";
    if (t.tipo === "IDEN") return "IDEN(" + t.nome + ")";
    return t.tipo;
  }

  // PrePro.filter com mapa de posições (código limpo -> arquivo original)
  function prePro(conteudo) {
    var re = /\/\/[^\n\r\u0085\u2028\u2029]*/g, limpo = "", map = [], ultimo = 0, m, n = 0;
    while ((m = re.exec(conteudo))) {
      for (var i = ultimo; i < m.index; i++) { limpo += conteudo[i]; map.push(i); }
      ultimo = m.index + m[0].length;
      n++;
    }
    for (var j = ultimo; j < conteudo.length; j++) { limpo += conteudo[j]; map.push(j); }
    map.push(conteudo.length);
    return { limpo: limpo, map: map, n: n };
  }

  // Scanner(System.in).nextLine(): quebra a entrada em linhas
  function linhasStdin(txt) {
    if (!txt) return [];
    var ls = txt.split(/\r\n|[\n\r\u2028\u2029\u0085]/);
    if (/(\r\n|[\n\r\u2028\u2029\u0085])$/.test(txt)) ls.pop();
    return ls;
  }

  function runV2(T, src, r6, stdin) {
    var entrada = linhasStdin(stdin);
    T.enter("Main.main");
    T.s("main_read", "Lê o arquivo inteiro para a String conteudo.", { hl: [0, src.length] });
    var conteudo = src + "\n";
    T.s("main_nl", "Acrescenta um \"\\n\" no fim, para a última linha também ter um END.", { hl: [src.length, src.length + 1] });
    T.s("main_prepro", "Chama PrePro.filter(conteudo) antes do Lexer existir.", { hl: null });
    T.fase = "prepro";
    T.enter("PrePro.filter");
    var pp = prePro(conteudo);
    T.s("prepro", pp.n ? "replaceAll(\"//.*\", \"\") apaga " + pp.n + " comentário(s). O '.' não atravessa '\\n', então as quebras de linha ficam."
      : "Não há comentários: o código sai igual.", { hl: null });
    T.leave();
    T.map = pp.map;
    var source = pp.limpo;
    var lexer = null;
    T.fase = "main";

    function next() { return lexer.next; }
    function hlNext() { return [next().a, next().b]; }
    function consome(k, narr) { T.s(k, narr, { hl: hlNext() }); lexer.selectNext(); }
    function pErr(k, msg, narr) { T.erro(k, "java.lang.RuntimeException", msg, narr); }
    function ent(fn) { T.enter("Parser." + fn); T.fase = "parser"; }
    function sai() { T.leave(); T.fase = "parser"; }

    // ---------------- Parser ----------------
    function parseFactor() {
      ent("parseFactor");
      var t = next(), a0 = t.a, no, filho;
      T.s("pf_enter", "Entra em parseFactor(). Olha o token atual, " + nomeTok2(t) + ", para escolher o caminho do FACTOR.", { hl: hlNext() });
      if (t.tipo === "NUMERO") {
        T.s("pf_num_chk", "É NUMERO: caminho do número.", { hl: hlNext() });
        no = T.node("IntVal", t.valor, [], t.a, t.b);
        T.s("pf_num", "Cria IntVal(" + t.valor + "), uma folha.", { node: no.id, hl: hlNext() });
        consome("pf_num_next", "Consome o número.");
        sai(); return no;
      }
      if (t.tipo === "PLUS" || t.tipo === "MINUS" || (r6 && t.tipo === "NOT")) {
        var op = t.tipo === "PLUS" ? "+" : t.tipo === "MINUS" ? "-" : "!";
        var pre = t.tipo === "PLUS" ? "pf_plus" : t.tipo === "MINUS" ? "pf_minus" : "pf_not";
        T.s(pre + "_chk", "É " + t.tipo + ": operador unário '" + op + "' seguido de outro FACTOR.", { hl: hlNext() });
        consome(pre + "_next", "Consome o '" + op + "'.");
        T.s(pre + "_call", "Chama parseFactor() de novo (recursão) para montar o operando.", { hl: hlNext() });
        filho = parseFactor();
        no = T.node("UnOp", op, [filho], a0, T.lastEnd);
        T.s(pre + "_ret", "Cria UnOp(\"" + op + "\") com 1 filho e devolve.", { node: no.id, hl: [a0, T.lastEnd] });
        sai(); return no;
      }
      if (t.tipo === "OPEN_PAR") {
        T.s("pf_par_chk", "É '(': dentro vem uma expressão inteira.", { hl: hlNext() });
        consome("pf_par_next", "Consome o '('.");
        T.s("pf_par_call", "Chama " + (r6 ? "parseBoolExpression()" : "parseExpression()") + " para o que está entre parênteses.", { hl: hlNext() });
        no = r6 ? parseBoolExpression() : parseExpression();
        if (next().tipo !== "CLOSE_PAR") pErr("pf_par_err", "[Parser] Expected )", "Terminou a expressão de dentro, mas o token atual é " + nomeTok2(next()) + ", não ')'. Faltou fechar o parêntese.");
        T.s("pf_par_close_chk", "O token atual é ')': o parêntese fecha certinho.", { hl: hlNext() });
        consome("pf_par_close_next", "Consome o ')'.");
        T.s("pf_par_ret", "Devolve o nó de dentro. Parêntese não vira nó.", { node: no.id, hl: null });
        sai(); return no;
      }
      if (t.tipo === "IDEN") {
        T.s("pf_iden_chk", "É IDEN: o USO de uma variável no meio da conta.", { hl: hlNext() });
        no = T.node("Identifier", t.nome, [], t.a, t.b);
        T.s("pf_iden", "Cria Identifier(\"" + t.nome + "\"). Ele guarda só o NOME: o valor só existe na hora do evaluate().", { node: no.id, hl: hlNext() });
        consome("pf_iden_next", "Consome o identificador.");
        sai(); return no;
      }
      if (r6 && t.tipo === "READ") {
        T.s("pf_read_chk", "É READ (Scanln): leitura do terminal.", { hl: hlNext() });
        consome("pf_read_next", "Consome o Scanln.");
        if (next().tipo !== "OPEN_PAR") pErr("pf_read_open_err", "[Parser] Expected (", "Depois de Scanln tem que vir '('. Veio " + nomeTok2(next()) + ".");
        consome("pf_read_open_next", "Consome o '('.");
        if (next().tipo !== "CLOSE_PAR") pErr("pf_read_close_err", "[Parser] Expected )", "Scanln não recebe argumentos: depois do '(' tem que vir ')'. Veio " + nomeTok2(next()) + ".");
        consome("pf_read_close_next", "Consome o ')'.");
        no = T.node("Read", null, [], a0, T.lastEnd);
        T.s("pf_read_ret", "Cria o nó Read, sem filhos. O número só vai ser lido no evaluate().", { node: no.id, hl: [a0, T.lastEnd] });
        sai(); return no;
      }
      pErr("pf_err", "[Parser] Unexpected token in factor: " + t.tipo,
        "Nenhum caminho do FACTOR começa com " + nomeTok2(t) + ". Era esperado número, variável, sinal" + (r6 ? ", '!', Scanln" : "") + " ou '('.");
    }

    function binLoop(pre, fn, sub, subNome, ops, rotulo) {
      ent(fn);
      var a0 = next().a;
      T.s(pre + "_enter", "Entra em " + fn + "(): " + rotulo, { hl: hlNext() });
      T.s(pre + "_first", "Chama " + subNome + "() para o primeiro operando.", { hl: hlNext() });
      var no = sub();
      while (ops.hasOwnProperty(next().tipo)) {
        var op = ops[next().tipo];
        T.s(pre + "_while", "O token atual é " + next().tipo + ": entra no laço.", { hl: hlNext() });
        if (pre !== "pbt" && pre !== "pbe") T.s(pre + "_op", "Guarda o operador \"" + op + "\" antes de avançar.", { hl: hlNext() });
        consome(pre + "_op_next", "Consome o '" + op + "'.");
        T.s(pre + "_right", "Chama " + subNome + "() para o operando da direita.", { hl: hlNext() });
        var dir = sub();
        no = T.node("BinOp", op, [no, dir], a0, T.lastEnd);
        T.s(pre + "_binop", "Cria BinOp(\"" + op + "\"): o nó que já tínhamos vira o filho da esquerda.", { node: no.id, hl: [a0, T.lastEnd] });
      }
      T.s(pre + "_ret", "O token atual (" + nomeTok2(next()) + ") não continua o laço: devolve o nó.", { node: no.id, hl: null });
      sai();
      return no;
    }
    function parseTerm() { return binLoop("pt", "parseTerm", parseFactor, "parseFactor", { MULT: "*", DIV: "/" }, "FACTOR, depois (* ou / FACTOR)*."); }
    function parseExpression() { return binLoop("pe", "parseExpression", parseTerm, "parseTerm", { PLUS: "+", MINUS: "-" }, "TERM, depois (+ ou - TERM)*."); }
    function parseRelExpression() { return binLoop("pr", "parseRelExpression", parseExpression, "parseExpression", { EQ: "==", GT: ">", LT: "<" }, "EXPRESSION, depois (== > < EXPRESSION)*."); }
    function parseBoolTerm() { return binLoop("pbt", "parseBoolTerm", parseRelExpression, "parseRelExpression", { AND: "&&" }, "REL_EXPRESSION, depois (&& REL_EXPRESSION)*."); }
    function parseBoolExpression() { return binLoop("pbe", "parseBoolExpression", parseBoolTerm, "parseBoolTerm", { OR: "||" }, "BOOL_TERM, depois (|| BOOL_TERM)*. É o degrau de menor precedência."); }
    var expr = r6 ? parseBoolExpression : parseExpression;
    var exprNome = r6 ? "parseBoolExpression" : "parseExpression";

    function fimDeLinha(pre, no, oque) {
      if (next().tipo !== "END") pErr(pre + "_end_err", "[Parser] Expected end of line",
        oque + " terminou, mas o próximo token é " + nomeTok2(next()) + ". Cada statement tem que acabar num '\\n' (END).");
      T.s(pre + "_end_chk", "O próximo token é END: " + oque.toLowerCase() + " acabou na linha certa.", { hl: hlNext() });
      consome(pre + "_end_next", "Consome o END.");
    }

    function parseBlock() {
      ent("parseBlock");
      var a0 = next().a;
      T.s("pb_enter", "Entra em parseBlock(): '{', statements, '}'.", { hl: hlNext() });
      if (next().tipo !== "OPEN_BRA") pErr("pb_open_err", "[Parser] Expected {", "Um bloco tem que abrir com '{'. Veio " + nomeTok2(next()) + ".");
      T.s("pb_open_chk", "O token é '{': abre o bloco.", { hl: hlNext() });
      consome("pb_open_next", "Consome o '{'.");
      var bloco = T.node("Block", null, [], a0, a0 + 1);
      T.s("pb_block", "Cria um Block vazio para guardar os statements de dentro.", { node: bloco.id, hl: [a0, a0 + 1] });
      while (next().tipo !== "CLOSE_BRA") {
        T.s("pb_while", "O token atual (" + nomeTok2(next()) + ") não é '}': ainda tem statement dentro do bloco.", { hl: hlNext() });
        if (next().tipo === "EOF") pErr("pb_eof_err", "[Parser] Expected }", "O arquivo acabou com o bloco ainda aberto: faltou o '}'.");
        T.s("pb_stmt", "Chama parseStatement().", { hl: hlNext() });
        var st = parseStatement();
        T.link(bloco, st);
        bloco.b = T.lastEnd;
        T.s("pb_add", "Pendura o statement como filho do Block (agora com " + bloco.kids.length + ").", { node: bloco.id, hl: null });
      }
      consome("pb_close_next", "Achou o '}': consome e fecha o bloco.");
      bloco.b = T.lastEnd; bloco.ca = T.conv([bloco.a, bloco.b]);
      T.s("pb_ret", "Devolve o Block com " + bloco.kids.length + " filho(s).", { node: bloco.id, hl: [a0, T.lastEnd] });
      sai();
      return bloco;
    }

    function parseStatement() {
      ent("parseStatement");
      var t = next(), a0 = t.a, no;
      T.s("ps_enter", "Entra em parseStatement(). O token atual, " + nomeTok2(t) + ", decide qual instrução é.", { hl: hlNext() });
      if (t.tipo === "PRINT") {
        T.s("ps_print_chk", "É PRINT: Println ( expressão ).", { hl: hlNext() });
        consome("ps_print_next", "Consome o Println.");
        if (next().tipo !== "OPEN_PAR") pErr("ps_print_open_err", "[Parser] Expected (", "Depois de Println tem que vir '('. Veio " + nomeTok2(next()) + ".");
        consome("ps_print_open_next", "Consome o '('.");
        T.s("ps_print_expr", "Chama " + exprNome + "() para o que vai ser impresso.", { hl: hlNext() });
        var e = expr();
        if (next().tipo !== "CLOSE_PAR") pErr("ps_print_close_err", "[Parser] Expected )", "A expressão do Println terminou, mas veio " + nomeTok2(next()) + " em vez de ')'.");
        consome("ps_print_close_next", "Consome o ')'.");
        no = T.node("Print", null, [e], a0, T.lastEnd);
        T.s("ps_print_node", "Cria o nó Print com a expressão como único filho.", { node: no.id, hl: [a0, T.lastEnd] });
        fimDeLinha("ps_print", no, "O Println");
        T.s("ps_print_ret", "Devolve o nó Print.", { node: no.id, hl: null });
        sai(); return no;
      }
      if (t.tipo === "IDEN") {
        T.s("ps_iden_chk", "É IDEN no começo da linha: só pode ser uma atribuição.", { hl: hlNext() });
        T.s("ps_iden_name", "Guarda o nome \"" + t.nome + "\" ANTES de avançar (depois o token some).", { hl: hlNext() });
        var id = T.node("Identifier", t.nome, [], t.a, t.b);
        T.s("ps_iden_node", "Cria Identifier(\"" + t.nome + "\"): vai ser o filho 0 do Assignment.", { node: id.id, hl: hlNext() });
        consome("ps_iden_next", "Consome o identificador.");
        if (next().tipo !== "ASSIGN") pErr("ps_assign_err", "[Parser] Expected =",
          "Depois de \"" + t.nome + "\" no começo da linha era preciso '='. Veio " + nomeTok2(next()) + "." + (t.nome.toLowerCase() === "println" ? " (Println tem P maiúsculo!)" : ""));
        T.s("ps_assign_chk", "Veio '=': atribuição confirmada.", { hl: hlNext() });
        consome("ps_assign_next", "Consome o '='.");
        T.s("ps_asg_expr", "Chama " + exprNome + "() para o lado direito.", { hl: hlNext() });
        var dir = expr();
        no = T.node("Assignment", null, [id, dir], a0, T.lastEnd);
        T.s("ps_asg_node", "Cria Assignment com 2 filhos: [0] o nome, [1] a expressão.", { node: no.id, hl: [a0, T.lastEnd] });
        fimDeLinha("ps_asg", no, "A atribuição");
        T.s("ps_asg_ret", "Devolve o Assignment.", { node: no.id, hl: null });
        sai(); return no;
      }
      if (r6 && t.tipo === "IF") {
        T.s("ps_if_chk", "É IF: if condição { ... } [else { ... }].", { hl: hlNext() });
        consome("ps_if_next", "Consome o 'if'.");
        T.s("ps_if_cond", "Chama parseBoolExpression() para a condição (sem parênteses obrigatórios, como no Go).", { hl: hlNext() });
        var cond = parseBoolExpression();
        T.s("ps_if_then", "Chama parseBlock() para o bloco do 'então'.", { hl: hlNext() });
        var entao = parseBlock(), senao = null;
        if (next().tipo === "ELSE") {
          T.s("ps_else_chk", "Logo depois do '}' veio 'else'.", { hl: hlNext() });
          consome("ps_else_next", "Consome o 'else'.");
          T.s("ps_else_block", "Chama parseBlock() para o bloco do else.", { hl: hlNext() });
          senao = parseBlock();
        }
        no = T.node("If", null, [cond, entao, senao], a0, T.lastEnd);
        T.s("ps_if_node", "Cria o nó If com " + no.kids.length + " filhos: condição, então" + (senao ? ", senão." : "."), { node: no.id, hl: [a0, T.lastEnd] });
        fimDeLinha("ps_if", no, "O if");
        T.s("ps_if_ret", "Devolve o If.", { node: no.id, hl: null });
        sai(); return no;
      }
      if (r6 && t.tipo === "WHILE") {
        T.s("ps_while_chk", "É WHILE (escrito 'for'): for condição { ... }.", { hl: hlNext() });
        consome("ps_while_next", "Consome o 'for'.");
        T.s("ps_while_cond", "Chama parseBoolExpression() para a condição do laço.", { hl: hlNext() });
        var c2 = parseBoolExpression();
        T.s("ps_while_body", "Chama parseBlock() para o corpo do laço.", { hl: hlNext() });
        var corpo = parseBlock();
        no = T.node("While", null, [c2, corpo], a0, T.lastEnd);
        T.s("ps_while_node", "Cria o nó While com 2 filhos: condição e corpo.", { node: no.id, hl: [a0, T.lastEnd] });
        fimDeLinha("ps_while", no, "O for");
        T.s("ps_while_ret", "Devolve o While.", { node: no.id, hl: null });
        sai(); return no;
      }
      if (t.tipo === "END") {
        T.s("ps_empty_chk", "É END logo de cara: linha vazia.", { hl: hlNext() });
        consome("ps_empty_next", "Consome o '\\n'.");
        no = T.node("NoOp", null, [], t.a, t.b);
        T.s("ps_noop", "Linha vazia vira NoOp, um nó que não faz nada.", { node: no.id, hl: [t.a, t.b] });
        sai(); return no;
      }
      pErr("ps_err", "[Parser] Unexpected token in statement: " + t.tipo,
        "Nenhuma instrução começa com " + nomeTok2(t) + ". Uma linha pode começar com Println, uma variável" + (r6 ? ", if, for" : "") + " ou ser vazia." +
        (t.tipo === "NUMERO" ? " (Uma conta solta, sem atribuir a ninguém, não é instrução.)" : "") +
        (t.tipo === "CLOSE_BRA" ? " (Tem um '}' sobrando.)" : "") +
        (t.tipo === "ELSE" ? " (O else tem que vir na MESMA linha do '}' do if: '} else {'.)" : ""));
    }

    function parseProgram() {
      ent("parseProgram");
      T.s("pp_enter", "Entra em parseProgram(): o programa é uma sequência de statements até o EOF.", { hl: hlNext() });
      var bloco = T.node("Block", null, [], 0, source.length);
      T.s("pp_block", "Cria o Block raiz. Cada linha do arquivo vai virar um filho dele.", { node: bloco.id, hl: null });
      while (next().tipo !== "EOF") {
        T.s("pp_while", "Ainda não é EOF (o token atual é " + nomeTok2(next()) + "): lê mais um statement.", { hl: hlNext() });
        T.s("pp_stmt", "Chama parseStatement().", { hl: hlNext() });
        var st = parseStatement();
        T.link(bloco, st);
        T.s("pp_add", "Pendura o statement no Block raiz (agora com " + bloco.kids.length + " filho(s)).", { node: bloco.id, hl: null });
      }
      T.s("pp_ret", "Chegou no EOF. Devolve o Block com " + bloco.kids.length + " statement(s).", { node: bloco.id, hl: null });
      sai();
      return bloco;
    }

    function run() {
      T.enter("Parser.run");
      T.fase = "parser";
      T.s("run_enter", "Entra em Parser.run() com o código já sem comentários.", { hl: null });
      lexer = new LexerV2(T, source, r6);
      T.s("run_lexer", "Cria o Lexer. position = 0 e ainda não há token nenhum.", { hl: [0, 0] });
      T.s("run_first", "Pede o primeiro token, para o Parser ter o que olhar.", { hl: [0, 0] });
      lexer.selectNext();
      T.s("run_prog", "Chama parseProgram(), o novo ponto de entrada.", { hl: hlNext() });
      var raiz = parseProgram();
      T.s("run_ret", "Análise sintática completa. Devolve a raiz da AST para a main().", { node: raiz.id, hl: null });
      T.leave();
      return raiz;
    }

    // ---------------- evaluate ----------------
    function evaluate(n) {
      T.enter(n.cls + ".evaluate", null, n.id);
      T.fase = "eval";
      var o = { node: n.id, hl: [n.a, n.b] }, r = 0, e, d, x, k = n.kids;
      function filho(i) { return T.nodes[k[i].id]; }
      switch (n.cls) {
        case "IntVal":
          r = n.value; T.val(n, r);
          T.s("ev_int", "IntVal devolve o número que guarda: " + r + ".", o);
          break;
        case "Identifier":
          T.s("ev_iden", "Identifier pede à SymbolTable o valor ATUAL de \"" + n.value + "\".", o);
          r = stGet(n.value);
          T.val(n, r);
          break;
        case "UnOp":
          T.s("ev_un_child", "UnOp(\"" + n.value + "\") avalia primeiro o único filho.", o);
          x = evaluate(filho(0)); T.loc("resultado", x);
          if (n.value === "-") { r = I.neg(x); T.val(n, r); T.s("ev_un_neg", "Troca o sinal: -(" + x + ") = " + r + ".", o); }
          else if (n.value === "!") { r = x === 0 ? 1 : 0; T.val(n, r); T.s("ev_un_not", "Negação lógica: !" + x + " = " + r + " (0 é falso, o resto é verdadeiro).", o); }
          else { r = x; T.val(n, r); T.s("ev_un_pos", "+ unário não muda nada: " + r + ".", o); }
          break;
        case "BinOp":
          T.s("ev_bin_l", "BinOp(\"" + n.value + "\") avalia primeiro o filho da esquerda.", o);
          e = evaluate(filho(0)); T.loc("esquerdo", e);
          T.s("ev_bin_r", "esquerdo = " + e + ". Agora avalia o filho da direita" + (n.value === "&&" || n.value === "||" ? " (sempre: não há curto-circuito)." : "."), o);
          d = evaluate(filho(1)); T.loc("direito", d);
          switch (n.value) {
            case "+": r = I.add(e, d); T.val(n, r); T.s("ev_bin_plus", e + " + " + d + " = " + r + ".", o); break;
            case "-": r = I.sub(e, d); T.val(n, r); T.s("ev_bin_minus", e + " - " + d + " = " + r + ".", o); break;
            case "*": r = I.mul(e, d); T.val(n, r); T.s("ev_bin_mult", e + " × " + d + " = " + r + ".", o); break;
            case "/":
              if (d === 0) T.erro("ev_bin_div_err", "java.lang.RuntimeException", "[Semantic] Division by zero", "O divisor avaliou para 0. A escrita estava certa; o valor é que não faz sentido: erro semântico.");
              T.s("ev_bin_div_chk", "Confere o divisor: " + d + " não é zero.", o);
              r = I.div(e, d); T.val(n, r); T.s("ev_bin_div", e + " / " + d + " = " + r + " (divisão inteira).", o); break;
            case "==": r = e === d ? 1 : 0; T.val(n, r); T.s("ev_bin_eq", e + " == " + d + " → " + r + ".", o); break;
            case ">": r = e > d ? 1 : 0; T.val(n, r); T.s("ev_bin_gt", e + " > " + d + " → " + r + ".", o); break;
            case "<": r = e < d ? 1 : 0; T.val(n, r); T.s("ev_bin_lt", e + " < " + d + " → " + r + ".", o); break;
            case "&&": r = e !== 0 && d !== 0 ? 1 : 0; T.val(n, r); T.s("ev_bin_and", e + " && " + d + " → " + r + ".", o); break;
            case "||": r = e !== 0 || d !== 0 ? 1 : 0; T.val(n, r); T.s("ev_bin_or", e + " || " + d + " → " + r + ".", o); break;
          }
          break;
        case "Print":
          T.s("ev_print_child", "Print avalia o filho para saber o que imprimir.", o);
          x = evaluate(filho(0)); T.loc("resultado", x);
          T.out.push(String(x));
          T.s("ev_print_out", "System.out.println(" + x + "): aparece na saída.", o);
          break;
        case "Assignment":
          T.s("ev_asg_child", "Assignment avalia SÓ o filho [1], o lado direito.", o);
          x = evaluate(filho(1)); T.loc("valor", x);
          T.s("ev_asg_name", "Pega o nome direto do value do filho [0]: \"" + filho(0).value + "\". Não chama evaluate() nele: ninguém quer o valor antigo.", o);
          T.s("ev_asg_set", "Chama st.setValue(\"" + filho(0).value + "\", " + x + ").", o);
          stSet(filho(0).value, x);
          break;
        case "Block":
          for (var i = 0; i < k.length; i++) {
            T.loc("filho", i);
            T.s("ev_block_child", "Block executa o filho " + (i + 1) + " de " + k.length + " (" + filho(i).cls + ").", o);
            evaluate(filho(i));
          }
          if (!k.length) T.s("ev_block_for", "Block vazio: não há o que executar.", o);
          break;
        case "NoOp":
          T.s("ev_noop", "NoOp: linha vazia, não faz nada.", o);
          break;
        case "If":
          T.s("ev_if_cond", "If avalia a condição (filho 0).", o);
          x = evaluate(filho(0)); T.loc("condicao", x);
          if (x !== 0) {
            T.s("ev_if_then", "A condição deu " + x + " (diferente de 0): executa o bloco do então.", o);
            evaluate(filho(1));
          } else if (k.length > 2) {
            T.s("ev_if_else", "A condição deu 0: executa o bloco do else.", o);
            evaluate(filho(2));
          } else {
            T.s("ev_if_has_else", "A condição deu 0 e não tem else: não faz nada.", o);
          }
          T.s("ev_if_end", "Fim do If.", o);
          break;
        case "While":
          var volta = 0;
          for (;;) {
            T.loc("volta", volta);
            T.s("ev_while_cond", "While avalia a condição de novo" + (volta ? " (volta " + (volta + 1) + ")." : "."), o);
            x = evaluate(filho(0)); T.loc("condicao", x);
            if (x === 0) break;
            volta++; T.loc("volta", volta);
            T.s("ev_while_body", "A condição deu " + x + ": executa o corpo (volta " + volta + ").", o);
            evaluate(filho(1));
          }
          T.s("ev_while_end", "A condição deu 0: sai do laço depois de " + volta + " volta(s).", o);
          break;
        case "Read":
          T.enter("Scanner.nextLine");
          if (T.lidos >= entrada.length) T.erro("ev_read_eof", "java.lang.RuntimeException", "[Semantic] Scanln: no input available", "O programa pediu um Scanln(), mas a entrada (stdin) já acabou. Preencha a caixa de entrada.");
          T.s("ev_read_chk", "Tem linha disponível na entrada.", o);
          var linha = javaTrim(entrada[T.lidos]);
          T.lidos++;
          T.s("ev_read_line", "Lê a linha \"" + linha + "\" do terminal.", o);
          T.leave();
          var ok = /^[+-]?[0-9]+$/.test(linha), num = ok ? Number(linha) : NaN;
          if (!ok || num > 2147483647 || num < -2147483648) T.erro("ev_read_err", "java.lang.RuntimeException", "[Semantic] Scanln: invalid integer " + linha, "\"" + linha + "\" não é um inteiro válido.");
          r = num; T.val(n, r);
          T.s("ev_read_ret", "Converte e devolve " + r + ".", o);
          break;
      }
      T.leave();
      return r;
    }
    function stGet(nome) {
      T.enter("SymbolTable.getValue", { nome: nome });
      T.fase = "eval";
      if (!T.st || !Object.prototype.hasOwnProperty.call(T.st, nome)) {
        T.erro("st_get_err", "java.lang.RuntimeException", "[Semantic] Variable " + nome + " not declared",
          "\"" + nome + "\" nunca recebeu valor antes desta linha, então não está na tabela. O Parser não tinha como saber disso: erro semântico.");
      }
      var v = T.st[nome];
      T.s("st_get_ret", "\"" + nome + "\" está na tabela: devolve " + v + ".", { stAlt: nome });
      T.leave();
      return v;
    }
    function stSet(nome, v) {
      T.enter("SymbolTable.setValue", { nome: nome, valor: v });
      var existe = T.st && Object.prototype.hasOwnProperty.call(T.st, nome);
      T.stSet(nome, v);
      if (existe) T.s("st_set_upd", "\"" + nome + "\" já existia: atualiza o value do Variable para " + v + ".", { stAlt: nome });
      else T.s("st_set_new", "\"" + nome + "\" é nova: cria new Variable(" + v + ") e põe na tabela.", { stAlt: nome });
      T.leave();
    }

    T.fase = "main";
    T.s("main_parse", "Chama Parser.run(codigoLimpo): Lexer e Parser trabalham juntos, token a token.", { hl: null });
    var raiz = run();
    T.fase = "main";
    T.s("main_st", "Cria a SymbolTable, vazia. Ela só existe agora, na execução, e não durante o Parser.", { hl: null });
    T.st = {};
    T.s("main_eval", "Chama raiz.evaluate(st): o Block raiz executa cada statement em ordem.", { node: raiz.id, hl: null });
    evaluate(raiz);
    T.fase = "fim";
    T.s("main_eval", "Fim do programa.", { hl: null });
    T.leave();
  }

  // ------------------------------------------------------------ fachada ---
  var VERSOES = {
    "v0.0": { roteiro: 1, entrada: "args", rodar: function (T, src) { runV00(T, src); } },
    "v1.0": { roteiro: 2, entrada: "args", rodar: function (T, src) { runV1(T, src, "1.0"); } },
    "v1.1": { roteiro: 3, entrada: "args", rodar: function (T, src) { runV1(T, src, "1.1"); } },
    "v1.2": { roteiro: 4, entrada: "args", rodar: function (T, src) { runV1(T, src, "1.2"); } },
    "v2.0": { roteiro: 5, entrada: "arquivo", rodar: function (T, src, o) { runV2(T, src, false, o.stdin); } },
    "v2.1": { roteiro: 6, entrada: "arquivo", rodar: function (T, src, o) { runV2(T, src, true, o.stdin); } }
  };

  function executar(versao, src, o) {
    o = o || {};
    var T = new Trace(o), V = VERSOES[versao], res = { versao: versao, trace: T, saida: T.out, erro: null, limite: false };
    try { V.rodar(T, src, o); }
    catch (e) {
      if (e instanceof JavaError) res.erro = e;
      else if (e instanceof LimiteErro) {
        res.limite = true;
        T.steps.push({ k: null, narr: "Parei depois de " + e.n + " passos. Provavelmente é um laço infinito: a condição do for nunca chega em 0.", fase: "erro", hl: null, pos: T.pos, cur: T.cur, nt: T.tokens.length, fr: [], st: T.st, nout: T.out.length, node: null, erro: { cls: "", msg: "Limite de passos", origem: "Limite" }, lidos: T.lidos });
      } else throw e;
    }
    return res;
  }

  var Motor = { executar: executar, VERSOES: VERSOES, JavaError: JavaError, prePro: prePro };
  if (typeof module !== "undefined" && module.exports) module.exports = Motor;
  else G.Motor = Motor;
})(typeof window !== "undefined" ? window : this);
