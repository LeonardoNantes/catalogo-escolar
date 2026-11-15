// ============================================================
// MATERIAL ESCOLAR — página do cliente final
// ============================================================
// Cópia do "Ofertas da Semana" adaptada: lê a tabela escolar_itens (fica
// no ar o ano todo, sem período de semana), mostra o código de barras em
// destaque e usa as cores do Material Escolar. Fotos vêm do mesmo banco do
// Ofertas da Semana (ofertas_fotos, por código Martins).
// Um site só pra todos os vendedores — sem repositório por pessoa. O
// vendedor é identificado pelo parâmetro "v" na URL (o slug cadastrado no
// Painel de Vendedores, na marca "Material Escolar"); os dados dele
// (nome, foto, WhatsApp, área) vêm do Supabase na hora que a página abre.

// ---------------- CATEGORIAS: cor e ícone ----------------
const CATEGORIAS_INFO = {
  "Borrachas e Apontadores": { bg: "#FCE9EE", fg: "#B0345A" },
  "Canetas": { bg: "#E4ECFA", fg: "#1E4FA3" },
  "Canetinhas e Marcadores": { bg: "#EFE6F8", fg: "#6B3FA0" },
  "Cola, Tesoura e Mais": { bg: "#E6F4EE", fg: "#1D7A55" },
  "Estojos e Mochilas": { bg: "#E2F1F6", fg: "#1A6E86" },
  "Lápis de Cor e Giz": { bg: "#FDEBE2", fg: "#B4481F" },
  "Lápis e Lapiseiras": { bg: "#FFF6D6", fg: "#8A6A00" },
  "Cad. 1/4": { bg: "#E8F3FC", fg: "#1C5F94" },
  "Cad. 1 Matéria Cost.": { bg: "#EAF0FB", fg: "#2A4F8F" },
  "Cad. 1 Matéria Espiral": { bg: "#E6EEFA", fg: "#24519A" },
  "Cad. 10 Matérias": { bg: "#ECEBFA", fg: "#4A40A0" },
  "Cad. 12 a 20 Matérias": { bg: "#F1E9FA", fg: "#6A3B9E" },
  "Cad. Desenho e Cartografia": { bg: "#FFF0E3", fg: "#A4561A" },
  "Outros": { bg: "#ECECEA", fg: "#5E5D59" },
};
const ORDEM_CATEGORIAS = Object.keys(CATEGORIAS_INFO);

function infoCategoria(categoria) {
  return CATEGORIAS_INFO[categoria] || CATEGORIAS_INFO["Outros"];
}

// Ícone de lápis pra qualquer categoria (só aparece em item ainda sem foto).
function iconeCategoria(categoria, cor) {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"></path></svg>`;
}

// ---------------- SUPABASE ----------------
let _client = null;
function getClient() {
  if (_client) return _client;
  _client = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
  return _client;
}

// ---------------- TROCA DE TELA ----------------
const ESTADOS = ["tela-carregando", "tela-erro", "tela-pausado", "tela-vazio", "app", "tela-carrinho"];
function mostrarEstado(id) {
  ESTADOS.forEach((e) => { document.getElementById(e).hidden = e !== id; });
}

function pegarSlugDaUrl() {
  return new URLSearchParams(window.location.search).get("v");
}

// Grava uma linha toda vez que o link é aberto (mesma tabela de todos os
// catálogos — é dela que o Painel de Vendedores tira a tela de acessos) — é o que permite o
// Leonardo ver depois quais vendedores usam mais essa ferramenta. Não
// trava a navegação se falhar.
async function registrarVisita(slug) {
  // O registro agora passa por uma função no servidor (api/registrar-acesso),
  // que lê o IP real de quem acessou - o navegador não insere mais direto
  // no Supabase. O IP ajuda, mais pra frente, a tentar diferenciar o
  // próprio vendedor dos clientes dele nos acessos.
  try {
    await fetch(`/api/registrar-acesso?v=${encodeURIComponent(slug)}`);
  } catch (erro) {
    console.error("[Material Escolar] Não consegui registrar a visita:", erro);
  }
}

async function buscarVendedor(slug) {
  const { data, error } = await getClient()
    .from("vendedores")
    .select("nome, area, whatsapp, foto_url, ativo")
    .eq("slug", slug)
    .eq("marca", "Material Escolar")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Todos os itens de Material Escolar publicados pra área do vendedor (sem
// período de semana — o catálogo fica no ar o ano todo). Busca em blocos
// de 1000 porque o Supabase entrega no máximo 1000 linhas por vez.
async function buscarItensEscolar(area) {
  const itens = [];
  const bloco = 1000;
  for (let inicio = 0; ; inicio += bloco) {
    const { data, error } = await getClient()
      .from("escolar_itens")
      .select("codigo, codigo_barras, descricao, categoria, preco, ordem")
      .eq("area", area)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .range(inicio, inicio + bloco - 1);
    if (error) throw error;
    itens.push(...(data || []));
    if (!data || data.length < bloco) break;
  }
  return anexarFotosDosProdutos(itens);
}

// Produtos que já tiverem foto cadastrada (banco de fotos, por código
// Martins) mostram a foto de verdade no lugar do ícone da categoria.
async function anexarFotosDosProdutos(itens) {
  if (itens.length === 0) return itens;
  try {
    // Em blocos de 200 códigos, pra o endereço da consulta não ficar
    // grande demais quando o catálogo crescer.
    const codigos = itens.map((i) => i.codigo);
    const fotoPorCodigo = new Map();
    for (let i = 0; i < codigos.length; i += 200) {
      const { data, error } = await getClient()
        .from("ofertas_fotos")
        .select("codigo, foto_url")
        .in("codigo", codigos.slice(i, i + 200));
      if (error) throw error;
      (data || []).forEach((f) => { if (f.foto_url) fotoPorCodigo.set(f.codigo, f.foto_url); });
    }
    return itens.map((item) => ({ ...item, foto_url: fotoPorCodigo.get(item.codigo) || null }));
  } catch (erro) {
    console.error("[Material Escolar] Não consegui buscar as fotos dos produtos:", erro);
    return itens;
  }
}

function formatarDataCurta(dataISO) {
  if (!dataISO) return "";
  const [, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}`;
}

function formatarPreco(valor) {
  return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

// Só o número, sem o "R$" na frente — usado nos cartões do PNG/PDF, onde
// o "R$" já aparece separado, como um rótulo pequeno em cima do preço.
function formatarPrecoSemPrefixo(valor) {
  return Number(valor).toFixed(2).replace(".", ",");
}

// ---------------- ESTADO DA PÁGINA (interesse / quantidade) ----------------
const QTY = new Map(); // codigo -> quantidade
let TODOS_ITENS = [];
let CATEGORIA_ATIVA = null; // não existe mais aba "Todos" — definida em iniciar() pra primeira aba do grupo
let GRUPO_ATIVO = "escolar"; // "escolar", "escrita" ou "cadernos" — mesmos grupos que o Martins usa
let ORDEM_PRECO = ""; // "" = padrão, "menor" ou "maior" — só vale pra aba aberta
let BUSCA = ""; // texto da busca (lupa) — já normalizado, vazio = sem busca
let VENDEDOR_WHATSAPP = null;
let AREA_VENDEDOR = "SC";
let VENDEDOR_FOTO_URL = null;

// ---------------- ITENS MARCADOS GUARDADOS NO CELULAR ----------------
// Os itens de interesse ficam guardados no próprio navegador do cliente
// (um "cantinho" por vendedor), pra não sumirem se a página recarregar ou
// se ele sair pra atender uma ligação e voltar. Guarda só código +
// quantidade — o preço sempre vem atualizado do banco, e item que saiu do
// catálogo é ignorado ao carregar. Não expira sozinho (decisão do
// Leonardo): fica até o cliente limpar.
// Depois de tocar em "Enviar interesse", marca a hora do envio; quando o
// cliente volta pra página, pergunta se já enviou e se quer limpar.
let CHAVE_GUARDADOS = null; // definida no iniciar(), por vendedor
let ENVIADO_EM = null;      // hora do último "Enviar interesse" (ou null)

function salvarItensMarcados() {
  if (!CHAVE_GUARDADOS) return;
  try {
    const itens = {};
    QTY.forEach((q, codigo) => { if (q > 0) itens[codigo] = q; });
    if (Object.keys(itens).length === 0) {
      localStorage.removeItem(CHAVE_GUARDADOS);
      ENVIADO_EM = null;
      return;
    }
    localStorage.setItem(CHAVE_GUARDADOS, JSON.stringify({ itens, enviadoEm: ENVIADO_EM }));
  } catch (erro) {
    // Navegador sem espaço/privado: segue funcionando, só não guarda.
  }
}

function carregarItensMarcados() {
  if (!CHAVE_GUARDADOS) return;
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_GUARDADOS) || "null");
    if (!salvo || !salvo.itens) return;
    const codigosNoCatalogo = new Set(TODOS_ITENS.map((i) => String(i.codigo)));
    Object.entries(salvo.itens).forEach(([codigo, q]) => {
      const qtd = Math.floor(Number(q));
      if (codigosNoCatalogo.has(codigo) && qtd > 0) QTY.set(codigo, qtd);
    });
    ENVIADO_EM = salvo.enviadoEm || null;
    salvarItensMarcados(); // limpa do guardado o que saiu do catálogo
  } catch (erro) {
    // Guardado corrompido: ignora e começa do zero.
  }
}

function totalItensMarcados() {
  return Array.from(QTY.values()).filter((q) => q > 0).length;
}

// Qualquer mudança nos itens marcados depois de um envio quer dizer que o
// cliente continuou montando — a pergunta "já enviou?" deixa de fazer sentido.
function aposMudarItens() {
  ENVIADO_EM = null;
  salvarItensMarcados();
  renderizarItens();
  atualizarRodape();
}

function inc(codigo) {
  QTY.set(codigo, (QTY.get(codigo) || 0) + 1);
  aposMudarItens();
}
function dec(codigo) {
  QTY.set(codigo, Math.max(0, (QTY.get(codigo) || 0) - 1));
  aposMudarItens();
}
function toggleInteresse(codigo) {
  const atual = QTY.get(codigo) || 0;
  QTY.set(codigo, atual > 0 ? 0 : 1);
  aposMudarItens();
}

function limparItensMarcados() {
  QTY.clear();
  aposMudarItens();
}

// Caixinha de pergunta da própria página (no lugar do confirm() do
// navegador, que no celular fica feio e às vezes é bloqueado).
function perguntar(texto, rotuloSim, rotuloNao) {
  return new Promise((resolve) => {
    const fundo = document.getElementById("dialogo-fundo");
    document.getElementById("dialogo-texto").textContent = texto;
    const sim = document.getElementById("dialogo-sim");
    const nao = document.getElementById("dialogo-nao");
    sim.textContent = rotuloSim;
    nao.textContent = rotuloNao;
    fundo.hidden = false;
    const fechar = (resposta) => {
      fundo.hidden = true;
      sim.onclick = null;
      nao.onclick = null;
      resolve(resposta);
    };
    sim.onclick = () => fechar(true);
    nao.onclick = () => fechar(false);
  });
}

document.getElementById("btn-limpar-itens").addEventListener("click", async () => {
  const total = totalItensMarcados();
  if (total === 0) return;
  const ok = await perguntar(
    `Desmarcar ${total === 1 ? "o item marcado" : `todos os ${total} itens marcados`}?`,
    "Sim, desmarcar",
    "Cancelar"
  );
  if (ok) {
    limparItensMarcados();
    if (!document.getElementById("tela-carrinho").hidden) renderizarCarrinho();
  }
});

// Quando o cliente volta pra página depois de ter tocado em "Enviar
// interesse" (voltou do WhatsApp, ou abriu o link de novo), pergunta se já
// enviou. Espera alguns segundos depois do envio pra não perguntar na hora
// em que o WhatsApp ainda está abrindo.
let PERGUNTA_ENVIO_ABERTA = false;
async function perguntarSeJaEnviou() {
  if (!ENVIADO_EM || PERGUNTA_ENVIO_ABERTA || totalItensMarcados() === 0) return;
  if (Date.now() - ENVIADO_EM < 4000) return;
  PERGUNTA_ENVIO_ABERTA = true;
  const limpar = await perguntar(
    "Você já enviou esses itens pelo WhatsApp? Quer limpar a seleção pra começar de novo?",
    "Sim, limpar",
    "Não, manter"
  );
  PERGUNTA_ENVIO_ABERTA = false;
  if (limpar) {
    limparItensMarcados();
  } else {
    ENVIADO_EM = null;
    salvarItensMarcados();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") perguntarSeJaEnviou();
});

// Desliza a barra de abas sozinha pra deixar a aba escolhida no meio da
// tela — assim as próximas categorias aparecem sem precisar arrastar.
function centralizarAbaAtiva(nav) {
  const ativa = nav.querySelector(".categoria-tab.ativa");
  if (!ativa) return;
  const caixaNav = nav.getBoundingClientRect();
  const caixaAba = ativa.getBoundingClientRect();
  const alvo = nav.scrollLeft + (caixaAba.left - caixaNav.left) - (nav.clientWidth - caixaAba.width) / 2;
  nav.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
}

// Ordem das abas definida pelo Leonardo (coluna "ordem" da tabela
// escolar_categorias). Categoria sem posição vai pro fim, em ordem alfabética.
let ORDEM_ABAS_BANCO = new Map();
async function carregarOrdemCategorias() {
  try {
    const { data, error } = await getClient().from("escolar_categorias").select("nome, ordem");
    if (error) throw error;
    ORDEM_ABAS_BANCO = new Map((data || []).map((c) => [c.nome, c.ordem]));
  } catch (erro) {
    console.error("[Material Escolar] Não consegui carregar a ordem das abas:", erro);
  }
}
function compararCategorias(a, b) {
  const oa = ORDEM_ABAS_BANCO.has(a) ? ORDEM_ABAS_BANCO.get(a) : 1000;
  const ob = ORDEM_ABAS_BANCO.has(b) ? ORDEM_ABAS_BANCO.get(b) : 1000;
  return oa !== ob ? oa - ob : a.localeCompare(b, "pt-BR");
}

// ---------------- GRUPOS: Escolar / Escrita / Cadernos ----------------
// Mesmos grupos que o Martins usa (Material escolar / Instrumento para
// escrita / Caderno). Cadernos é automático: toda aba que começa com
// "Cad." vai pra lá. Escrita é a lista fixa abaixo. Todo o resto (inclusive
// uma aba nova criada no Painel de Preços) cai em "Escolar".
const ABAS_GRUPO_ESCRITA = ["Canetas", "Canetinhas e Marcadores", "Lápis de Cor e Giz", "Lápis e Lapiseiras"];
const ORDEM_GRUPOS = ["escolar", "escrita", "cadernos"];
function grupoDaCategoria(categoria) {
  if (/^Cad\./i.test(categoria || "")) return "cadernos";
  if (ABAS_GRUPO_ESCRITA.includes(categoria)) return "escrita";
  return "escolar";
}
function categoriasOrdenadasPresentes() {
  return Array.from(new Set(TODOS_ITENS.map((i) => i.categoria)))
    .filter(Boolean)
    .sort(compararCategorias);
}
function categoriasDoGrupo(grupo) {
  return categoriasOrdenadasPresentes().filter((c) => grupoDaCategoria(c) === grupo);
}
function renderizarAbasGrupo() {
  document.querySelectorAll(".aba-grupo").forEach((btn) => {
    btn.classList.toggle("ativa", btn.dataset.grupo === GRUPO_ATIVO);
    // Grupo sem nenhum item publicado nessa área nem aparece.
    btn.hidden = categoriasDoGrupo(btn.dataset.grupo).length === 0;
  });
}

function renderizarAbas() {
  // Mostra aba pra qualquer categoria que tiver item de verdade — não só
  // as 10 fixas de CATEGORIAS_INFO — pra categoria nova criada no Painel
  // de Preços também aparecer aqui (ela só não tem cor/ícone específicos,
  // usa o visual genérico de "Outros" via infoCategoria/iconeCategoria).
  // Em ordem alfabética.
  // Só as abas do grupo (Escolar/Escrita/Cadernos) escolhido na faixa de cima.
  const abas = categoriasDoGrupo(GRUPO_ATIVO).map((c) => ({ key: c, label: c }));

  const nav = document.getElementById("categoria-tabs");
  // Guarda onde a barra estava antes de redesenhar (redesenhar zera a
  // rolagem) pra o deslize até a aba nova começar do lugar certo.
  const rolagemAnterior = nav.scrollLeft;
  nav.innerHTML = abas
    .map((a) => `<button type="button" class="categoria-tab${a.key === CATEGORIA_ATIVA ? " ativa" : ""}" data-key="${escapeAttr(a.key)}">${escapeHtml(a.label)}</button>`)
    .join("");
  nav.scrollLeft = rolagemAnterior;
  centralizarAbaAtiva(nav);
  nav.querySelectorAll(".categoria-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      CATEGORIA_ATIVA = btn.dataset.key;
      // A ordem por preço vale só pra aba que está aberta: trocou de aba, volta ao padrão.
      ORDEM_PRECO = "";
      // Tocar numa aba durante a busca sai da busca e mostra a categoria.
      if (BUSCA || !document.getElementById("barra-busca").hidden) {
        const campo = document.getElementById("campo-busca");
        campo.value = "";
        BUSCA = "";
        document.getElementById("barra-busca").hidden = true;
        document.getElementById("btn-busca").classList.remove("ativo");
        nav.classList.remove("em-busca");
      }
      renderizarAbas();
      renderizarItens();
      // Ao trocar de aba, volta a rolagem pro início — senão a lista nova
      // abre no meio, na mesma posição em que a aba anterior tinha ficado.
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  });
}

// ---------------- BUSCA (lupa) ----------------
// Procura em TODAS as categorias de uma vez, pelo nome, código Martins ou
// código de barras. Ignora acento e maiúscula/minúscula ("lapis" acha
// "LÁPIS"). Com várias palavras, o item precisa ter todas (em qualquer
// ordem): "faber 24" acha "LAPIS COR FABER CASTELL 24 CORES".
function normalizarBusca(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function itemBateComBusca(item, busca) {
  const alvo = `${normalizarBusca(item.descricao)} ${item.codigo} ${item.codigo_barras || ""}`;
  return busca.split(/\s+/).every((palavra) => alvo.includes(palavra));
}

function abrirBusca() {
  document.getElementById("barra-busca").hidden = false;
  document.getElementById("btn-busca").classList.add("ativo");
  document.getElementById("campo-busca").focus();
}

function fecharBusca() {
  const campo = document.getElementById("campo-busca");
  campo.value = "";
  campo.blur();
  BUSCA = "";
  document.getElementById("barra-busca").hidden = true;
  document.getElementById("btn-busca").classList.remove("ativo");
  document.getElementById("categoria-tabs").classList.remove("em-busca");
  renderizarItens();
}

// ---------------- ORDENAR POR PREÇO ----------------
// Ícone de ordenar + menu (igual ao Nadir e ao Ofertas da Semana)
function atualizarBotaoOrdenar() {
  document.getElementById("btn-ordenar").classList.toggle("ativo", !!ORDEM_PRECO);
  document.querySelectorAll("#menu-ordenar button").forEach((btn) => {
    btn.classList.toggle("selecionada", (btn.dataset.ordenacao || "") === ORDEM_PRECO);
  });
}
{
  const menuOrdenar = document.getElementById("menu-ordenar");
  document.getElementById("btn-ordenar").addEventListener("click", (e) => {
    e.stopPropagation();
    menuOrdenar.hidden = !menuOrdenar.hidden;
  });
  menuOrdenar.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      ORDEM_PRECO = btn.dataset.ordenacao || "";
      menuOrdenar.hidden = true;
      renderizarItens();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  });
  // Com o menu aberto, tocar fora só fecha o menu (não soma "+" sem querer).
  document.addEventListener("click", (e) => {
    if (!menuOrdenar.hidden && !menuOrdenar.contains(e.target)) {
      menuOrdenar.hidden = true;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

// Abas de grupo (Escolar / Escrita / Cadernos)
document.querySelectorAll(".aba-grupo").forEach((btn) => {
  btn.addEventListener("click", () => {
    const grupo = btn.dataset.grupo;
    if (grupo === GRUPO_ATIVO) return;
    GRUPO_ATIVO = grupo;
    CATEGORIA_ATIVA = categoriasDoGrupo(GRUPO_ATIVO)[0] || null;
    ORDEM_PRECO = "";
    // Tocar num grupo durante a busca sai da busca.
    if (BUSCA || !document.getElementById("barra-busca").hidden) {
      const campo = document.getElementById("campo-busca");
      campo.value = "";
      BUSCA = "";
      document.getElementById("barra-busca").hidden = true;
      document.getElementById("btn-busca").classList.remove("ativo");
      document.getElementById("categoria-tabs").classList.remove("em-busca");
    }
    renderizarAbasGrupo();
    renderizarAbas();
    renderizarItens();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
});

// ---------------- FOTO AMPLIADA ----------------
// Tocar na foto abre ela maior por cima da tela; o catálogo continua atrás,
// no mesmo lugar. Fecha tocando fora da foto ou no X.
function abrirFotoAmpliada(url) {
  const img = document.getElementById("foto-zoom-img");
  img.src = url;
  document.getElementById("foto-zoom-fundo").hidden = false;
}
function fecharFotoAmpliada() {
  document.getElementById("foto-zoom-fundo").hidden = true;
  document.getElementById("foto-zoom-img").removeAttribute("src");
}
document.getElementById("lista-itens").addEventListener("click", (e) => {
  const foto = e.target.closest(".item-icone.tem-foto");
  if (foto) abrirFotoAmpliada(foto.dataset.foto);
});
document.getElementById("foto-zoom-fundo").addEventListener("click", (e) => {
  if (e.target.id === "foto-zoom-fundo" || e.target.id === "foto-zoom-fechar") fecharFotoAmpliada();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("foto-zoom-fundo").hidden) fecharFotoAmpliada();
});

document.getElementById("btn-busca").addEventListener("click", () => {
  if (document.getElementById("barra-busca").hidden) abrirBusca();
  else fecharBusca();
});
document.getElementById("btn-fechar-busca").addEventListener("click", fecharBusca);
document.getElementById("campo-busca").addEventListener("input", (e) => {
  BUSCA = normalizarBusca(e.target.value);
  document.getElementById("categoria-tabs").classList.toggle("em-busca", !!BUSCA);
  renderizarItens();
  window.scrollTo({ top: 0, behavior: "instant" });
});
// "Enter"/"Buscar" do teclado do celular só fecha o teclado (a lista já filtrou).
document.getElementById("campo-busca").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.target.blur();
});

function renderizarItens() {
  const lista = document.getElementById("lista-itens");
  const itensFiltrados = TODOS_ITENS
    .filter((i) => (BUSCA ? itemBateComBusca(i, BUSCA) : i.categoria === CATEGORIA_ATIVA))
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
  // Ordenar por preço (só nas abas — a busca da lupa fica sempre no padrão).
  if (ORDEM_PRECO && !BUSCA) {
    itensFiltrados.sort((a, b) => (ORDEM_PRECO === "menor" ? 1 : -1) * ((Number(a.preco) || 0) - (Number(b.preco) || 0)));
  }
  atualizarBotaoOrdenar();
  document.getElementById("ordenar-wrap").hidden = !!BUSCA;

  if (itensFiltrados.length === 0) {
    lista.innerHTML = BUSCA
      ? `<p class="sem-itens">Nenhum produto encontrado para "${escapeHtml(document.getElementById("campo-busca").value.trim())}".</p>`
      : '<p class="sem-itens">Nenhum item nessa categoria.</p>';
    return;
  }

  const resumoBusca = BUSCA
    ? `<p class="busca-resumo">${itensFiltrados.length} ${itensFiltrados.length === 1 ? "produto encontrado" : "produtos encontrados"} em todas as categorias</p>`
    : "";

  lista.innerHTML = resumoBusca + itensFiltrados
    .map((item) => {
      const info = infoCategoria(item.categoria);
      const qty = QTY.get(item.codigo) || 0;
      const interessado = qty > 0;
      return `
        <div class="item-card" style="background: ${info.bg};">
          <div class="item-icone${item.foto_url ? " tem-foto" : ""}"${item.foto_url ? ` data-foto="${escapeAttr(item.foto_url)}"` : ""}>${item.foto_url ? `<img class="item-foto-miniatura" src="${escapeAttr(item.foto_url)}" alt="" loading="lazy">` : iconeCategoria(item.categoria, info.fg)}</div>
          <div class="item-corpo">
            <div class="item-descricao">${escapeHtml(item.descricao)}</div>
            <div class="item-codigos-linha">
              <span class="item-cod">Cód. ${escapeHtml(item.codigo)}</span>
              ${item.codigo_barras ? `<div class="item-barras"><svg width="14" height="11" viewBox="0 0 14 11" aria-hidden="true"><path d="M0 0h1v11H0zM2 0h2v11H2zM5 0h1v11H5zM7 0h1v11H7zM9 0h2v11H9zM12 0h2v11h-2z" fill="currentColor"/></svg><span>${escapeHtml(item.codigo_barras)}</span></div>` : ""}
            </div>
            <div class="item-acao-linha">
              <div class="item-preco">${formatarPreco(item.preco)}</div>
              ${interessado
                ? `<div class="item-qty" data-codigo="${escapeAttr(item.codigo)}">
                     <button type="button" class="btn-dec" aria-label="Diminuir quantidade">−</button>
                     <div class="qty-valor">${qty}</div>
                     <button type="button" class="btn-inc" aria-label="Aumentar quantidade">+</button>
                   </div>`
                : `<button type="button" class="item-interesse-pill" data-codigo="${escapeAttr(item.codigo)}">Tenho interesse</button>`}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  lista.querySelectorAll(".item-qty").forEach((el) => {
    const codigo = el.dataset.codigo;
    el.querySelector(".btn-dec").addEventListener("click", () => dec(codigo));
    el.querySelector(".btn-inc").addEventListener("click", () => inc(codigo));
  });
  lista.querySelectorAll(".item-interesse-pill").forEach((btn) => {
    btn.addEventListener("click", () => toggleInteresse(btn.dataset.codigo));
  });
}

function atualizarRodape() {
  const btn = document.getElementById("btn-ir-carrinho");
  const totalItens = totalItensMarcados();
  const tem = totalItens > 0;
  btn.textContent = tem ? `Ir para o carrinho (${totalItens} ${totalItens === 1 ? "item" : "itens"})` : "Nenhum item selecionado";
  btn.disabled = !tem;
  ["btn-gerar-pdf", "btn-gerar-png", "btn-pdf-pedido", "btn-limpar-itens"].forEach((id) => {
    document.getElementById(id).disabled = !tem;
  });
}

// ---------------- TELA DO CARRINHO ----------------
// Itens marcados agrupados por categoria, na mesma ordem das abas.
function agruparCarrinhoPorCategoria() {
  const itensMarcados = TODOS_ITENS.filter((i) => (QTY.get(i.codigo) || 0) > 0);
  const porCategoria = new Map();
  itensMarcados.forEach((item) => {
    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
    porCategoria.get(item.categoria).push(item);
  });
  return Array.from(porCategoria.keys()).sort(compararCategorias).map((categoria) => ({
    categoria,
    itens: porCategoria.get(categoria).sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
  }));
}

function renderizarCarrinho() {
  const lista = document.getElementById("lista-carrinho");
  const grupos = agruparCarrinhoPorCategoria();
  if (grupos.length === 0) {
    lista.innerHTML = `
      <div class="carrinho-vazio">
        <span class="carrinho-vazio-icone">🛒</span>
        <p>Seu carrinho está vazio.<br>Volte e marque os itens que te interessam.</p>
      </div>
    `;
    return;
  }
  lista.innerHTML = grupos.map((grupo) => {
    const linhasItens = grupo.itens.map((item) => {
      const qty = QTY.get(item.codigo) || 0;
      return `
        <div class="carrinho-item-linha">
          <div class="carrinho-item-info">
            <p class="carrinho-item-nome">${escapeHtml(item.descricao)}</p>
            <p class="carrinho-item-codigo">Cód. ${escapeHtml(item.codigo)}${item.codigo_barras ? ` • Barras ${escapeHtml(item.codigo_barras)}` : ""}</p>
            <p class="carrinho-item-preco">${formatarPreco(item.preco)} cada</p>
          </div>
          <div class="item-qty" data-codigo="${escapeAttr(item.codigo)}">
            <button type="button" class="btn-dec" aria-label="Diminuir quantidade">−</button>
            <div class="qty-valor">${qty}</div>
            <button type="button" class="btn-inc" aria-label="Aumentar quantidade">+</button>
          </div>
        </div>
      `;
    }).join("");
    return `
      <div class="grupo-carrinho">
        <div class="grupo-carrinho-titulo">${escapeHtml(grupo.categoria)}</div>
        <div class="grupo-carrinho-itens">${linhasItens}</div>
      </div>
    `;
  }).join("");
  lista.querySelectorAll(".item-qty").forEach((el) => {
    const codigo = el.dataset.codigo;
    el.querySelector(".btn-dec").addEventListener("click", () => { dec(codigo); renderizarCarrinho(); });
    el.querySelector(".btn-inc").addEventListener("click", () => { inc(codigo); renderizarCarrinho(); });
  });
}

function abrirCarrinho() {
  renderizarCarrinho();
  mostrarEstado("tela-carrinho");
  window.scrollTo({ top: 0, behavior: "instant" });
}
function voltarDoCarrinho() {
  renderizarItens();
  mostrarEstado("app");
}

// Agrupa por categoria (ordem alfabética) e ordena os itens de cada
// categoria também em ordem alfabética — mesma lógica usada na mensagem
// do WhatsApp, reaproveitada aqui pro PDF.
function agruparPorCategoriaOrdenado(itens) {
  const porCategoria = new Map();
  itens.forEach((item) => {
    if (!porCategoria.has(item.categoria)) porCategoria.set(item.categoria, []);
    porCategoria.get(item.categoria).push(item);
  });
  const categoriasOrdenadas = Array.from(porCategoria.keys()).sort(compararCategorias);
  return categoriasOrdenadas.map((categoria) => ({
    categoria,
    itens: porCategoria.get(categoria).sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
  }));
}

// Carrega a foto do produto (URL do Supabase) como base64, porque o jsPDF
// só consegue inserir imagem já em base64 — não aceita link direto.
async function carregarImagemComoDataUrl(url) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(leitor.result);
      leitor.onerror = () => reject(new Error("Falha ao ler imagem"));
      leitor.readAsDataURL(blob);
    });
  } catch (erro) {
    console.error("[Material Escolar] Não consegui carregar imagem pro PDF:", erro);
    return null;
  }
}

function formatoDaImagem(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

// Caminho de retângulo arredondado no canvas (mesmo visual dos cartões do PDF).
function desenharRetanguloArredondado(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + largura - raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + raio, raio);
  ctx.lineTo(x + largura, y + altura - raio);
  ctx.arcTo(x + largura, y + altura, x + largura - raio, y + altura, raio);
  ctx.lineTo(x + raio, y + altura);
  ctx.arcTo(x, y + altura, x, y + altura - raio, raio);
  ctx.lineTo(x, y + raio);
  ctx.arcTo(x, y, x + raio, y, raio);
  ctx.closePath();
}

// Desenha a foto preenchendo todo o espaço (largura x altura) sem esticar/
// deformar — corta as sobras da foto original, igual o "preencher" do
// Instagram, em vez de espremer a imagem pra caber.
function desenharImagemPreenchendo(ctx, img, x, y, largura, altura) {
  const razaoAlvo = largura / altura;
  const razaoFoto = img.width / img.height;
  let sx = 0, sy = 0, sLargura = img.width, sAltura = img.height;
  if (razaoFoto > razaoAlvo) {
    // Foto mais "larga" que o espaço: corta as laterais.
    sLargura = img.height * razaoAlvo;
    sx = (img.width - sLargura) / 2;
  } else {
    // Foto mais "alta" que o espaço: corta em cima/embaixo.
    sAltura = img.width / razaoAlvo;
    sy = (img.height - sAltura) / 2;
  }
  ctx.drawImage(img, sx, sy, sLargura, sAltura, x, y, largura, altura);
}

// Quebra um texto em até "maxLinhas" linhas que cabem em "larguraMax" (usa a
// fonte já configurada no ctx), cortando com "…" se sobrar texto.
function quebrarTextoCanvas(ctx, texto, larguraMax, maxLinhas) {
  const palavras = String(texto || "").split(/\s+/).filter(Boolean);
  const linhas = [];
  let linhaAtual = "";
  palavras.forEach((palavra) => {
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width > larguraMax && linhaAtual) {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    } else {
      linhaAtual = tentativa;
    }
  });
  if (linhaAtual) linhas.push(linhaAtual);
  if (linhas.length === 0) return [""];

  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    let ultima = cortadas[maxLinhas - 1];
    while (ctx.measureText(ultima + "…").width > larguraMax && ultima.length > 1) {
      ultima = ultima.slice(0, -1);
    }
    cortadas[maxLinhas - 1] = ultima + "…";
    return cortadas;
  }
  return linhas;
}

// Carrega uma data URL como um objeto Image pronto pra desenhar no canvas.
function carregarImageElement(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Imagem-modelo compartilhada pelo PDF e pelo PNG — molde novo (mesmo
// padrão adotado no catálogo Impala em out/2026), formato A4 em resolução
// maior que o molde antigo (1414x2000, era 1131x1600) e cabeçalho mais
// enxuto, o que abre espaço pra uma 4ª fileira de cartões. Coordenadas em
// pixels da própria imagem, marcando a área "em branco" onde os cartões
// podem ser desenhados sem cobrir a moldura — vale pra qualquer template,
// desde que sigam sempre esse mesmo molde (mesmo tamanho, mesmo espaço em
// branco no mesmo lugar).
const CAMINHO_TEMPLATE_PADRAO = "template-escolar.jpg"; // molde do Material Escolar (1414x2000)
const TEMPLATE_LARGURA = 1414;
const TEMPLATE_ALTURA = 2000;
const TEMPLATE_AREA = { esq: 40, dir: 1368, topo: 140, base: 1960 }; // área branca do molde escolar: x 35–1372, y 29–1970; logo termina em y 140

// Cada área pode ter o seu próprio template — útil se um dia esse
// catálogo for negociado com outra empresa (ex: uma distribuidora
// parceira), cadastrada como uma área nova, com a própria identidade
// visual. Basta o arquivo existir em "templates/<nome da área>.jpg"
// (só o Leonardo sobe esse arquivo, direto no repositório, seguindo o
// mesmo molde/tamanho 1414x2000); áreas sem template próprio usam o
// padrão (o da Atacado Martins).
function caminhoTemplateDaArea(area) {
  const nome = String(area || "").trim();
  return nome ? `templates/${encodeURIComponent(nome)}.jpg` : CAMINHO_TEMPLATE_PADRAO;
}
async function carregarTemplateDaArea(area) {
  const caminhoEspecifico = caminhoTemplateDaArea(area);
  if (caminhoEspecifico !== CAMINHO_TEMPLATE_PADRAO) {
    const imagemEspecifica = await carregarImageElement(caminhoEspecifico);
    if (imagemEspecifica) return imagemEspecifica;
  }
  return carregarImageElement(CAMINHO_TEMPLATE_PADRAO);
}

// Foto do vendedor (redonda, anel dourado) desenhada do lado esquerdo do
// cabeçalho, com o nome ao lado — mesmo padrão novo do Impala. A validade
// continua do lado direito, igual já era.
const VENDEDOR_FOTO_DIAMETRO = 100;
const VENDEDOR_FOTO_Y_CENTRO = 86; // um pouco mais baixo que no Ofertas pra o anel dourado não encostar na borda de cima do molde
const VENDEDOR_INDENT = 22;
const TEMPLATE_TEXTO_TOPO = VENDEDOR_FOTO_Y_CENTRO + 10;
// Respiro da validade em relação à borda da área útil (um "tabzinho" pra
// não ficar colado, pedido pelo Leonardo).
const TEMPLATE_TEXTO_INDENT = 22;

// ---------- Grade da Imagem (PNG): tamanho calculado pelo conteúdo ----------
// Em vez de dividir o espaço disponível em fileiras de altura fixa (o que
// deixava sobra de espaço em branco embaixo de cada cartão), a altura do
// cartão é calculada a partir do que ele realmente precisa (foto + nome +
// código + etiqueta) — mesma lógica já usada no PDF. Isso permite caber 4
// fileiras (16 itens) em vez de 3 (12), com a foto um pouco mais baixa que
// larga (GRADE_FATOR_ALTURA_FOTO) em vez de quadrada.
const GRADE_GAP_FOTO_NOME = 20;
const GRADE_GAP_NOME_CODIGO = 16;
const GRADE_GAP_CODIGO_BADGE = 14;
const GRADE_LINHA_ALTURA_NOME = 18;
const GRADE_MAX_LINHAS_NOME = 2;
const GRADE_ALTURA_BADGE = 52;
const GRADE_FATOR_ALTURA_FOTO = 0.93;
// Mesma ideia, só que pro PDF (milímetros) — bem perto da proporção da
// Imagem (0.93), ajustada pra caber as mesmas 4 fileiras (16 itens) por
// página depois de igualar o espaço entre fileiras à mesma proporção da
// Imagem (ver gutterV mais abaixo, na função do PDF).
const PDF_FATOR_ALTURA_FOTO = 0.911;
// A Imagem (PNG) é desenhada numa resolução 2x maior que o tamanho final
// do molde (reduzida de volta ao exportar), só pra o texto ficar nítido —
// o PDF é vetorial (sempre nítido), a Imagem é raster e precisa de mais
// pixels reais.
const PNG_ESCALA = 2;

function calcularGradePng() {
  const colunas = 4;
  const gutterH = 30;
  const gutterV = 22;
  const padCard = 10;
  const { esq: areaEsq, dir: areaDir, topo: areaTopo, base: areaBase } = TEMPLATE_AREA;
  const larguraUtil = areaDir - areaEsq;
  const alturaUtil = areaBase - areaTopo;
  const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
  const larguraFoto = larguraCard - 10 * 2;
  const alturaImagem = larguraFoto * GRADE_FATOR_ALTURA_FOTO;

  const alturaBlocoTexto =
    GRADE_GAP_FOTO_NOME +
    GRADE_MAX_LINHAS_NOME * GRADE_LINHA_ALTURA_NOME +
    GRADE_GAP_NOME_CODIGO +
    GRADE_GAP_CODIGO_BADGE;
  const alturaCard = padCard + alturaImagem + alturaBlocoTexto + GRADE_ALTURA_BADGE + padCard;

  const linhasGrade = Math.max(1, Math.floor((alturaUtil + gutterV) / (alturaCard + gutterV)));

  return {
    colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
    larguraCard, alturaCard, larguraFoto, alturaImagem,
    linhasGrade, limite: colunas * linhasGrade,
  };
}

// Quando o carrinho de itens marcados tem menos itens do que cabe na
// grade, em vez de deixar a sobra toda embaixo (grade "grudada" no topo),
// o espaço entre as fileiras fica sempre igual e o bloco inteiro é
// centralizado verticalmente na área útil.
function ajustarEspacamentoGradePng(grade, totalItens) {
  const { colunas, gutterV, alturaCard, areaTopo, alturaUtil } = grade;
  const linhasReais = Math.max(1, Math.ceil(totalItens / colunas));
  const alturaBlocoGrade = linhasReais * alturaCard + (linhasReais - 1) * gutterV;
  const areaTopoAjustada = areaTopo + Math.max(0, (alturaUtil - alturaBlocoGrade) / 2);
  return { gutterV, areaTopo: areaTopoAjustada };
}

// Desenha a foto (redonda, anel dourado) + nome do vendedor no canvas do
// PNG, do lado esquerdo do cabeçalho do molde.
function desenharCabecalhoVendedorCanvas(ctx, imagemVendedor, nomeVendedor) {
  const diam = VENDEDOR_FOTO_DIAMETRO;
  const x = TEMPLATE_AREA.esq + VENDEDOR_INDENT;
  const yCentro = VENDEDOR_FOTO_Y_CENTRO;
  const y = yCentro - diam / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (imagemVendedor) {
    ctx.clip();
    desenharImagemPreenchendo(ctx, imagemVendedor, x, y, diam, diam);
  } else {
    ctx.fillStyle = "#F4F3EE";
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + diam / 2, yCentro, diam / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (nomeVendedor) {
    ctx.fillStyle = "#2A2925";
    ctx.font = "600 15px 'Work Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(nomeVendedor, x + diam + 18, yCentro + 10);
  }
}

// Desenha uma grade de cartões de produto sobre o template (usada pelo
// PNG e, futuramente, pelo PDF): cartão branco com sombra suave, foto
// quadrada cortada sem esticar, nome em Montserrat itálico e o preço
// numa etiqueta preta com brilho dourado, sempre ancorada no rodapé do
// cartão — não se move de acordo com o tamanho do nome do produto.
function desenharGradeDeCartoes(ctx, itens, imagensCarregadas, opcoes) {
  const {
    colunas, areaEsq, areaTopo, larguraCard, alturaCard, gutterH, gutterV,
    padCard, larguraFoto, alturaImagem, comSombra,
  } = opcoes;

  itens.forEach((item, indice) => {
    const coluna = indice % colunas;
    const linha = Math.floor(indice / colunas);
    const x = areaEsq + coluna * (larguraCard + gutterH);
    const y = areaTopo + linha * (alturaCard + gutterV);

    // Cartão branco, sombra suave (dá referência de profundidade sobre o template)
    ctx.save();
    if (comSombra) {
      ctx.shadowColor = "rgba(20,18,14,0.18)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
    }
    ctx.fillStyle = "#FFFFFF";
    desenharRetanguloArredondado(ctx, x, y, larguraCard, alturaCard, 14);
    ctx.fill();
    ctx.restore();

    // Foto (corte "preencher", sem esticar) — ou um fundo neutro, se não tiver foto salva
    const imagemItem = imagensCarregadas.get(item.codigo);
    if (imagemItem) {
      ctx.save();
      desenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.clip();
      desenharImagemPreenchendo(ctx, imagemItem, x + padCard, y + padCard, larguraFoto, alturaImagem);
      ctx.restore();
    } else {
      ctx.fillStyle = "#F4F3EE";
      desenharRetanguloArredondado(ctx, x + padCard, y + padCard, larguraFoto, alturaImagem, 8);
      ctx.fill();
    }

    // Preço — ancorado no final do cartão, etiqueta preta + brilho dourado
    // (o "R$" já aparece separado, então usa só o número aqui)
    const precoTexto = formatarPrecoSemPrefixo(item.preco);
    const alturaBadge = 52;
    const larguraBadge = larguraFoto;
    const xBadge = x + padCard;
    const yBadge = y + alturaCard - padCard - alturaBadge;

    // Título + código — calculados de baixo pra cima, colados no preço
    // (o espaço "sobrando" fica entre a foto e o texto, não entre o texto e o preço)
    ctx.font = "600 17.1px 'Work Sans', sans-serif";
    const textoCodigos = item.codigo_barras
      ? `${item.codigo}  •  Barras ${item.codigo_barras}`
      : `${item.codigo}`;
    const linhaCodigos = quebrarTextoCanvas(ctx, textoCodigos, larguraFoto, 1)[0];

    ctx.font = "italic 900 19.7px 'Montserrat', sans-serif";
    const linhasNome = quebrarTextoCanvas(ctx, item.descricao, larguraFoto, 2);

    const gapCodigoBadge = 14;
    const gapNomeCodigo = 16;
    const linhaAlturaNome = 18;

    const yCodigo = yBadge - gapCodigoBadge;
    const yUltimaLinhaNome = yCodigo - gapNomeCodigo;
    const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "italic 900 19.7px 'Montserrat', sans-serif";
    linhasNome.forEach((linha, li) => ctx.fillText(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

    ctx.fillStyle = "#1E1E1E";
    ctx.font = "600 17.1px 'Work Sans', sans-serif";
    ctx.fillText(linhaCodigos, x + padCard, yCodigo);

    // Selo vazado (fundo branco + contorno fino) pra gastar menos tinta na impressão.
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#161513";
    ctx.lineWidth = 2;
    desenharRetanguloArredondado(ctx, xBadge + 1, yBadge + 1, larguraBadge - 2, alturaBadge - 2, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#161513";
    ctx.font = "700 15.7px 'Work Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("R$", xBadge + 11, yBadge + 16);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8A877F";
    ctx.fillText("unid", xBadge + larguraBadge - 11, yBadge + 16);

    ctx.fillStyle = "#161513";
    ctx.font = "italic 900 35.6px 'Montserrat', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 14);
    ctx.textAlign = "left";
  });
}

document.getElementById("btn-gerar-png").addEventListener("click", async () => {
  const itensMarcados = TODOS_ITENS.filter((i) => (QTY.get(i.codigo) || 0) > 0);
  if (itensMarcados.length === 0) return;

  // Mesma ordenação usada no PDF (categoria e depois descrição, alfabética),
  // só que aqui numa grade só, sem títulos de categoria.
  const itensOrdenados = agruparPorCategoriaOrdenado(itensMarcados).flatMap((g) => g.itens);

  const grade = calcularGradePng();
  if (itensOrdenados.length > grade.limite) {
    alert(
      `Pra gerar a imagem, marque no máximo ${grade.limite} itens por vez.\n\n` +
      `Gera a imagem com esses, desmarca eles e marca os próximos.`
    );
    return;
  }

  const botao = document.getElementById("btn-gerar-png");
  botao.disabled = true;

  try {
    const dataUrlsPorCodigo = new Map();
    await Promise.all(
      itensOrdenados
        .filter((i) => i.foto_url)
        .map(async (i) => {
          const dataUrl = await carregarImagemComoDataUrl(i.foto_url);
          if (dataUrl) dataUrlsPorCodigo.set(i.codigo, dataUrl);
        })
    );

    const imagensCarregadas = new Map();
    await Promise.all(
      Array.from(dataUrlsPorCodigo.entries()).map(async ([codigo, dataUrl]) => {
        const img = await carregarImageElement(dataUrl);
        if (img) imagensCarregadas.set(codigo, img);
      })
    );

    const imagemTemplate = await carregarTemplateDaArea(AREA_VENDEDOR);

    const fotoVendedorDataUrl = VENDEDOR_FOTO_URL
      ? await carregarImagemComoDataUrl(VENDEDOR_FOTO_URL)
      : null;
    const imagemVendedor = fotoVendedorDataUrl
      ? await carregarImageElement(fotoVendedorDataUrl)
      : null;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (erroFontes) { /* segue com a fonte padrão */ }
    }

    const {
      colunas, gutterH, gutterV, padCard, areaEsq, areaTopo, alturaUtil,
      larguraCard, alturaCard, larguraFoto, alturaImagem,
    } = grade;
    const areaDir = TEMPLATE_AREA.dir;
    const yLinhaVendedor = TEMPLATE_TEXTO_TOPO;

    const canvas = document.createElement("canvas");
    canvas.width = TEMPLATE_LARGURA * PNG_ESCALA;
    canvas.height = TEMPLATE_ALTURA * PNG_ESCALA;
    const ctx = canvas.getContext("2d");
    ctx.scale(PNG_ESCALA, PNG_ESCALA);

    // Fundo: a imagem-modelo (ou um fundo branco liso, se ela não carregar)
    if (imagemTemplate) {
      ctx.drawImage(imagemTemplate, 0, 0, TEMPLATE_LARGURA, TEMPLATE_ALTURA);
    } else {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, TEMPLATE_LARGURA, TEMPLATE_ALTURA);
    }

    // Vendedor (foto + nome, à esquerda) e período (à direita)
    const nomeVendedor = (document.getElementById("nome-vendedor").textContent || "").trim();
    const textoSemana = "";
    desenharCabecalhoVendedorCanvas(ctx, imagemVendedor, nomeVendedor);
    if (textoSemana) {
      ctx.fillStyle = "#2A2925";
      ctx.font = "600 15px 'Work Sans', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(textoSemana, areaDir - TEMPLATE_TEXTO_INDENT, yLinhaVendedor);
      ctx.textAlign = "left";
    }

    const { gutterV: gutterVAjustado, areaTopo: areaTopoAjustada } = ajustarEspacamentoGradePng(
      { colunas, gutterV, alturaCard, areaTopo, alturaUtil },
      itensOrdenados.length
    );

    desenharGradeDeCartoes(ctx, itensOrdenados, imagensCarregadas, {
      colunas, areaEsq, areaTopo: areaTopoAjustada, larguraCard, alturaCard,
      gutterH, gutterV: gutterVAjustado, padCard, larguraFoto, alturaImagem,
      comSombra: true,
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.download = `material-escolar-${dataArquivo}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (erro) {
    console.error("[Material Escolar] Erro ao gerar imagem:", erro);
    alert("Não consegui gerar a imagem. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
});

document.getElementById("btn-gerar-pdf").addEventListener("click", async () => {
  const itensMarcados = TODOS_ITENS.filter((i) => (QTY.get(i.codigo) || 0) > 0);
  if (itensMarcados.length === 0) return;

  const botao = document.getElementById("btn-gerar-pdf");
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = "Gerando…";

  try {
    // Mesma ordenação usada na Imagem (categoria e depois descrição,
    // alfabética), numa grade só, contínua, sem títulos de categoria
    // (igual ao Impala — o pedido dentro de cada categoria continua
    // agrupado, só não aparece mais o nome da categoria como título).
    const itensOrdenados = agruparPorCategoriaOrdenado(itensMarcados).flatMap((g) => g.itens);

    // Carrega as fotos dos itens que tiverem, em paralelo, antes de montar
    // o PDF (os itens sem foto salva simplesmente não mostram imagem).
    const dataUrlsPorCodigo = new Map();
    await Promise.all(
      itensOrdenados
        .filter((i) => i.foto_url)
        .map(async (i) => {
          const dataUrl = await carregarImagemComoDataUrl(i.foto_url);
          if (dataUrl) dataUrlsPorCodigo.set(i.codigo, dataUrl);
        })
    );
    const imagensCarregadas = new Map();
    await Promise.all(
      Array.from(dataUrlsPorCodigo.entries()).map(async ([codigo, dataUrl]) => {
        const img = await carregarImageElement(dataUrl);
        if (img) imagensCarregadas.set(codigo, img);
      })
    );

    // Imagem-modelo (mesma da Imagem, já escolhida pela área do vendedor) —
    // convertida pra data URL, porque o jsPDF precisa de base64/URL pra
    // inserir a imagem, não do elemento <img>.
    const imagemTemplateEl = await carregarTemplateDaArea(AREA_VENDEDOR);
    let templateDataUrl = null;
    if (imagemTemplateEl) {
      const canvasTemplate = document.createElement("canvas");
      canvasTemplate.width = imagemTemplateEl.width;
      canvasTemplate.height = imagemTemplateEl.height;
      canvasTemplate.getContext("2d").drawImage(imagemTemplateEl, 0, 0);
      templateDataUrl = canvasTemplate.toDataURL("image/jpeg", 0.92);
    }

    // Foto do vendedor + moldura dourada, prontas como uma imagem circular
    // só (recortada aqui, porque o jsPDF não recorta imagem sozinho).
    let fotoVendedorDataUrl = null;
    if (VENDEDOR_FOTO_URL) {
      const fotoVendedorUrlData = await carregarImagemComoDataUrl(VENDEDOR_FOTO_URL);
      const imagemVendedorEl = fotoVendedorUrlData ? await carregarImageElement(fotoVendedorUrlData) : null;
      if (imagemVendedorEl) {
        const diamPx = 240;
        const canvasFotoVendedor = document.createElement("canvas");
        canvasFotoVendedor.width = diamPx;
        canvasFotoVendedor.height = diamPx;
        const ctxFotoVendedor = canvasFotoVendedor.getContext("2d");
        ctxFotoVendedor.save();
        ctxFotoVendedor.beginPath();
        ctxFotoVendedor.arc(diamPx / 2, diamPx / 2, diamPx / 2, 0, Math.PI * 2);
        ctxFotoVendedor.closePath();
        ctxFotoVendedor.clip();
        desenharImagemPreenchendo(ctxFotoVendedor, imagemVendedorEl, 0, 0, diamPx, diamPx);
        ctxFotoVendedor.restore();
        fotoVendedorDataUrl = canvasFotoVendedor.toDataURL("image/png");
      }
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const larguraPagina = 210;
    const alturaPagina = 297;

    // Área "segura" da imagem-modelo (as mesmas medidas usadas na Imagem),
    // convertida de pixels pra milímetros.
    const escalaX = larguraPagina / TEMPLATE_LARGURA;
    const escalaY = alturaPagina / TEMPLATE_ALTURA;
    const areaEsq = TEMPLATE_AREA.esq * escalaX;
    const areaDir = TEMPLATE_AREA.dir * escalaX;
    const areaTopo = TEMPLATE_AREA.topo * escalaY;
    const areaBase = TEMPLATE_AREA.base * escalaY;
    const indentTexto = TEMPLATE_TEXTO_INDENT * escalaX;
    const margemX = areaEsq;
    const larguraUtil = areaDir - areaEsq;

    // Desenha a imagem-modelo cobrindo a página inteira — chamada de novo
    // a cada página nova (addPage não mantém o que já foi desenhado).
    function desenharFundo() {
      if (templateDataUrl) {
        doc.addImage(templateDataUrl, "JPEG", 0, 0, larguraPagina, alturaPagina);
      }
    }

    // Vendedor (foto + nome, esquerda) e período (direita) — desenhado só
    // na primeira página (decisão do Leonardo: num PDF fica melhor assim,
    // diferente da Imagem, que é uma folha única).
    const diamVendedorMm = VENDEDOR_FOTO_DIAMETRO * escalaX;
    const xFotoVendedor = (TEMPLATE_AREA.esq + VENDEDOR_INDENT) * escalaX;
    const yCentroVendedorMm = VENDEDOR_FOTO_Y_CENTRO * escalaY;
    const yFotoVendedor = yCentroVendedorMm - diamVendedorMm / 2;
    const nomeVendedor = (document.getElementById("nome-vendedor").textContent || "").trim();
    const textoSemana = "";

    function desenharCabecalhoVendedor() {
      if (fotoVendedorDataUrl) {
        doc.addImage(fotoVendedorDataUrl, "PNG", xFotoVendedor, yFotoVendedor, diamVendedorMm, diamVendedorMm);
      }
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.circle(xFotoVendedor + diamVendedorMm / 2, yCentroVendedorMm, diamVendedorMm / 2, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(42, 41, 37);
      if (nomeVendedor) doc.text(nomeVendedor, xFotoVendedor + diamVendedorMm + 4, yCentroVendedorMm + 1.6);
      if (textoSemana) doc.text(textoSemana, areaDir - indentTexto, yCentroVendedorMm + 1.6, { align: "right" });
    }

    desenharFundo();
    desenharCabecalhoVendedor();

    let y = areaTopo;

    const colunas = 4;
    const gutterH = 4;
    const gutterV = 3.3;
    const larguraCard = (larguraUtil - gutterH * (colunas - 1)) / colunas;
    const padCard = 2.2;
    const larguraFoto = larguraCard - padCard * 2;
    // Foto um pouco mais baixa que larga (em vez de quadrada) — mesma
    // regra da Imagem, é o que abre espaço pra 4ª fileira (16 itens por
    // página em vez de 12).
    const alturaFoto = larguraFoto * PDF_FATOR_ALTURA_FOTO;
    const alturaBadge = 9.6;
    const alturaTextos = 12.5; // nome (até 2 linhas) + código, entre a foto e a etiqueta
    const alturaCard = padCard + alturaFoto + alturaTextos + alturaBadge + padCard;

    // Recorta cada foto (sem esticar) já no formato final (largura x
    // altura, não mais um quadrado) — mesma lógica de corte usada na
    // Imagem (desenharImagemPreenchendo), só que desenhando num canvas à
    // parte em vez de direto no PDF (o jsPDF não recorta imagem sozinho).
    const larguraFotoPx = Math.round(larguraFoto * (300 / 25.4)); // ~300dpi
    const alturaFotoPx = Math.round(alturaFoto * (300 / 25.4));
    const fotosRecortadas = new Map();
    imagensCarregadas.forEach((img, codigo) => {
      const canvasFoto = document.createElement("canvas");
      canvasFoto.width = larguraFotoPx;
      canvasFoto.height = alturaFotoPx;
      desenharImagemPreenchendo(canvasFoto.getContext("2d"), img, 0, 0, larguraFotoPx, alturaFotoPx);
      fotosRecortadas.set(codigo, canvasFoto.toDataURL("image/jpeg", 0.9));
    });

    // Grade contínua, sem separar por categoria — igual já é feito na
    // Imagem (o pedido dentro de cada categoria continua agrupado, só não
    // aparece mais o nome da categoria como título entre os grupos).
    let coluna = 0;
    itensOrdenados.forEach((item) => {
      if (coluna === 0 && y + alturaCard > areaBase) {
        doc.addPage();
        desenharFundo();
        y = areaTopo;
      }

      const x = margemX + coluna * (larguraCard + gutterH);

      // Cartão branco com borda leve (sem sombra — o jsPDF não faz blur)
      doc.setDrawColor(225, 224, 218);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, larguraCard, alturaCard, 1.8, 1.8, "FD");

      // Foto (recorte já pronto, sem esticar) ou fundo neutro
      const fotoDataUrl = fotosRecortadas.get(item.codigo);
      if (fotoDataUrl) {
        try {
          doc.addImage(fotoDataUrl, "JPEG", x + padCard, y + padCard, larguraFoto, alturaFoto);
        } catch (erro) {
          console.error("[Material Escolar] Erro ao inserir imagem no PDF:", erro);
        }
      } else {
        doc.setFillColor(244, 243, 238);
        doc.rect(x + padCard, y + padCard, larguraFoto, alturaFoto, "F");
      }

      // Preço — etiqueta preta ancorada no rodapé do cartão (não se
      // move de acordo com o tamanho do nome do produto). O "R$" já
      // aparece separado, então usa só o número aqui.
      const precoTexto = formatarPrecoSemPrefixo(item.preco);
      const larguraBadge = larguraFoto;
      const xBadge = x + padCard;
      const yBadge = y + alturaCard - padCard - alturaBadge;

      // Nome + código, calculados de baixo pra cima, colados na etiqueta
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      const textoCodigos = item.codigo_barras
        ? `${item.codigo}  •  Barras ${item.codigo_barras}`
        : `${item.codigo}`;
      const linhaCodigos = doc.splitTextToSize(textoCodigos, larguraFoto)[0];

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8.3);
      const todasLinhasNome = doc.splitTextToSize(item.descricao, larguraFoto);
      const linhasNome = todasLinhasNome.slice(0, 2);
      if (todasLinhasNome.length > 2 && linhasNome[1].length > 1) {
        linhasNome[1] = linhasNome[1].slice(0, -1) + "…";
      }

      const gapCodigoBadge = 2.6;
      const gapNomeCodigo = 3.4;
      const linhaAlturaNome = 3.4;

      const yCodigo = yBadge - gapCodigoBadge;
      const yUltimaLinhaNome = yCodigo - gapNomeCodigo;
      const yPrimeiraLinhaNome = yUltimaLinhaNome - (linhasNome.length - 1) * linhaAlturaNome;

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(8.3);
      linhasNome.forEach((linha, li) => doc.text(linha, x + padCard, yPrimeiraLinhaNome + li * linhaAlturaNome));

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.text(linhaCodigos, x + padCard, yCodigo);

      // Selo vazado (fundo branco + contorno fino) pra gastar menos tinta na impressão.
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(22, 21, 19);
      doc.setLineWidth(0.3);
      doc.roundedRect(xBadge, yBadge, larguraBadge, alturaBadge, 1.6, 1.6, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6);
      doc.setTextColor(22, 21, 19);
      doc.text("R$", xBadge + 2, yBadge + 3.4);
      doc.setTextColor(138, 135, 127);
      doc.text("unid", xBadge + larguraBadge - 2, yBadge + 3.4, { align: "right" });

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(15);
      doc.setTextColor(22, 21, 19);
      doc.text(precoTexto, x + larguraCard / 2, yBadge + alturaBadge - 3, { align: "center" });

      coluna++;
      if (coluna === colunas) {
        coluna = 0;
        y += alturaCard + gutterV;
      }
    });

    const dataArquivo = new Date().toISOString().slice(0, 10);
    doc.save(`material-escolar-${dataArquivo}.pdf`);
  } catch (erro) {
    console.error("[Material Escolar] Erro ao gerar PDF:", erro);
    alert("Não consegui gerar o PDF. Tenta de novo.");
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
});

// Rodapé do catálogo: só abre o carrinho. O envio pelo WhatsApp acontece
// de dentro da tela do carrinho (mesmo padrão do Ofertas da Semana).
document.getElementById("btn-ir-carrinho").addEventListener("click", () => {
  if (totalItensMarcados() === 0) return;
  abrirCarrinho();
});
document.getElementById("btn-voltar-carrinho").addEventListener("click", voltarDoCarrinho);

document.getElementById("btn-enviar-pedido").addEventListener("click", () => {
  const grupos = agruparCarrinhoPorCategoria();
  if (grupos.length === 0 || !VENDEDOR_WHATSAPP) return;

  const nomeLoja = document.getElementById("input-loja").value.trim();
  const blocos = grupos.map((grupo) => {
    const linhas = grupo.itens.map((i) => `Cód: ${i.codigo} | Qtd: ${QTY.get(i.codigo)} | ${formatarPreco(i.preco)}`);
    return `- *${grupo.categoria.toUpperCase()}*\n${linhas.join("\n")}`;
  });

  const mensagem =
    `*MATERIAL ESCOLAR*\n` +
    (nomeLoja ? `_Loja: ${nomeLoja}_\n` : "") +
    `_Olá! tenho interesse nestes itens:_\n\n` +
    blocos.join("\n\n") +
    `\n\n_(Preço final combinado direto com o vendedor, considerando a fração mínima de cada item.)_`;

  const url = `https://wa.me/${VENDEDOR_WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
  ENVIADO_EM = Date.now();
  salvarItensMarcados();
  window.open(url, "_blank");
});

// "Gerar PDF do pré-pedido" — cópia simples (só texto, sem molde/fotos) dos
// mesmos itens marcados que já vão pro WhatsApp, com código, quantidade e
// preço de cada um. Serve de backup pra quando o cliente não consegue usar
// o WhatsApp Web no computador dele, mas ainda quer baixar/mandar um PDF
// com os itens de interesse.
document.getElementById("btn-pdf-pedido").addEventListener("click", () => {
  const itensMarcados = TODOS_ITENS.filter((i) => (QTY.get(i.codigo) || 0) > 0);
  if (itensMarcados.length === 0) return;

  const botao = document.getElementById("btn-pdf-pedido");
  botao.disabled = true;

  try {
    // Mesmo agrupamento da tela do carrinho (por categoria, na ordem das abas).
    const grupos = agruparCarrinhoPorCategoria();
    const nomeLoja = document.getElementById("input-loja").value.trim();

    const nomeVendedor = (document.getElementById("nome-vendedor").textContent || "").trim();
    const textoSemana = "";

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margemX = 18;
    const larguraPagina = 210;
    const larguraUtil = larguraPagina - margemX * 2;
    const areaBase = 280;
    let y = 20;

    function novaPaginaSeNecessario(alturaNecessaria) {
      if (y + alturaNecessaria > areaBase) {
        doc.addPage();
        y = 20;
      }
    }

    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(18);
    doc.setTextColor(30, 79, 163);
    doc.text("Pré-pedido — Material Escolar", margemX, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const dataTexto = new Date().toLocaleDateString("pt-BR");
    doc.text(`Vendedor: ${nomeVendedor || "-"}   •   Data: ${dataTexto}`, margemX, y);
    y += 6;
    if (nomeLoja) {
      doc.text(`Loja: ${nomeLoja}`, margemX, y);
      y += 6;
    }
    if (textoSemana) {
      doc.text(textoSemana, margemX, y);
      y += 6;
    }
    y += 5;

    grupos.forEach((grupo) => {
      novaPaginaSeNecessario(14);

      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(12);
      doc.setTextColor(23, 62, 130);
      doc.text(grupo.categoria.toUpperCase(), margemX, y);
      y += 2.5;

      doc.setDrawColor(220, 228, 242);
      doc.setLineWidth(0.3);
      doc.line(margemX, y, margemX + larguraUtil, y);
      y += 6.5;

      grupo.itens.forEach((item) => {
        novaPaginaSeNecessario(9);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        const descricaoLinha = doc.splitTextToSize(item.descricao, larguraUtil * 0.62)[0];
        doc.text(descricaoLinha, margemX, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(130, 130, 130);
        doc.text(`Cód. ${item.codigo}${item.codigo_barras ? `  •  Barras ${item.codigo_barras}` : ""}  •  Qtd: ${QTY.get(item.codigo)}`, margemX, y + 4.4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(30, 79, 163);
        doc.text(formatarPreco(item.preco), margemX + larguraUtil, y, { align: "right" });

        y += 9.5;
      });

      y += 3.5;
    });

    novaPaginaSeNecessario(10);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text("Preços sujeitos a confirmação — o pedido é combinado direto com o vendedor.", margemX, y);

    const dataArquivo = new Date().toISOString().slice(0, 10);
    doc.save(`pre-pedido-material-escolar-${dataArquivo}.pdf`);
  } catch (erro) {
    console.error("[Material Escolar] Erro ao gerar PDF do pedido:", erro);
    alert("Não consegui gerar o PDF. Tenta de novo.");
  } finally {
    botao.disabled = false;
  }
});

// ---------------- BOOT ----------------
async function iniciar() {
  const slug = pegarSlugDaUrl();
  if (!slug) {
    mostrarEstado("tela-erro");
    return;
  }

  registrarVisita(slug);

  let vendedor;
  try {
    vendedor = await buscarVendedor(slug);
  } catch (erro) {
    console.error("[Material Escolar] Erro ao buscar vendedor:", erro);
    mostrarEstado("tela-erro");
    return;
  }

  if (!vendedor) {
    mostrarEstado("tela-erro");
    return;
  }

  if (!vendedor.ativo) {
    const texto = encodeURIComponent("Olá! Meu catálogo de Material Escolar está pausado, gostaria de regularizar o acesso.");
    document.getElementById("btn-pausado-whatsapp").href = `https://wa.me/${PLATAFORMA.whatsapp}?text=${texto}`;
    mostrarEstado("tela-pausado");
    return;
  }

  VENDEDOR_WHATSAPP = vendedor.whatsapp;
  AREA_VENDEDOR = vendedor.area || "SC";
  VENDEDOR_FOTO_URL = vendedor.foto_url || null;
  document.getElementById("nome-vendedor").textContent = vendedor.nome;

  const fotoEl = document.getElementById("foto-vendedor");
  if (vendedor.foto_url) {
    fotoEl.style.backgroundImage = `url(${vendedor.foto_url})`;
    fotoEl.textContent = "";
  } else {
    fotoEl.textContent = iniciaisDoNome(vendedor.nome);
  }

  let itens;
  try {
    itens = await buscarItensEscolar(vendedor.area || "SC");
  } catch (erro) {
    console.error("[Material Escolar] Erro ao buscar itens:", erro);
    mostrarEstado("tela-erro");
    return;
  }

  if (!itens || itens.length === 0) {
    mostrarEstado("tela-vazio");
    return;
  }

  TODOS_ITENS = itens;

  await carregarOrdemCategorias();
  CHAVE_GUARDADOS = `escolar-itens-marcados:${slug}`;
  carregarItensMarcados();

  // Abre em "Escolar"; se essa área não tiver nada nele, abre no primeiro grupo que tiver.
  GRUPO_ATIVO = ORDEM_GRUPOS.find((g) => categoriasDoGrupo(g).length > 0) || "escolar";
  CATEGORIA_ATIVA = categoriasDoGrupo(GRUPO_ATIVO)[0] || null;
  renderizarAbasGrupo();
  renderizarAbas();
  renderizarItens();
  atualizarRodape();
  mostrarEstado("app");
  perguntarSeJaEnviou();

  // Tour guiado: tocar na foto do vendedor abre o passo a passo; na 1ª
  // visita naquele celular aparece a dica "Toque na minha foto...".
  iniciarTourGuiado();
}

function iniciaisDoNome(nome) {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(texto) {
  return String(texto || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(texto) {
  return escapeHtml(texto);
}

// ============================================================
// TOUR GUIADO (toque na foto do vendedor)
// ============================================================
// O próprio vendedor "explica" o catálogo: a tela escurece, só o item da vez
// fica aceso, e um balão de fala com a fotinha dele explica pra que serve.
// Pensado pro cliente final (o link é o mesmo pra cliente e vendedor).
// - Abre a qualquer momento tocando na foto do vendedor (tem um "?" no canto).
// - Na 1ª visita naquele celular, aparece só uma dica "Toque na minha foto e
//   eu te mostro como funciona" — ela some no 1º toque e não volta mais.
// O tour não mexe no carrinho nem em nada do catálogo: só mostra e explica.
const CHAVE_DICA_FOTO = "escolar-dica-foto-vista";
let TOUR_ATIVO = false;
let TOUR_PASSO = 0;
let TOUR_PASSOS = [];
let DICA_FOTO_ABERTA = false;

function tourLerStorage(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
function tourGravarStorage(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) { /* modo privado: segue sem guardar */ } }

function primeiroNomeVendedor() {
  const nome = document.getElementById("nome-vendedor").textContent || "";
  return String(nome).trim().split(/\s+/)[0] || "seu vendedor";
}

// Os 7 passos — textos na voz do vendedor (sem "o"/"a" antes do nome, pra
// servir pra vendedor e vendedora). No Material Escolar: abas Escolar /
// Escrita / Cadernos + abas de categoria, o card começa com "Tenho interesse", e a barra do
// carrinho é 1 passo só (não 2) — aprovados pelo Leonardo em 14/11/2026.
function montarPassosTour() {
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi! Eu sou <b>${escaparHtml(primeiroNomeVendedor())}</b> e vou te mostrar rapidinho como fazer seu pedido aqui.`,
    },
    {
      alvo: () => document.getElementById("abas-grupo-tabs"),
      texto: () => `Aqui você escolhe o tipo de material: <b>Escolar</b>, <b>Escrita</b> ou <b>Cadernos</b>.`,
    },
    {
      alvo: () => document.getElementById("categoria-tabs"),
      texto: () => `Aqui ficam as <b>categorias</b>. Toque numa aba ou arraste pro lado para ver as outras.`,
    },
    {
      alvo: () => document.getElementById("btn-ordenar"), redondo: true,
      texto: () => `Aqui você organiza os produtos por <b>menor</b> ou <b>maior preço</b>.`,
    },
    {
      alvo: () => document.getElementById("btn-busca").closest(".acao-cabecalho"),
      texto: () => `Procurando algo? Toque na <b>lupa</b> e busque pelo nome, pelo código ou pelo código de barras.`,
    },
    {
      alvo: () => document.querySelector("#lista-itens .item-card"),
      texto: () => `Gostou de algum produto? Toque em <b>Tenho interesse</b> e depois ajuste a quantidade no <b>+</b> e no <b>−</b>. A <b>fração</b> está na descrição do produto. Toque na foto para ver maior.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Aqui você acompanha o que já escolheu, e fica tudo <b>guardado</b> mesmo se fechar a página. Quando terminar, toque aqui para ver seu <b>carrinho</b> e me enviar o pedido.`,
    },
  ];
}

// Aqui a foto do vendedor é um quadrinho com a foto de fundo (ou as
// iniciais, quando ele não tem foto). Copia do cabeçalho pra fotinha do
// balão e pra do carrinho.
function copiarFotoVendedor(destino) {
  const origem = document.getElementById("foto-vendedor");
  destino.style.backgroundImage = origem.style.backgroundImage;
  destino.textContent = origem.textContent;
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Dica de 1ª visita ----------
function posicionarDicaFoto() {
  const dica = document.getElementById("dica-foto");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const left = Math.max(10, r.left - 4);
  dica.style.left = left + "px";
  dica.style.top = (r.bottom + 12) + "px";
  dica.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function mostrarDicaFoto() {
  // Não atrapalha se já tem outra coisa na frente (tour, pergunta, foto ampliada)
  if (TOUR_ATIVO || PERGUNTA_ENVIO_ABERTA || document.getElementById("app").hidden) return;
  if (!document.getElementById("dialogo-fundo").hidden || !document.getElementById("foto-zoom-fundo").hidden) return;
  posicionarDicaFoto();
  document.getElementById("dica-foto").classList.add("visivel");
  document.getElementById("vendedor-foto-wrap").classList.add("pulsando");
  DICA_FOTO_ABERTA = true;
}

function esconderDicaFoto() {
  if (!DICA_FOTO_ABERTA) return;
  DICA_FOTO_ABERTA = false;
  document.getElementById("dica-foto").classList.remove("visivel");
  document.getElementById("vendedor-foto-wrap").classList.remove("pulsando");
  tourGravarStorage(CHAVE_DICA_FOTO, "1");
}

// ---------- Tour ----------
// Mini tour da tela do carrinho (foto do vendedor ao lado do "Enviar").
// Decisões do Leonardo em 14/11/2026: sem dica de 1ª visita aqui (o "?" na
// foto basta). 5 passos; o aviso de preço final não ganhou passo (já fica
// do lado do Enviar).
function montarPassosTourCarrinho() {
  return [
    {
      alvo: () => document.querySelector("#lista-carrinho .carrinho-item-linha .item-qty"),
      texto: () => `Aqui você ajusta as <b>quantidades</b>. Se tirar tudo no <b>−</b>, o item sai do pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-limpar-itens"),
      texto: () => `Quer recomeçar? Aqui você <b>apaga tudo</b> de uma vez.`,
    },
    {
      alvo: () => document.querySelector("#tela-carrinho .carrinho-loja"),
      texto: () => `Tem mais de uma loja? Escreva aqui <b>para qual loja</b> é o pedido.`,
    },
    {
      alvo: () => document.getElementById("btn-pdf-pedido"),
      texto: () => `Aqui você baixa seu pedido em <b>PDF</b>, se preferir.`,
    },
    {
      alvo: () => document.getElementById("btn-enviar-pedido"),
      texto: () => `Tudo certo? Toque aqui e seu pedido chega direto no meu <b>WhatsApp</b>.`,
    },
  ];
}

function iniciarTour() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  // Deixa a tela "limpa" antes de começar: sem busca, sem menu, lá no topo
  if (BUSCA || !document.getElementById("barra-busca").hidden) fecharBusca();
  document.getElementById("menu-ordenar").hidden = true;
  window.scrollTo(0, 0);
  abrirTour(montarPassosTour());
}

function iniciarTourCarrinho() {
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourCarrinho());
}

function abrirTour(passos) {
  // Pula passos cujo item não existe na tela (ex: coleção sem produto,
  // carrinho vazio)
  TOUR_PASSOS = passos.filter((p) => {
    const alvo = p.alvo();
    return Array.isArray(alvo) ? alvo.length > 0 : !!alvo;
  });
  if (TOUR_PASSOS.length === 0) return;

  TOUR_ATIVO = true;
  TOUR_PASSO = 0;
  document.getElementById("tour-nome").textContent = primeiroNomeVendedor();
  copiarFotoVendedor(document.getElementById("tour-mini-foto"));
  document.getElementById("tour-bloqueio").hidden = false;
  document.getElementById("tour-destaque").hidden = false;
  document.getElementById("tour-balao").hidden = false;
  mostrarPassoTour();
}

function encerrarTour() {
  TOUR_ATIVO = false;
  document.getElementById("tour-bloqueio").hidden = true;
  document.getElementById("tour-destaque").hidden = true;
  document.getElementById("tour-balao").hidden = true;
  simularBotaoCarrinho(false);
}

// Nos passos do carrinho, com nada marcado, o botão aparece como
// "Ir para o carrinho" em vez do cinza "Nenhum item selecionado" (decisão
// do Leonardo). Ao sair do passo/tour, volta ao normal.
function simularBotaoCarrinho(ligar) {
  const btn = document.getElementById("btn-ir-carrinho");
  if (ligar && btn.disabled) {
    btn.classList.add("tour-simulado");
    btn.textContent = "Ir para o carrinho";
  } else if (!ligar && btn.classList.contains("tour-simulado")) {
    btn.classList.remove("tour-simulado");
    atualizarRodape();
  }
}

function mostrarPassoTour() {
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const ultimo = TOUR_PASSO === TOUR_PASSOS.length - 1;
  simularBotaoCarrinho(!!passo.botaoCarrinho);
  document.getElementById("tour-texto").innerHTML = passo.texto();
  document.getElementById("tour-contador").textContent = `${TOUR_PASSO + 1} de ${TOUR_PASSOS.length}`;
  document.getElementById("tour-proximo").textContent = ultimo ? "Entendi! 👍" : "Próximo →";
  document.getElementById("tour-pular").style.visibility = ultimo ? "hidden" : "visible";
  posicionarPassoTour();
}

function posicionarPassoTour() {
  if (!TOUR_ATIVO) return;
  const passo = TOUR_PASSOS[TOUR_PASSO];
  const el = passo.alvo();
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 6;
  const destaque = document.getElementById("tour-destaque");

  // Passo sem item pra apontar: tela escurecida e balão no meio
  if (passo.centro) {
    destaque.classList.add("sem-anel");
    Object.assign(destaque.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
    const balaoC = document.getElementById("tour-balao");
    const caixaC = document.getElementById("tour-caixa");
    const larguraC = Math.min(360, vw - 24);
    balaoC.style.width = larguraC + "px";
    caixaC.classList.remove("seta-cima", "seta-baixo");
    caixaC.classList.add("sem-seta");
    balaoC.style.left = (vw - larguraC) / 2 + "px";
    balaoC.style.top = Math.max(10, (vh - balaoC.offsetHeight) / 2) + "px";
    return;
  }
  destaque.classList.remove("sem-anel");
  document.getElementById("tour-caixa").classList.remove("sem-seta");

  // O alvo pode ser um item só ou uma lista (ex: botões PDF + Imagem juntos)
  let r;
  if (Array.isArray(el)) {
    const rs = el.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rs.map((x) => x.left));
    const top = Math.min(...rs.map((x) => x.top));
    const right = Math.max(...rs.map((x) => x.right));
    const bottom = Math.max(...rs.map((x) => x.bottom));
    r = { left, top, right, bottom, width: right - left, height: bottom - top };
  } else {
    r = el.getBoundingClientRect();
  }

  // Recorte iluminado em volta do item
  let dl, dt, dw, dh;
  if (passo.redondo) {
    const lado = Math.max(r.width, r.height) + pad * 2;
    dl = r.left + r.width / 2 - lado / 2;
    dt = r.top + r.height / 2 - lado / 2;
    dw = dh = lado;
    destaque.style.borderRadius = "50%";
  } else {
    dl = r.left - pad;
    dt = r.top - pad;
    dw = r.width + pad * 2;
    dh = r.height + pad * 2;
    destaque.style.borderRadius = "14px";
  }
  Object.assign(destaque.style, { left: dl + "px", top: dt + "px", width: dw + "px", height: dh + "px" });

  // Balão: embaixo do item se couber, senão em cima
  const balao = document.getElementById("tour-balao");
  const caixa = document.getElementById("tour-caixa");
  const largura = Math.min(360, vw - 24);
  const recuoCaixa = 46 + 8; // fotinha + espaço até o balão de fala
  balao.style.width = largura + "px";
  const altura = balao.offsetHeight;
  const espacoAbaixo = vh - (dt + dh);
  let top;
  caixa.classList.remove("seta-cima", "seta-baixo");
  if (espacoAbaixo > altura + 24) {
    top = dt + dh + 14;
    caixa.classList.add("seta-cima");
  } else {
    top = Math.max(10, dt - altura - 14);
    caixa.classList.add("seta-baixo");
  }
  const centroX = dl + dw / 2;
  const larguraCaixa = largura - recuoCaixa;
  const left = Math.min(Math.max(12, centroX - recuoCaixa - larguraCaixa / 2), vw - largura - 12);
  balao.style.left = left + "px";
  balao.style.top = top + "px";
  caixa.style.setProperty("--seta-x", Math.min(Math.max(18, centroX - left - recuoCaixa), larguraCaixa - 22) + "px");
}

// Liga tudo — chamado no fim do iniciar(), quando o catálogo já está na tela
function iniciarTourGuiado() {
  const ligarFoto = (el, acao) => {
    el.addEventListener("click", acao);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); acao(); }
    });
  };
  ligarFotoComToqueEscondido(document.getElementById("vendedor-foto-wrap"));
  ligarFoto(document.getElementById("carrinho-foto-wrap"), iniciarTourCarrinho);
  ligarMenuVendedor();
  // A foto do carrinho é a mesma do cabeçalho (já carregada a esta altura)
  copiarFotoVendedor(document.getElementById("carrinho-foto"));
  document.getElementById("tour-pular").addEventListener("click", encerrarTour);
  document.getElementById("tour-proximo").addEventListener("click", () => {
    if (TOUR_PASSO >= TOUR_PASSOS.length - 1) { encerrarTour(); return; }
    TOUR_PASSO++;
    mostrarPassoTour();
  });
  window.addEventListener("resize", () => {
    posicionarPassoTour();
    if (DICA_FOTO_ABERTA) posicionarDicaFoto();
  });
  // Qualquer toque na tela já some com a dica de 1ª visita
  document.addEventListener("pointerdown", esconderDicaFoto, true);

  if (!tourLerStorage(CHAVE_DICA_FOTO)) setTimeout(mostrarDicaFoto, 900);
}


// ============================================================
// MENU DO VENDEDOR (toque escondido) + TUTORIAL DO VENDEDOR
// ============================================================
// Ideia do Leonardo (14/11/2026): o link é o mesmo pra cliente e vendedor,
// então o "modo vendedor" abre por um toque escondido: SEGURAR a foto do
// vendedor por 3 segundos (um anel dourado vai enchendo). Abre um menu com
// "Copiar meu link" (o vendedor não perde mais o próprio link) e
// "Tutorial do vendedor". Toque rápido na foto continua abrindo o tour do
// cliente. Soltou antes dos 3s (depois de um toque longo)? Não acontece nada.
const TEMPO_SEGURAR_MS = 3000;
const TOQUE_RAPIDO_MS = 600;

function ligarFotoComToqueEscondido(foto) {
  let timer = null;
  let inicio = 0;
  let abriuMenu = false;
  let xIni = 0;
  let yIni = 0;

  const cancelar = () => {
    clearTimeout(timer);
    timer = null;
    foto.classList.remove("segurando");
  };

  foto.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    abriuMenu = false;
    inicio = Date.now();
    xIni = e.clientX;
    yIni = e.clientY;
    foto.classList.add("segurando");
    timer = setTimeout(() => {
      timer = null;
      abriuMenu = true;
      foto.classList.remove("segurando");
      try { if (navigator.vibrate) navigator.vibrate(40); } catch (erro) { /* sem vibração */ }
      abrirMenuVendedor();
    }, TEMPO_SEGURAR_MS);
  });

  // Arrastou o dedo (rolando a tela)? Cancela.
  foto.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - xIni, e.clientY - yIni) > 12) cancelar();
  });

  foto.addEventListener("pointerup", () => {
    const foiRapido = timer && Date.now() - inicio < TOQUE_RAPIDO_MS;
    cancelar();
    if (foiRapido && !abriuMenu) iniciarTour();
  });
  foto.addEventListener("pointercancel", cancelar);
  foto.addEventListener("pointerleave", () => { if (timer) cancelar(); });

  // Segurar a foto não pode abrir o menu do navegador ("Salvar imagem" etc)
  foto.addEventListener("contextmenu", (e) => e.preventDefault());

  // Teclado: Enter/espaço abre o tour do cliente
  foto.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); iniciarTour(); }
  });
}

function posicionarMenuVendedor() {
  const menu = document.getElementById("menu-vendedor");
  const r = document.getElementById("vendedor-foto-wrap").getBoundingClientRect();
  const largura = menu.offsetWidth || 230;
  const left = Math.min(Math.max(10, r.left - 4), window.innerWidth - largura - 10);
  menu.style.left = left + "px";
  menu.style.top = (r.bottom + 14) + "px";
  menu.style.setProperty("--seta-x", (r.left + r.width / 2 - left) + "px");
}

function abrirMenuVendedor() {
  esconderDicaFoto();
  if (TOUR_ATIVO) return;
  window.scrollTo(0, 0);
  document.getElementById("menu-vendedor-fundo").hidden = false;
  document.getElementById("menu-vendedor").hidden = false;
  posicionarMenuVendedor();
}

function fecharMenuVendedor() {
  document.getElementById("menu-vendedor-fundo").hidden = true;
  document.getElementById("menu-vendedor").hidden = true;
}

let TIMER_AVISO_VENDEDOR = null;
function mostrarAvisoVendedor(texto, ms = 2600) {
  const aviso = document.getElementById("aviso-vendedor");
  aviso.textContent = texto;
  aviso.classList.add("mostrar");
  clearTimeout(TIMER_AVISO_VENDEDOR);
  TIMER_AVISO_VENDEDOR = setTimeout(() => aviso.classList.remove("mostrar"), ms);
}

// O link copiado é o MESMO link que o cliente usa (o link normal do
// vendedor, com o ?v= dele) — não existe link especial de vendedor.
function linkDoVendedor() {
  return window.location.href.split("#")[0];
}

async function copiarLinkDoVendedor() {
  const link = linkDoVendedor();
  let copiou = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
      copiou = true;
    }
  } catch (erro) { /* tenta o jeito antigo abaixo */ }
  if (!copiou) {
    try {
      const campo = document.createElement("textarea");
      campo.value = link;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      copiou = document.execCommand("copy");
      campo.remove();
    } catch (erro) { copiou = false; }
  }
  fecharMenuVendedor();
  if (copiou) {
    mostrarAvisoVendedor("Link copiado! Agora é só colar no WhatsApp.");
  } else {
    // Celular não deixou copiar sozinho: mostra o link pra copiar à mão
    mostrarAvisoVendedor("Seu link: " + link, 8000);
  }
}

function eIphone() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// Os 6 passos do tutorial do vendedor — mesmos textos nos 5 catálogos
// (aprovados pelo Leonardo em 14/11/2026).
function montarPassosTourVendedor() {
  const salvarTela = eIphone()
    ? `No <b>Safari</b>, toque em <b>Compartilhar</b> (o quadradinho com a setinha ↑) e escolha <b>Adicionar à Tela de Início</b>. Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`
    : `No navegador, toque nos <b>3 pontinhos ⋮</b> lá em cima e escolha <b>Adicionar à tela inicial</b> (ou <b>Instalar app</b>). Assim seu catálogo fica no celular, com o ícone dele, e você nunca perde seu link!`;
  return [
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Oi, <b>${escaparHtml(primeiroNomeVendedor())}</b>! Este é o seu <b>modo vendedor</b>, com dicas só pra você. Seus clientes não veem isso.`,
    },
    {
      alvo: () => [document.getElementById("btn-gerar-pdf"), document.getElementById("btn-gerar-png")]
        .map((b) => b && b.closest(".acao-cabecalho")).filter(Boolean),
      texto: () => `Escolha os produtos que quer oferecer e toque em <b>PDF</b> ou <b>Imagem</b>. Sai pronto, com a sua foto e os preços, pra mandar aos clientes. A <b>Imagem</b> cabe até <b>16 produtos</b>; no <b>PDF</b> você coloca quantos quiser.`,
    },
    {
      alvo: () => document.getElementById("btn-ir-carrinho"), botaoCarrinho: true,
      texto: () => `Tem cliente que faz o pedido pelo <b>computador</b> e não tem o WhatsApp aberto ali? Oriente ele a usar o botão <b>PDF do pedido</b>, dentro do carrinho: ele baixa o pedido e te manda por onde for mais fácil.`,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Sempre que precisar do seu link, <b>segure a sua foto</b> e toque em <b>Copiar meu link</b>. Aí é só colar no WhatsApp.`,
    },
    {
      alvo: () => document.body, centro: true,
      texto: () => salvarTela,
    },
    {
      alvo: () => document.getElementById("vendedor-foto-wrap"), redondo: true,
      texto: () => `Seus clientes aprendem a usar o catálogo <b>tocando na sua foto</b>. Avise eles!`,
    },
  ];
}

function iniciarTourVendedor() {
  fecharMenuVendedor();
  if (TOUR_ATIVO) return;
  if (BUSCA || !document.getElementById("barra-busca").hidden) fecharBusca();
  window.scrollTo(0, 0);
  abrirTour(montarPassosTourVendedor());
}

function ligarMenuVendedor() {
  document.getElementById("btn-copiar-link").addEventListener("click", copiarLinkDoVendedor);
  document.getElementById("btn-tour-vendedor").addEventListener("click", iniciarTourVendedor);
  document.getElementById("btn-fechar-menu-vendedor").addEventListener("click", fecharMenuVendedor);
  document.getElementById("menu-vendedor-fundo").addEventListener("click", fecharMenuVendedor);
  window.addEventListener("resize", () => {
    if (!document.getElementById("menu-vendedor").hidden) posicionarMenuVendedor();
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
