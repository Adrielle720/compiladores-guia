// Injeta os acréscimos da Adrielle no index.html do Oscar, entre marcadores
// <!-- ADR:... -->: as seções dos Roteiros 5 e 6 (Java), o CSS, os links na
// barra lateral, o nome no topo e os scripts. Pode rodar quantas vezes
// quiser: ele remove a injeção anterior antes de inserir de novo.
//   node adrielle/montar.js
//
// Roteiro novo (ex.: 7): crie secao-r7.html com <section id="r7" class="painel">,
// ponha o fonte Java e o mapa de linhas em JAVA_FONTES, as perguntas em
// perguntas.js (PERGUNTAS.r7) e acrescente o roteiro em ROTEIROS abaixo.
const fs = require("fs");
const path = require("path");

const A = __dirname, IDX = path.join(A, "..", "index.html");
const ler = (f) => fs.readFileSync(path.join(A, f), "utf8");
let html = fs.readFileSync(IDX, "utf8");
const nl = html.includes("\r\n") ? "\r\n" : "\n";

const ROTEIROS = [
  { id: "r5", ver: "v2.0", nome: "Roteiro 5 · Java", secao: "secao-r5.html" },
  { id: "r6", ver: "v2.1", nome: "Roteiro 6 · Java", secao: "secao-r6.html" }
];

// 1. tira injeções anteriores (inclusive as antigas, com prefixo R6)
html = html.replace(/<!-- (?:ADR|R6):(\w+) -->[\s\S]*?<!-- \/(?:ADR|R6):\1 -->\r?\n?/g, "");

// 2. fontes Java de cada versão + mapa chave -> linha
function comMarcadores(arquivo) {  // arquivo com //#chave nas linhas
  const linhas = {};
  const src = ler(arquivo).replace(/\r\n/g, "\n").split("\n").map((l, i) => {
    const m = /\s*\/\/#(\w+)\s*$/.exec(l);
    if (!m) return l;
    linhas[m[1]] = i + 1;
    return l.replace(/\s*\/\/#\w+\s*$/, "");
  }).join("\n");
  return { src, linhas };
}
const JAVA_FONTES = {
  // o main.java do Roteiro 5 é o original, sem marcadores: o mapa vem de marcas-r5.json
  "v2.0": { src: ler("Roteiro5.java").replace(/\r\n/g, "\n"), linhas: JSON.parse(ler("marcas-r5.json")) },
  "v2.1": comMarcadores("Roteiro6.java")
};
const js = (s) => s.replace(/<\/(script)/gi, "<\\/$1");

function injeta(ancora, bloco, nome, antes) {
  const i = html.indexOf(ancora);
  if (i < 0) throw new Error("âncora não encontrada para " + nome + ": " + JSON.stringify(ancora.slice(0, 60)));
  const marcado = `<!-- ADR:${nome} -->${nl}${bloco}${nl}<!-- /ADR:${nome} -->${nl}`;
  html = antes ? html.slice(0, i) + marcado + html.slice(i) : html.slice(0, i + ancora.length) + nl + marcado + html.slice(i + ancora.length);
}

// 3. nome no topo
html = html.replace(/<span class="profile-name">Espaço d[oa] [^<]*<\/span>/, '<span class="profile-name">Espaço da Adrielle</span>');
html = html.replace(/<span class="profile">O<span class="profile-name">/, '<span class="profile">A<span class="profile-name">');

// 4. CSS no fim do <body>, depois do <style> do site, para as sobrescritas valerem
injeta("</body>", "<style>" + nl + ler("estilo.css") + nl + "</style>", "css", true);

// 5. links na barra lateral, logo depois do v1.2
const linkR4 = /<a class="sn-sub[^"]*" href="#r4"[^>]*>.*?<\/a>/.exec(html);
if (!linkR4) throw new Error("link do r4 não encontrado");
injeta(linkR4[0], ROTEIROS.map((r) => `        <a class="sn-sub sn-s-err" href="#${r.id}" data-sub="${r.id}"><span class="n">${r.ver}</span>${r.nome}</a>`).join(nl), "nav", false);

// 6. seções logo depois do R4, ainda dentro de .secoes
const fimR4 = /(\r?\n)  <\/div>\r?\n<\/section>\r?\n\r?\n\r?\n<section id="colinha">/.exec(html);
if (!fimR4) throw new Error("fim da seção dos roteiros não encontrado");
const secoes = ROTEIROS.map((r) => ler(r.secao)).join(nl);
html = html.slice(0, fimR4.index + fimR4[1].length) + `<!-- ADR:secoes -->${nl}` + secoes + `<!-- /ADR:secoes -->${nl}` + html.slice(fimR4.index + fimR4[1].length);

// 7. scripts no fim do <body>
injeta("</body>",
  "<script>" + nl + js(ler("motor.js")) + nl + "</script>" + nl +
  "<script>window.JAVA_FONTES = " + js(JSON.stringify(JAVA_FONTES)) + ";</script>" + nl +
  "<script>" + nl + js(ler("depurador.js")) + nl + "</script>" + nl +
  "<script>" + nl + js(ler("perguntas.js")) + nl + "</script>" + nl +
  "<script>" + nl + js(ler("perguntas-ui.js")) + nl + "</script>", "js", true);

fs.writeFileSync(IDX, html);
const nPerg = (ler("perguntas.js").match(/\{ p: /g) || []).length;
console.log("ok: " + ROTEIROS.map((r) => r.id).join(", ") + " injetados · " + nPerg + " perguntas · index.html com " + Math.round(html.length / 1024) + " KB");
