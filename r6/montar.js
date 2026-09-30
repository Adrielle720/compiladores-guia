// Injeta o Roteiro 6 (seção, CSS, link na barra lateral e scripts) no
// index.html, entre marcadores <!-- R6:... -->. Pode rodar quantas vezes
// quiser: ele remove a injeção anterior antes de inserir de novo.
//   node r6/montar.js
const fs = require("fs");
const path = require("path");

const R = __dirname, IDX = path.join(R, "..", "index.html");
let html = fs.readFileSync(IDX, "utf8");
const nl = html.includes("\r\n") ? "\r\n" : "\n";

// 1. tira injeções anteriores
html = html.replace(/<!-- R6:(\w+) -->[\s\S]*?<!-- \/R6:\1 -->\r?\n?/g, "");

// 2. fonte Java do Roteiro 6: tira os marcadores //#chave e monta o mapa
const linhas = {}, src = fs.readFileSync(path.join(R, "Roteiro6.java"), "utf8").replace(/\r\n/g, "\n").split("\n").map((l, i) => {
  const m = /\s*\/\/#(\w+)\s*$/.exec(l);
  if (!m) return l;
  linhas[m[1]] = i + 1;
  return l.replace(/\s*\/\/#\w+\s*$/, "");
}).join("\n");
const js = (s) => s.replace(/<\/(script)/gi, "<\\/$1");

function injeta(ancora, bloco, nome, antes) {
  const i = html.indexOf(ancora);
  if (i < 0) throw new Error("âncora não encontrada para " + nome + ": " + JSON.stringify(ancora.slice(0, 60)));
  const marcado = `<!-- R6:${nome} -->${nl}${bloco}${nl}<!-- /R6:${nome} -->${nl}`;
  html = antes ? html.slice(0, i) + marcado + html.slice(i) : html.slice(0, i + ancora.length) + nl + marcado + html.slice(i + ancora.length);
}

// CSS no fim do <body>, depois do <style> do site, para as sobrescritas valerem
injeta("</body>", "<style>" + nl + fs.readFileSync(path.join(R, "r6.css"), "utf8") + nl + "</style>", "css", true);

// link na barra lateral, logo depois do v1.2
const linkR4 = /<a class="sn-sub[^"]*" href="#r4"[^>]*>.*?<\/a>/.exec(html);
if (!linkR4) throw new Error("link do r4 não encontrado");
injeta(linkR4[0], '        <a class="sn-sub sn-s-err" href="#r6" data-sub="r6"><span class="n">v2.1</span>Roteiro 6 · Java</a>', "nav", false);

// seção logo depois do R4, ainda dentro de .secoes
const fimR4 = /(\r?\n)  <\/div>\r?\n<\/section>\r?\n\r?\n\r?\n<section id="colinha">/.exec(html);
if (!fimR4) throw new Error("fim da seção dos roteiros não encontrado");
html = html.slice(0, fimR4.index + fimR4[1].length) + `<!-- R6:secao -->${nl}` + fs.readFileSync(path.join(R, "secao.html"), "utf8") + `<!-- /R6:secao -->${nl}` + html.slice(fimR4.index + fimR4[1].length);

// scripts no fim do <body>
injeta("</body>",
  "<script>" + nl + js(fs.readFileSync(path.join(R, "motor.js"), "utf8")) + nl + "</script>" + nl +
  "<script>window.R6_FONTE = " + js(JSON.stringify({ src, linhas })) + ";</script>" + nl +
  "<script>" + nl + js(fs.readFileSync(path.join(R, "depurador-r6.js"), "utf8")) + nl + "</script>", "js", true);

fs.writeFileSync(IDX, html);
console.log("ok: Roteiro 6 injetado (" + Object.keys(linhas).length + " linhas marcadas, index.html com " + Math.round(html.length / 1024) + " KB)");
