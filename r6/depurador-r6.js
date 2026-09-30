/* =========================================================================
   ROTEIRO 6 — depurador animado (Java)
   Usa o Motor (r6/motor.js, validado contra o javac) e a referência Java
   do Roteiro 6 (window.R6_FONTE). Visual no mesmo estilo da animação
   da Colinha: fita de tokens, pilha de chamadas, AST e código ativo.
   ========================================================================= */
(function () {
  "use strict";
  var F = window.R6_FONTE, SRC = F.src.split("\n"), LN = F.linhas;

  function h(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // ---------------------------------------------------------- realce Java
  var RE = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(abstract|class|extends|static|void|int|new|return|if|else|while|for|throw|public|private|throws|import|enum|try|catch|null|this)\b|\b(String|Object|Node|Token|TipoToken|Lexer|Parser|SymbolTable|Variable|HashMap|ArrayList|RuntimeException|NumberFormatException|Exception|Scanner|Integer|Character|PrePro|Block|BinOp|UnOp|IntVal|Identifier|Print|Assignment|NoOp|If|While|Read|Files|Paths|System)\b|\b(\d+)\b/g;
  function realce(l) {
    return h(l).replace(RE, function (m, c, s, k, t, n) {
      if (c) return '<span class="c">' + c + "</span>";
      if (s) return '<span class="s">' + s + "</span>";
      if (k) return '<span class="k">' + k + "</span>";
      if (t) return '<span class="ty">' + t + "</span>";
      if (n) return '<span class="n">' + n + "</span>";
      return m;
    });
  }

  // ---------------------------------------------- métodos do arquivo Java
  var METODOS = (function () {
    var M = [];
    SRC.forEach(function (l, i) {
      var m = /^\s+(?:public\s+|static\s+|abstract\s+|private\s+)*[\w<>\[\],]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{/.exec(l);
      if (!m || /^(if|while|for|switch|catch)$/.test(m[1])) return;
      var prof = 0;
      for (var j = i; j < SRC.length; j++) {
        var sem = SRC[j].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*$/g, "");
        prof += (sem.match(/\{/g) || []).length - (sem.match(/\}/g) || []).length;
        if (prof <= 0) { M.push({ de: i + 1, ate: j + 1 }); break; }
      }
    });
    return M;
  })();
  function metodoDe(l) {
    var best = null;
    METODOS.forEach(function (m) { if (l >= m.de && l <= m.ate && (!best || m.ate - m.de < best.ate - best.de)) best = m; });
    return best;
  }

  // ------------------------------------------------------------ rótulos
  function rotNo(n) {
    switch (n.cls) {
      case "IntVal": return String(n.value);
      case "Identifier": return n.value;
      case "UnOp": case "BinOp": return String(n.value);
      case "Print": return "Println";
      case "Assignment": return "=";
      case "Read": return "Scanln()";
      default: return n.cls;
    }
  }
  function nomeNo(n) {
    if (!n) return "";
    if (n.cls === "IntVal") return "IntVal(" + n.value + ")";
    if (n.cls === "Identifier") return 'Identifier("' + n.value + '")';
    if (n.cls === "UnOp" || n.cls === "BinOp") return n.cls + '("' + n.value + '")';
    if (n.cls === "Block") return "Block";
    return n.cls;
  }
  function nomeFrame(f, T) {
    var p = f.fn.split(".");
    if (p[1] === "evaluate" && f.no != null) return nomeNo(T.nodes[f.no]) + ".evaluate()";
    if (p[0] === "SymbolTable" && f.loc && f.loc.nome) return f.fn + '("' + f.loc.nome + '"' + (f.loc.valor !== undefined ? ", " + f.loc.valor : "") + ")";
    return f.fn + "()";
  }
  var KIND = function (fn) { return /^Lexer/.test(fn) ? "lex" : /^Parser/.test(fn) ? "syn" : /evaluate|SymbolTable|Scanner/.test(fn) ? "sem" : "main"; };
  var RET_EVAL = /^(ev_int|ev_un_neg|ev_un_not|ev_un_pos|ev_bin_(plus|minus|mult|div|eq|gt|lt|and|or)|ev_read_ret|st_get_ret)$/;

  var EXEMPLOS = [
    ["fatorial (meta)", "i = 1\nn = 5\nf = 1\nif n < 2 {\n    f = 1\n} else {\n    for i < n || i == n {\n        f = f * i\n        i = i + 1\n    }\n}\nPrintln(f)", ""],
    ["Scanln + if/else", "x = Scanln()\ny = Scanln()\nif x > y && !(x == 0) {\n    Println(x)\n} else {\n    Println(y)\n}", "7\n3\n"],
    ["for com && e !", "n = Scanln()\ni = 0\nfor i < n && !(i == 3) {\n    Println(i)\n    i = i + 1\n}", "10\n"],
    ["precedência", "Println(1 + 2 * 3 == 7 && !0 || 0)", ""],
    ["só expressão", "x = 3 > 2 == 1", ""],
    ["erro: else", "if 1 {\n    Println(1)\n}\nelse {\n    Println(2)\n}", ""],
    ["erro: &", "x = 1 & 2", ""],
    ["erro: variável", "if 1 == 1 {\n    Println(y)\n}", ""],
    ["sem curto-circuito", "if 1 > 0 || 1 / 0 == 0 {\n    Println(1)\n}", ""],
    ["laço infinito", "i = 0\nfor i < 3 {\n    Println(i)\n}", ""]
  ];

  var SELO = { main: "Preparação", prepro: "PrePro", lexer: "Léxico", parser: "Sintático", eval: "Semântico", erro: "Erro", fim: "Fim" };
  var COR = { lexer: "#14674c", parser: "#215c7a", eval: "#bd711d", erro: "#a13216", main: "#819096", prepro: "#819096", fim: "#14674c" };

  function montar(host) {
    var uid = "r6d" + Math.random().toString(36).slice(2, 7);
    host.classList.add("r6");
    host.innerHTML =
      '<div class="r6-ent">' +
        '<div class="r6-campos">' +
          '<div class="r6-campo"><label class="lb" for="' + uid + '-src">Programa (entrada.go)</label><textarea id="' + uid + '-src" class="r6-src" spellcheck="false" autocomplete="off" rows="10"></textarea></div>' +
          '<div class="r6-campo r6-campo-in"><label class="lb" for="' + uid + '-in">Terminal (stdin) · uma linha por Scanln()</label><textarea id="' + uid + '-in" class="r6-in" spellcheck="false" autocomplete="off" rows="3"></textarea>' +
            '<button type="button" class="btn play r6-run">▶ Compilar e animar</button><span class="r6-dica">Ctrl+Enter compila · ← → passo · espaço roda</span></div>' +
        "</div>" +
        '<div class="r6-ex"><span class="lb">Exemplos</span></div>' +
      "</div>" +
      '<div class="r6-anim">' +
        '<div class="an-top"><span class="lb">Tokens que o Lexer já entregou</span><span class="an-fase r6-fase"></span></div>' +
        '<div class="an-fita r6-fita"></div>' +
        '<div class="an-grid r6-grid">' +
          '<div class="an-col"><h5>Pilha de chamadas</h5><div class="an-pilha r6-pilha"></div></div>' +
          '<div class="an-col"><h5 class="r6-arv-h">AST</h5><div class="an-arv r6-arv"></div></div>' +
          '<div class="an-col"><h5 class="r6-cod-h-wrap"><span class="r6-cod-h">Código</span><button type="button" class="r6-tgl" aria-pressed="false">arquivo inteiro</button></h5><div class="an-cod r6-cod"></div></div>' +
        "</div>" +
        '<div class="r6-grid2">' +
          '<div class="an-col"><h5>Programa · trecho em uso e lexer.position</h5><div class="r6-fonte"></div></div>' +
          '<div class="an-col"><h5>SymbolTable</h5><div class="r6-st"></div></div>' +
          '<div class="r6-col-io"><div class="an-saida r6-saida"></div><div class="r6-stdin"></div></div>' +
        "</div>" +
        '<div class="an-narra r6-narra"><span class="pn r6-pn"></span><span class="tx r6-tx"></span></div>' +
        '<div class="an-ctrl">' +
          '<button class="btn r6-ini" type="button" title="Início" aria-label="Início">⏮</button>' +
          '<button class="btn r6-ant" type="button" title="Passo anterior" aria-label="Passo anterior">◀</button>' +
          '<button class="btn play r6-play" type="button">▶ Rodar</button>' +
          '<button class="btn r6-prox" type="button" title="Próximo passo" aria-label="Próximo passo">▶</button>' +
          '<button class="btn r6-fase-btn" type="button" title="Pular para a próxima fase">⇥ fase</button>' +
          '<button class="btn r6-fim" type="button" title="Fim" aria-label="Fim">⏭</button>' +
          '<span class="r6-sl-wrap"><input type="range" class="r6-sl" min="0" max="0" value="0" aria-label="Linha do tempo"><canvas class="r6-faixa" height="6" aria-hidden="true"></canvas></span>' +
          '<span class="conta r6-conta"></span>' +
          '<select class="r6-vel" aria-label="Velocidade"><option value="1100">lento</option><option value="600" selected>normal</option><option value="260">rápido</option><option value="70">turbo</option></select>' +
          '<label class="r6-chk"><input type="checkbox" class="r6-pulalex"> pular passos do Lexer</label>' +
        "</div>" +
      "</div>";

    var $ = function (s) { return host.querySelector(s); };
    var E = {
      src: $(".r6-src"), inp: $(".r6-in"), ex: $(".r6-ex"), fase: $(".r6-fase"), fita: $(".r6-fita"), pilha: $(".r6-pilha"),
      arv: $(".r6-arv"), arvH: $(".r6-arv-h"), cod: $(".r6-cod"), codH: $(".r6-cod-h"), tgl: $(".r6-tgl"), fonte: $(".r6-fonte"),
      st: $(".r6-st"), saida: $(".r6-saida"), stdin: $(".r6-stdin"), pn: $(".r6-pn"), tx: $(".r6-tx"),
      sl: $(".r6-sl"), faixa: $(".r6-faixa"), conta: $(".r6-conta"), play: $(".r6-play"), vel: $(".r6-vel"), pula: $(".r6-pulalex")
    };
    var S = { res: null, i: 0, timer: null, inteiro: false, mostra: "" };

    EXEMPLOS.forEach(function (ex, k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "preset"; b.textContent = ex[0];
      b.setAttribute("aria-pressed", k === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(E.ex.querySelectorAll(".preset"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        E.src.value = ex[1]; E.inp.value = ex[2]; compila(); tocar();
      });
      E.ex.appendChild(b);
    });

    function compila() {
      parar();
      var src = E.src.value;
      S.res = Motor.executar("v2.1", src, { stdin: E.inp.value, max: 20000 });
      S.mostra = src + "\n";
      S.stdin = E.inp.value;
      E.sl.max = String(S.res.trace.steps.length - 1);
      faixa();
      ir(0);
    }

    // ------------------------------------------------------- navegação
    function visivel(k) { var s = S.res.trace.steps[k]; return !(E.pula.checked && s.fase === "lexer") || s.erro; }
    function passo(d) {
      var n = S.res.trace.steps.length, k = S.i + d;
      while (k >= 0 && k < n && !visivel(k)) k += d;
      if (k < 0 || k >= n) return false;
      ir(k); return true;
    }
    function parar() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } E.play.textContent = "▶ Rodar"; }
    function tocar() {
      if (S.timer) return parar();
      if (S.i >= S.res.trace.steps.length - 1) ir(0);
      E.play.textContent = "‖ Pausar";
      (function t() { if (!passo(1)) return parar(); S.timer = setTimeout(t, +E.vel.value); })();
    }
    function pulaFase() {
      var St = S.res.trace.steps, grupo = function (f) { return f === "lexer" || f === "parser" ? "ls" : f; }, g = grupo(St[S.i].fase), k = S.i + 1;
      while (k < St.length && grupo(St[k].fase) === g) k++;
      if (k < St.length) ir(k);
    }
    $(".r6-ini").onclick = function () { parar(); ir(0); };
    $(".r6-fim").onclick = function () { parar(); ir(S.res.trace.steps.length - 1); };
    $(".r6-ant").onclick = function () { parar(); passo(-1); };
    $(".r6-prox").onclick = function () { parar(); passo(1); };
    $(".r6-fase-btn").onclick = function () { parar(); pulaFase(); };
    E.play.onclick = tocar;
    E.sl.oninput = function () { parar(); ir(+E.sl.value); };
    $(".r6-run").onclick = function () { compila(); tocar(); };
    E.tgl.onclick = function () { S.inteiro = !S.inteiro; E.tgl.setAttribute("aria-pressed", S.inteiro); E.tgl.textContent = S.inteiro ? "só a função" : "arquivo inteiro"; ir(S.i); };
    E.src.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); compila(); tocar(); }
      else if (e.key === "Tab") { e.preventDefault(); E.src.setRangeText("    ", E.src.selectionStart, E.src.selectionEnd, "end"); }
    });
    host.addEventListener("keydown", function (e) {
      var t = e.target.tagName;
      if (t === "TEXTAREA" || t === "SELECT" || (t === "INPUT" && e.target.type !== "range")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); parar(); passo(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); parar(); passo(-1); }
      else if (e.key === " ") { e.preventDefault(); tocar(); }
    });

    function faixa() {
      var cv = E.faixa, St = S.res.trace.steps, w = cv.clientWidth || 300;
      cv.width = w;
      var ctx = cv.getContext("2d");
      for (var x = 0; x < w; x++) {
        var s = St[Math.min(St.length - 1, Math.floor(x / w * St.length))];
        ctx.fillStyle = COR[s.fase] || "#c9d5d6";
        ctx.fillRect(x, 0, 1, 6);
      }
    }
    if (window.ResizeObserver) new ResizeObserver(function () { if (S.res) faixa(); }).observe(E.faixa);

    // ---------------------------------------------------------- desenho
    function ir(k) {
      var T = S.res.trace, St = T.steps;
      S.i = Math.max(0, Math.min(St.length - 1, k));
      var s = St[S.i], ant = S.i > 0 ? St[S.i - 1] : null;
      E.sl.value = String(S.i);
      E.conta.textContent = (S.i + 1) + " / " + St.length;
      var avaliando = s.fase === "eval" || s.fase === "fim" || (s.fase === "erro" && s.st);
      E.fase.textContent = s.fase === "erro" ? "Erro" : avaliando ? "Fase 2 · evaluate()" : s.fase === "lexer" || s.fase === "parser" ? "Fase 1 · Lexer + Parser" : "Preparação · main()";
      E.fase.className = "an-fase r6-fase" + (avaliando ? " ev" : "") + (s.fase === "erro" ? " er" : "");
      fita(T, s, avaliando);
      pilha(T, s, ant);
      arvore(T, s, avaliando);
      codigo(s);
      fonte(T, s);
      tabela(T, s);
      io(T, s);
      narra(T, s);
    }

    function fita(T, s, avaliando) {
      E.fita.className = "an-fita r6-fita" + (avaliando ? " apagada" : "");
      if (!s.nt) { E.fita.innerHTML = '<span class="r6-vazio">nenhum token ainda: o Lexer só trabalha quando o Parser chama <b>selectNext()</b></span>'; return; }
      var html = "";
      for (var k = 0; k < s.nt; k++) {
        var t = T.tokens[k], cls = "an-tk";
        if (k < s.cur) cls += " lido";
        if (k === s.cur && !avaliando) cls += " nx";
        if (t.s === S.i) cls += " r6-novo";
        var v = t.tipo === "NUMERO" || t.tipo === "IDEN" ? '<span class="r6-tv">' + h(t.v) + "</span>" : "";
        html += '<span class="' + cls + '" title="' + h(t.txt) + '">' + h(t.tipo) + v + "</span>";
      }
      E.fita.innerHTML = html;
      var nx = E.fita.querySelector(".nx");
      if (nx && E.fita.scrollWidth > E.fita.clientWidth) E.fita.scrollLeft = nx.offsetLeft - E.fita.clientWidth / 2;
    }

    function pilha(T, s, ant) {
      if (!s.fr.length) { E.pilha.innerHTML = '<span class="r6-vazio">vazia</span>'; return; }
      var html = "", topo = s.fr.length - 1;
      for (var d = topo; d >= 0; d--) {
        var f = s.fr[d], nome = nomeFrame(f, T), kind = KIND(f.fn), st, cls = "an-fr r6-fr r6-" + kind;
        var novo = !ant || !ant.fr[d] || ant.fr[d].fn !== f.fn || ant.fr[d].no !== f.no;
        if (d === topo) {
          cls += " topo";
          var ret = retorno(T, s, f);
          if (ret !== null) { cls += " volta"; st = "↩ devolve " + ret; }
          else st = "rodando agora · linha " + (LN[f.k] || "—");
        } else st = "esperando a de cima voltar · linha " + (LN[f.k] || "—");
        if (novo && ant) cls += " novo";
        if (s.erro && d === topo) { cls += " err"; st = "lança " + (s.erro.origem === "Java" ? s.erro.cls.split(".").pop() : "[" + s.erro.origem + "]"); }
        var loc = "";
        if (f.loc) for (var n in f.loc) if (f.loc[n] !== null && f.loc[n] !== undefined && n !== "nome") loc += '<span><i>' + h(n) + "</i> = " + h(f.loc[n]) + "</span>";
        html += '<div class="' + cls + '"><span class="nm">' + h(nome) + '</span><span class="st">' + h(st) + "</span>" + (loc ? '<span class="r6-loc">' + loc + "</span>" : "") + "</div>";
      }
      E.pilha.innerHTML = html + '<div class="an-base">↑ a de cima é a que está rodando</div>';
    }
    function retorno(T, s, f) {
      if (RET_EVAL.test(s.k)) {
        if (s.k === "st_get_ret") return s.st[f.loc.nome];
        for (var v = T.vals.length - 1; v >= 0; v--) if (T.vals[v].s === S.i && T.vals[v].id === f.no) return T.vals[v].v;
      }
      if (/_ret$/.test(s.k) && s.node != null && /^Parser/.test(f.fn)) return "o nó " + nomeNo(T.nodes[s.node]);
      return null;
    }

    function arvore(T, s, avaliando) {
      var i = S.i, vis = {}, filhos = {}, pai = {}, lista = [];
      T.nodes.forEach(function (n) {
        if (n.s > i) return;
        vis[n.id] = 1; lista.push(n.id); filhos[n.id] = [];
        n.kids.forEach(function (c) { if (c.s <= i) { filhos[n.id].push(c); pai[c.id] = n.id; } });
      });
      E.arvH.textContent = avaliando ? "AST sendo avaliada" : "AST sendo montada pelo Parser";
      if (!lista.length) { E.arv.innerHTML = '<span class="r6-vazio">' + (s.fase === "lexer" || s.fase === "main" || s.fase === "prepro" ? "a árvore aparece conforme o Parser monta" : "…") + "</span>"; return; }
      var raizes = lista.filter(function (id) { return pai[id] === undefined; });
      var val = {}, valNovo = {};
      T.vals.forEach(function (v) { if (v.s <= i) { val[v.id] = v.v; if (v.s === i) valNovo[v.id] = 1; } });
      var ativos = {};
      s.fr.forEach(function (f) { if (f.no != null) ativos[f.no] = 1; });
      var W = 70, H = 64, PAD = 18, col = 0, pos = {}, prof = 0;
      raizes.forEach(function (r, ri) {
        if (ri) col += 0.7;
        (function vai(id, d) {
          prof = Math.max(prof, d);
          var fs = filhos[id];
          if (!fs.length) { pos[id] = { c: col++, p: d }; return; }
          fs.forEach(function (c) { vai(c.id, d + 1); });
          pos[id] = { c: (pos[fs[0].id].c + pos[fs[fs.length - 1].id].c) / 2, p: d };
        })(r, 0);
      });
      var larg = Math.max(col, 1) * W + PAD * 2, alt = (prof + 1) * H + PAD * 2 + 12;
      function px(id) { return PAD + pos[id].c * W + W / 2; }
      function py(id) { return PAD + pos[id].p * H + 18; }
      var ed = "", nos = "";
      lista.forEach(function (id) {
        filhos[id].forEach(function (c) {
          var x1 = px(id), y1 = py(id) + 12, x2 = px(c.id), y2 = py(c.id) - 13;
          ed += '<path class="an-e' + (ativos[c.id] && ativos[id] ? " ativo" : "") + (c.s === i ? " r6-e-novo" : "") + '" d="M' + x1 + " " + y1 + " C" + x1 + " " + (y1 + 20) + " " + x2 + " " + (y2 - 20) + " " + x2 + " " + y2 + '" fill="none" pathLength="1"/>';
        });
      });
      lista.forEach(function (id) {
        var n = T.nodes[id], t = rotNo(n), w = Math.max(28, t.length * 7.6 + 16), x = px(id), y = py(id);
        var tipo = n.cls === "IntVal" || n.cls === "Identifier" || n.cls === "Read" ? "folha" : n.cls === "BinOp" || n.cls === "UnOp" ? "op" : "stmt";
        var cls = "an-n r6-n r6-" + tipo + (ativos[id] ? " ativo" : "") + (s.node === id ? " topo" : "") + (n.s === i ? " entra" : "");
        var mostraV = val[id] !== undefined && (tipo !== "stmt");
        nos += '<g class="' + cls + '"><title>' + h(nomeNo(n)) + "</title><rect x=\"" + (x - w / 2) + '" y="' + (y - 12) + '" width="' + w + '" height="24" rx="' + (tipo === "folha" ? 12 : 5) + '"/>' +
          '<text x="' + x + '" y="' + (y + 4) + '">' + h(t) + "</text>" +
          (mostraV ? '<text class="rv' + (valNovo[id] ? " r6-rv-novo" : "") + '" x="' + x + '" y="' + (y + 27) + '">↩ ' + h(val[id]) + "</text>" : "") + "</g>";
      });
      E.arv.innerHTML = '<svg viewBox="0 0 ' + larg + " " + alt + '" width="' + larg + '" role="img" aria-label="Árvore sintática abstrata">' + ed + nos + "</svg>" +
        (raizes.length > 1 ? '<div class="r6-soltas">' + (raizes.length - 1) + " subárvore(s) ainda soltas: esperando o Parser pendurar num pai</div>" : "");
      // segue o nó atual; senão o recém-criado; senão o ativo mais fundo da pilha de evaluate()
      var fundo = null, prof2 = -1;
      s.fr.forEach(function (f, d) { if (f.no != null && d > prof2) { prof2 = d; fundo = f.no; } });
      var gFundo = fundo != null ? E.arv.querySelectorAll(".r6-n")[lista.indexOf(fundo)] : null;
      var alvo = E.arv.querySelector(".topo rect") || E.arv.querySelector(".entra rect") || (gFundo && gFundo.querySelector("rect"));
      if (alvo) {
        var ax = parseFloat(alvo.getAttribute("x")), ay = parseFloat(alvo.getAttribute("y"));
        E.arv.scrollLeft = Math.max(0, ax - E.arv.clientWidth / 2 + 30);
        E.arv.scrollTop = Math.max(0, ay - E.arv.clientHeight / 2);
      }
    }

    function codigo(s) {
      var l = LN[s.k], topo = s.fr[s.fr.length - 1];
      E.codH.textContent = topo ? "Código de " + nomeFrame(topo, S.res.trace) : "Código";
      var de = 1, ate = SRC.length;
      if (!S.inteiro && l) { var m = metodoDe(l); if (m) { de = m.de; ate = m.ate; } }
      var chamadores = {};
      if (S.inteiro) s.fr.slice(0, -1).forEach(function (f) { if (LN[f.k]) chamadores[LN[f.k]] = 1; });
      var html = "";
      for (var k = de; k <= ate; k++) {
        var cls = "l" + (k === l ? " on" + (s.erro ? " r6-on-erro" : "") : "") + (chamadores[k] ? " r6-pai" : "");
        html += '<span class="' + cls + '"><span class="ln">' + k + "</span>" + (realce(SRC[k - 1]) || " ") + "</span>";
      }
      E.cod.innerHTML = html;
      var on = E.cod.querySelector(".on");
      if (on) E.cod.scrollTop = Math.max(0, on.offsetTop - E.cod.clientHeight / 2 + 12);
    }

    function fonte(T, s) {
      var txt = S.mostra, hl = s.hl, com = new Uint8Array(txt.length + 1).fill(1);
      if (T.map) T.map.forEach(function (p) { com[p] = 0; }); else com.fill(0);
      var pos = s.pos != null && T.map ? T.map[Math.min(s.pos, T.map.length - 1)] : -1;
      var mostraCaret = s.fase === "lexer" || s.fase === "parser" || (s.fase === "erro" && !s.st);
      var out = "";
      for (var i = 0; i <= txt.length; i++) {
        if (i === pos && mostraCaret) out += '<span class="r6-caret" title="lexer.position"></span>';
        if (i === txt.length) break;
        var c = txt[i], cl = [];
        if (hl && i >= hl[0] && i < hl[1]) cl.push("agora");
        if (com[i]) cl.push("com");
        var ch = c === "\n" ? '<span class="nl">↵</span>\n' : c === "\t" ? "    " : h(c);
        out += cl.length ? '<span class="' + cl.join(" ") + '">' + ch + "</span>" : ch;
      }
      E.fonte.innerHTML = out;
      var a = E.fonte.querySelector(".agora") || E.fonte.querySelector(".r6-caret");
      if (a) E.fonte.scrollTop = Math.max(0, a.offsetTop - E.fonte.offsetTop - E.fonte.clientHeight / 2);
    }

    function tabela(T, s) {
      if (!s.st) { E.st.innerHTML = '<span class="r6-vazio">ainda não existe: a main() só cria a SymbolTable depois do Parser.run()</span>'; return; }
      var nomes = Object.keys(s.st);
      if (!nomes.length) { E.st.innerHTML = '<span class="r6-vazio">vazia</span>'; return; }
      var lendo = s.k === "st_get_ret", escrevendo = /^st_set/.test(s.k);
      E.st.innerHTML = '<table class="r6-tab"><tr><th>nome</th><th>Variable.value</th></tr>' + nomes.map(function (n) {
        var c = n === s.stAlt ? (escrevendo ? "esc" : lendo ? "le" : "") : "";
        return '<tr class="' + c + '"><td>' + h(n) + "</td><td>" + h(s.st[n]) + (c === "esc" ? ' <em>← escrita</em>' : c === "le" ? ' <em>→ lida</em>' : "") + "</td></tr>";
      }).join("") + "</table>";
    }

    function io(T, s) {
      var out = T.out.slice(0, s.nout), nova = /print_out/.test(s.k);
      E.saida.innerHTML = '<span class="lb">Saída (System.out)</span>' + (out.length ? out.map(function (l, k) {
        return k === out.length - 1 && nova ? '<b class="r6-out-novo">' + h(l) + "</b>" : h(l);
      }).join("<br>") : '<span style="color:#6f8b92">(nada impresso ainda)</span>') +
        (s.erro && s.erro.cls ? '<div class="r6-exc">Exception in thread "main" ' + h(s.erro.cls) + ": " + h(s.erro.msg) + "</div>" : "");
      var ls = (S.stdin || "").split(/\r\n|\n/);
      if (/\n$/.test(S.stdin || "")) ls.pop();
      E.stdin.innerHTML = '<span class="lb">stdin</span>' + (S.stdin ? ls.map(function (l, k) {
        return '<span class="' + (k < s.lidos ? "lido" : k === s.lidos ? "prox" : "") + '">' + (h(l) || "&nbsp;") + "</span>";
      }).join("") : '<span class="r6-vazio">vazio (Scanln() vai falhar)</span>');
    }

    function narra(T, s) {
      E.pn.textContent = s.erro ? (s.erro.origem === "Limite" ? "limite" : "erro") : SELO[s.fase] || "passo";
      E.pn.style.background = COR[s.erro ? "erro" : s.fase] || COR.main;
      var tx = h(s.narr);
      if (s.erro && s.erro.cls) {
        var exp = { Lexer: "Erro léxico: o caractere não começa nenhum token.", Parser: "Erro sintático: os tokens existem, mas a ordem não bate com a gramática.", Semantic: "Erro semântico: a escrita está certa, o significado não. Só aparece na execução." }[s.erro.origem] || "Exceção lançada pela própria JVM.";
        tx += '<span class="r6-exp">' + exp + "</span>";
      } else if (S.i === T.steps.length - 1 && !S.res.erro && !S.res.limite) {
        tx += '<span class="r6-exp ok">Terminou sem erro. Saída: ' + (T.out.length ? h(T.out.join(" · ")) : "nada") + "</span>";
      }
      E.tx.innerHTML = tx;
      E.tx.className = "tx r6-tx" + (s.erro ? " erro" : "");
    }

    E.src.value = EXEMPLOS[0][1];
    E.inp.value = EXEMPLOS[0][2];
    compila();
    return { carregar: function (src, stdin) { E.src.value = src; E.inp.value = stdin || ""; compila(); host.scrollIntoView({ behavior: "smooth", block: "start" }); tocar(); } };
  }

  var inst = [];
  Array.prototype.forEach.call(document.querySelectorAll("[data-r6]"), function (el) { inst.push(montar(el)); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-r6-abrir]");
    if (!b || !inst[0]) return;
    inst[0].carregar(b.getAttribute("data-r6-abrir").replace(/\\n/g, "\n"), (b.getAttribute("data-stdin") || "").replace(/\\n/g, "\n"));
  });
})();
