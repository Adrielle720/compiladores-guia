/* =========================================================================
   PERGUNTAS — interface. <div data-perguntas="r5"></div> mostra
   window.PERGUNTAS.r5 em cartões: pergunta, dica, resposta sob demanda e
   marcação "sei / revisar" (guardada neste navegador).
   ========================================================================= */
(function () {
  "use strict";
  function h(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // texto simples -> HTML (formato descrito em perguntas.js)
  function inline(t) {
    return h(t)
      .replace(/«([^»]*)»/g, '<code class="inl">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/@@(v[\d.]+)\|([\s\S]*?)(?:##([\s\S]*?))?@@/g, function (m, v, prog, stdin) {
        return '<button type="button" class="preset pg-dep" data-versao="' + v + '" data-java-abrir="' + prog + '"' + (stdin ? ' data-stdin="' + stdin + '"' : "") + ">▶ testar no depurador</button>";
      });
  }
  function md(t) {
    var out = [], partes = t.split(/^~~~\s*$/m);
    partes.forEach(function (p, i) {
      if (i % 2 === 1) { out.push('<div class="code pg-code"><pre>' + h(p.replace(/^\n|\n$/g, "")) + "</pre></div>"); return; }
      p.split(/\n{2,}/).forEach(function (bloco) {
        bloco = bloco.replace(/^\n+|\n+$/g, "");
        if (!bloco) return;
        var ls = bloco.split("\n");
        if (ls.every(function (l) { return /^- /.test(l); })) out.push("<ul>" + ls.map(function (l) { return "<li>" + inline(l.slice(2)) + "</li>"; }).join("") + "</ul>");
        else if (/^- /.test(ls[ls.length - 1]) && !/^- /.test(ls[0])) {
          var k = ls.findIndex(function (l) { return /^- /.test(l); });
          out.push("<p>" + inline(ls.slice(0, k).join(" ")) + "</p><ul>" + ls.slice(k).map(function (l) { return "<li>" + inline(l.replace(/^- /, "")) + "</li>"; }).join("") + "</ul>");
        } else out.push("<p>" + inline(ls.join(" ")) + "</p>");
      });
    });
    return out.join("");
  }

  function montar(el, chave) {
    var D = window.PERGUNTAS && window.PERGUNTAS[chave];
    if (!D) { el.textContent = "Sem perguntas para " + chave; return; }
    var CH = "adrielle-perguntas-" + chave, marcas = {};
    try { marcas = JSON.parse(localStorage.getItem(CH) || "{}"); } catch (e) { marcas = {}; }
    function salva() { try { localStorage.setItem(CH, JSON.stringify(marcas)); } catch (e) {} }
    var todos = [];
    D.grupos.forEach(function (g) { g.itens.forEach(function (it, k) { todos.push({ g: g, it: it, id: g.id + "-" + k }); }); });
    var filtro = "todas";

    el.classList.add("pg");
    el.innerHTML =
      '<div class="pg-topo"><div class="pg-prog"><div class="pg-barra"><span class="pg-sei"></span><span class="pg-rev"></span></div><span class="pg-conta"></span></div>' +
      '<div class="pg-filtros" role="group" aria-label="Filtrar perguntas">' +
        '<button type="button" class="preset" data-f="todas" aria-pressed="true">todas · ' + todos.length + "</button>" +
        D.grupos.map(function (g) { return '<button type="button" class="preset" data-f="' + g.id + '" aria-pressed="false">' + h(g.nome) + " · " + g.itens.length + "</button>"; }).join("") +
        '<button type="button" class="preset" data-f="revisar" aria-pressed="false">↺ para revisar</button>' +
        '<button type="button" class="preset" data-f="novas" aria-pressed="false">ainda não marquei</button>' +
      "</div></div>" +
      '<div class="pg-lista">' + todos.map(function (q, n) {
        return '<article class="pg-card' + (q.g.extra ? " pg-extra" : "") + '" data-id="' + q.id + '" data-g="' + q.g.id + '">' +
          '<header><span class="pg-num">' + (n + 1) + '</span><span class="pg-tag">' + h(q.g.nome) + (q.g.extra ? " · extra credit" : "") + "</span></header>" +
          '<div class="pg-p">' + md(q.it.p) + "</div>" +
          (q.it.d ? '<details class="pg-dica"><summary>dica</summary><p>' + inline(q.it.d) + "</p></details>" : "") +
          '<div class="pg-acoes"><button type="button" class="btn pg-ver" aria-expanded="false">Mostrar resposta</button>' +
            '<button type="button" class="btn sei pg-m" data-m="sei">✓ sei</button><button type="button" class="btn revisar pg-m" data-m="rev">↺ revisar</button></div>' +
          '<div class="pg-r" hidden>' + md(q.it.r) + "</div></article>";
      }).join("") + "</div>";

    function pinta() {
      var sei = 0, rev = 0;
      todos.forEach(function (q) {
        var card = el.querySelector('[data-id="' + q.id + '"]'), m = marcas[q.id];
        if (m === "sei") sei++; if (m === "rev") rev++;
        card.classList.toggle("marcou-sei", m === "sei");
        card.classList.toggle("marcou-rev", m === "rev");
        card.hidden = !(filtro === "todas" || filtro === q.g.id || (filtro === "revisar" && m === "rev") || (filtro === "novas" && !m));
      });
      el.querySelector(".pg-sei").style.width = (sei / todos.length * 100) + "%";
      el.querySelector(".pg-rev").style.width = (rev / todos.length * 100) + "%";
      el.querySelector(".pg-conta").textContent = sei + " sei · " + rev + " para revisar · " + (todos.length - sei - rev) + " sem marcar";
    }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b || !el.contains(b)) return;
      if (b.hasAttribute("data-f")) {
        filtro = b.getAttribute("data-f");
        Array.prototype.forEach.call(el.querySelectorAll("[data-f]"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        return pinta();
      }
      var card = b.closest(".pg-card");
      if (b.classList.contains("pg-ver")) {
        var r = card.querySelector(".pg-r"), abre = r.hidden;
        r.hidden = !abre;
        b.textContent = abre ? "Esconder resposta" : "Mostrar resposta";
        b.setAttribute("aria-expanded", abre);
      } else if (b.hasAttribute("data-m")) {
        var id = card.getAttribute("data-id"), m = b.getAttribute("data-m");
        if (marcas[id] === m) delete marcas[id]; else marcas[id] = m;
        salva(); pinta();
      }
    });
    pinta();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-perguntas]"), function (el) { montar(el, el.getAttribute("data-perguntas")); });
})();
