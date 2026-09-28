// Tela Comprar (prompt mestre, §18 a §23; tela de referência 4).
// Sem compra em andamento, pergunta onde e quando. Com compra em andamento, regista artigo a artigo.

import { html, montar } from '../html.js';
import { icone } from '../icones.js';
import {
  abrirFolha, campoKz, ligarCamposKz, lerCampoKz, mostrarErroCampo,
  seletorQuantidade, ligarSeletorQuantidade, executar, mostrarAviso, confirmar,
} from '../componentes.js';
import { formatarKz, formatarKzComSinal, formatarNumero, formatarPercentagem, lerKz } from '../../nucleo/formatos.js';
import { formatarQuantidade, formatarPrecoUnitario } from '../../nucleo/unidades.js';
import { dataISO } from '../../nucleo/datas.js';
import { alertaPreco, motivoPrecoEstranho, pareceEngano } from '../../nucleo/alertas.js';
import { normalizarNome } from '../../dados/catalogo-inicial.js';
import {
  compraEmAndamento, iniciarCompra, detalheCompra, registarArtigo, anularArtigo, concluirCompra,
  cancelarCompra, simularArtigo, produtoParaCompra, estabelecimentosRecentes, intervaloDataCompra,
} from '../../servicos/compras.js';
import { obterLista } from '../../servicos/lista.js';
import { listarProdutos } from '../../servicos/produtos.js';
import { ErroKussumba } from '../../servicos/comum.js';

export const titulo = 'Comprar';
export const separador = 'comprar';
export const precisaMesAberto = true;

const MAX_DIGITOS = 10;
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

// Estado do registo em curso. Mantém-se se o utilizador for ao Mês e voltar.
const estado = { compraId: null, ignorados: new Set(), extra: null, actualId: null, valor: '', quantidade: null, verTodos: false };

function reiniciarEstado(compraId) {
  Object.assign(estado, { compraId, ignorados: new Set(), extra: null, actualId: null, valor: '', quantidade: null, verTodos: false });
}

function limparArtigo() {
  Object.assign(estado, { extra: null, actualId: null, valor: '', quantidade: null });
}

function artigos(n) {
  return `${formatarNumero(n)} ${n === 1 ? 'artigo' : 'artigos'}`;
}

// ---------- Começar uma ida às compras ----------

async function desenharInicio(raiz, { contexto, redesenhar }) {
  const [lojas, { resumo }] = await Promise.all([estabelecimentosRecentes(), obterLista(contexto.mesAberto.id)]);
  const datas = intervaloDataCompra(contexto.mesAberto);
  montar(raiz, html`
    <header class="cabecalho"><h1 tabindex="-1">Nova ida às compras</h1></header>
    <form class="comprar-inicio" novalidate>
      <div class="campo">
        <label class="campo__rotulo" for="loja">Onde vais comprar?</label>
        <input class="campo-texto" id="loja" type="text" maxlength="60" autocomplete="off" placeholder="Ex.: Grossista Kikolo" enterkeyhint="next">
        <p class="campo__erro" id="loja-erro" hidden></p>
        ${lojas.length
          ? html`<div class="chips chips--quebra" role="group" aria-label="Lojas onde já compraste">
              ${lojas.map((l) => html`<button type="button" class="chip" data-loja="${l}">${l}</button>`)}
            </div>`
          : ''}
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="data">Data</label>
        <input class="campo-texto" id="data" type="date" value="${dataISO()}" min="${datas.min}" max="${datas.max}">
        <p class="campo__erro" id="data-erro" hidden></p>
      </div>
      <div class="cartao comprar-inicio__lista">
        ${resumo.pendentes
          ? html`<p><strong>${artigos(resumo.pendentes)}</strong> por comprar na lista${resumo.pendentePrevisto ? html`, previsto <strong>${formatarKz(resumo.pendentePrevisto)}</strong>` : ''}.</p>`
          : html`<p class="nota">Não há artigos por comprar na lista. Podes registar artigos fora da lista.</p>`}
      </div>
      <button type="submit" class="botao botao--primario">Começar a registar</button>
    </form>`);

  const loja = raiz.querySelector('#loja');
  raiz.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-loja]');
    if (!chip) return;
    loja.value = chip.dataset.loja;
    mostrarErroCampo(loja, null);
  });
  loja.addEventListener('input', () => mostrarErroCampo(loja, null));
  raiz.querySelector('#data').addEventListener('change', (e) => mostrarErroCampo(e.target, null));

  const form = raiz.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    executar(form.querySelector('button[type="submit"]'), async () => {
      try {
        const compra = await iniciarCompra({ estabelecimento: loja.value, data: raiz.querySelector('#data').value || dataISO() });
        reiniciarEstado(compra.id);
      } catch (erro) {
        if (erro instanceof ErroKussumba && /onde/i.test(erro.message)) {
          mostrarErroCampo(loja, erro.message);
          loja.focus();
          return;
        }
        if (erro instanceof ErroKussumba && /data/i.test(erro.message)) {
          const campoData = raiz.querySelector('#data');
          mostrarErroCampo(campoData, erro.message);
          campoData.focus();
          return;
        }
        throw erro;
      }
      redesenhar();
    });
  });
}

// ---------- Registo artigo a artigo ----------

function blocoRegistados(itens) {
  if (!itens.length) return '';
  const mostrar = estado.verTodos || itens.length <= 3 ? itens : itens.slice(-2);
  return html`<ul class="registados" aria-label="Artigos registados">
    ${mostrar.map((i) => html`<li><button type="button" class="registado" data-registado="${i.id}">
      <span class="registado__texto">${icone('check')}<span>${i.nome} · ${formatarQuantidade(i.quantidade, i.unidade, i.unidadeTexto)}</span></span>
      <strong>${formatarKz(i.precoReal)}</strong>
    </button></li>`)}
  </ul>
  ${mostrar.length < itens.length
    ? html`<button type="button" class="botao botao--texto registados__todos" data-accao="ver-todos">Ver os ${itens.length} artigos registados</button>`
    : ''}`;
}

function cartaoActual(actual) {
  return html`<section class="artigo-actual" aria-labelledby="artigo-nome">
    <div class="artigo-actual__topo">
      <h2 id="artigo-nome">${actual.nome}</h2>
      <button type="button" class="artigo-actual__qtd" data-accao="quantidade">
        Quantidade: ${formatarQuantidade(estado.quantidade, actual.unidade, actual.unidadeTexto)}
      </button>
    </div>
    ${estado.extra ? html`<p class="etiqueta etiqueta--aviso artigo-actual__etiqueta">Fora da lista</p>` : ''}
    <p class="artigo-actual__rotulo" id="preco-rotulo">Preço pago</p>
    <p class="artigo-actual__valor" data-valor aria-live="polite"></p>
    <div class="artigo-actual__rodape">
      <p class="nota" data-contas></p>
      <p class="artigo-actual__diferenca" data-diferenca></p>
    </div>
    <p class="nota artigo-actual__anterior" data-anterior hidden></p>
  </section>`;
}

function teclado() {
  return html`<div class="teclado" role="group" aria-label="Teclado do preço pago">
    ${TECLAS.map((t) => html`<button type="button" class="tecla" data-tecla="${t}">${t}</button>`)}
    <button type="button" class="tecla" data-tecla="apagar" aria-label="Apagar">${icone('apagarTecla')}</button>
  </div>`;
}

function blocoFim(d, porComprar) {
  const ignorados = d.pendentes.filter((p) => estado.ignorados.has(p.id));
  const totalLista = d.itens.filter((i) => i.itemListaId).length + d.pendentes.length;
  let texto;
  if (!totalLista) texto = 'A lista deste mês está vazia. Usa "Artigo fora da lista" para registar o que compraste.';
  else if (!d.pendentes.length) texto = 'Registaste todos os artigos da lista.';
  else if (!porComprar.length) texto = `Não compraste aqui: ${ignorados.map((p) => p.nome).join(', ')}. Ficam na lista para outra ida.`;
  return html`<div class="cartao compra-fim">
    <p>${texto}</p>
    ${ignorados.length ? html`<button type="button" class="botao botao--texto" data-accao="mostrar-ignorados">Mostrar outra vez os que saltei</button>` : ''}
  </div>`;
}

function blocoTotais(d) {
  const r = d.resumo;
  if (!r.artigos) return '';
  const dif = r.diferenca;
  return html`<section class="cartao compra-totais" aria-labelledby="totais-titulo">
    <h2 class="visualmente-oculto" id="totais-titulo">Totais desta compra</h2>
    <dl class="pares">
      <div class="par"><dt>Total previsto</dt><dd>${formatarKz(r.previsto)}</dd></div>
      <div class="par"><dt>Total real</dt><dd>${formatarKz(r.real)}</dd></div>
      ${dif === null
        ? ''
        : html`<div class="par"><dt>Diferença</dt><dd class="${dif > 0 ? 'subida' : dif < 0 ? 'positivo' : ''}">${formatarKzComSinal(dif)}
            ${dif > 0 ? 'acima do previsto' : dif < 0 ? 'abaixo do previsto' : 'igual ao previsto'}</dd></div>`}
      <div class="par"><dt>Saldo do mês</dt><dd class="${d.saldoMes < 0 ? 'subida' : ''}">${formatarKz(d.saldoMes)}</dd></div>
    </dl>
    ${r.semPrevisao.artigos
      ? html`<p class="nota compra-totais__nota">O total real inclui ${formatarKz(r.semPrevisao.total)} de ${artigos(r.semPrevisao.artigos)} sem preço previsto. Esse valor não entra na diferença.</p>`
      : ''}
  </section>`;
}

async function desenharRegisto(raiz, { redesenhar, navegar }, compraId) {
  const d = await detalheCompra(compraId);
  if (estado.compraId !== compraId) reiniciarEstado(compraId);

  const porComprar = d.pendentes.filter((p) => !estado.ignorados.has(p.id));
  let actual = estado.extra;
  if (!actual) {
    actual = porComprar.find((p) => p.id === estado.actualId) ?? porComprar[0] ?? null;
    if (actual && actual.id !== estado.actualId) {
      estado.actualId = actual.id;
      estado.valor = '';
      estado.quantidade = null;
    }
  }
  if (actual && estado.quantidade === null) estado.quantidade = actual.quantidadePrevista;

  const daLista = d.itens.filter((i) => i.itemListaId);
  const foraDaLista = d.itens.length - daLista.length;
  const totalLista = daLista.length + d.pendentes.length;
  const registados = (n) => (n === 1 ? 'registado' : 'registados');
  const progresso = totalLista
    ? `${daLista.length} de ${artigos(totalLista)} ${registados(totalLista)} · faltam ${d.pendentes.length}`
    : `${artigos(d.itens.length)} ${registados(d.itens.length)}`;

  montar(raiz, html`
    <header class="compra-topo">
      <a class="botao-voltar" href="#/mes" aria-label="Voltar ao mês">${icone('voltar')}</a>
      <div class="compra-topo__sobra">
        <p>Sobra no mês</p>
        <p class="compra-topo__valor${d.saldoMes < 0 ? ' subida' : ''}">${formatarKz(d.saldoMes)}</p>
      </div>
    </header>
    <h1 class="compra-titulo" tabindex="-1">${d.compra.estabelecimento}</h1>
    <p class="compra-progresso">${progresso}${totalLista && foraDaLista ? ` · ${foraDaLista} fora da lista` : ''}</p>
    ${blocoRegistados(d.itens)}
    ${actual
      ? html`${cartaoActual(actual)}
        ${teclado()}
        <button type="button" class="botao botao--primario compra-guardar" data-accao="guardar" disabled>
          ${porComprar.length > 1 || estado.extra ? 'Guardar e seguinte' : 'Guardar'}
        </button>`
      : blocoFim(d, porComprar)}
    <div class="compra-secundarias">
      ${actual && !estado.extra ? html`<button type="button" class="botao botao--texto" data-accao="saltar">Não comprei aqui</button>` : ''}
      ${estado.extra ? html`<button type="button" class="botao botao--texto" data-accao="voltar-lista">Voltar à lista</button>` : ''}
      <button type="button" class="botao botao--texto" data-accao="fora">${icone('mais')}Artigo fora da lista</button>
    </div>
    ${blocoTotais(d)}
    <div class="compra-fecho">
      <button type="button" class="botao ${actual ? 'botao--secundario' : 'botao--primario'}" data-accao="concluir"${d.itens.length ? '' : html` disabled`}>Concluir compra</button>
      <button type="button" class="botao botao--texto botao--texto-perigo" data-accao="cancelar">Cancelar compra</button>
    </div>`);

  const botaoGuardar = raiz.querySelector('[data-accao="guardar"]');

  function contas() {
    const pago = lerKz(estado.valor) || null;
    return {
      pago,
      ...simularArtigo({
        quantidade: estado.quantidade,
        unidade: actual.unidade,
        unidadeTexto: actual.unidadeTexto,
        precoUnitarioPrevisto: actual.precoUnitarioPrevisto,
        precoReal: pago,
        anterior: actual.anterior,
      }),
    };
  }

  // Actualiza só o cartão do artigo, a cada tecla (§19, §20).
  function actualizarCartao() {
    if (!actual) return;
    const c = contas();
    const valor = raiz.querySelector('[data-valor]');
    valor.textContent = formatarKz(c.pago ?? 0);
    valor.classList.toggle('artigo-actual__valor--vazio', !c.pago);
    const partes = [c.previsto === null ? 'Sem preço previsto' : `Previsto ${formatarKz(c.previsto)}`];
    if (c.precoUnitarioBase !== null) partes.push(`agora ${formatarPrecoUnitario(c.precoUnitarioBase, c.unidadeBase)}`);
    raiz.querySelector('[data-contas]').textContent = partes.join(' · ');
    const diferenca = raiz.querySelector('[data-diferenca]');
    diferenca.textContent = c.diferenca === null ? '' : formatarKzComSinal(c.diferenca);
    diferenca.className = `artigo-actual__diferenca${c.diferenca > 0 ? ' subida' : c.diferenca < 0 ? ' positivo' : ''}`;
    const anterior = raiz.querySelector('[data-anterior]');
    anterior.hidden = !actual.anterior;
    if (actual.anterior) {
      anterior.textContent = `Última compra: ${formatarPrecoUnitario(actual.anterior.precoUnitarioBase, c.unidadeBase)}`
        + (c.variacao === null ? '' : ` · agora ${formatarPercentagem(c.variacao, { sinal: true })}`);
    }
    botaoGuardar.disabled = !c.pago;
  }

  function premir(tecla) {
    if (tecla === 'apagar') {
      estado.valor = estado.valor.slice(0, -1);
    } else {
      const novo = (estado.valor + tecla).replace(/^0+/, '');
      if (novo.length <= MAX_DIGITOS) estado.valor = novo;
    }
    actualizarCartao();
  }

  /** Pede confirmação quando o preço parece engano de digitação (SEC-007). Devolve true se pode gravar. */
  async function precoConfirmado(nome, pago, contasDoArtigo, anterior, previsto) {
    const motivo = motivoPrecoEstranho({
      precoReal: pago,
      plafond: d.mes.plafond,
      precoUnitarioBase: contasDoArtigo.precoUnitarioBase,
      anteriorUnitarioBase: anterior?.precoUnitarioBase ?? null,
      previsto,
    });
    if (!motivo) return true;
    return confirmar({
      titulo: 'Confirmas este preço?',
      texto: `${formatarKz(pago)} por ${nome} ${motivo}. Confirma que não é engano de digitação.`,
      confirmar: 'Sim, está certo',
      cancelar: 'Corrigir',
    });
  }

  async function guardar() {
    const c = contas();
    if (!c.pago) return;
    if (!(await precoConfirmado(actual.nome, c.pago, c, actual.anterior, c.previsto))) return;
    await registarArtigo({
      compraId,
      itemListaId: estado.extra ? null : actual.id,
      produtoId: estado.extra ? actual.produtoId : null,
      quantidade: estado.quantidade,
      precoReal: c.pago,
    });
    const aviso = alertaPreco({ nomeProduto: actual.nome, genero: actual.genero, variacao: c.variacao });
    mostrarAviso(aviso ? aviso.texto : `${actual.nome}: ${formatarKz(c.pago)} registado.`);
    limparArtigo();
    redesenhar();
  }

  function abrirQuantidade() {
    const folha = abrirFolha(html`
      <div class="folha__cabecalho">
        <div><h2>Quantidade comprada</h2>
          ${estado.extra ? '' : html`<p class="nota">Planeado: ${formatarQuantidade(actual.quantidadePrevista, actual.unidade, actual.unidadeTexto)}</p>`}</div>
        <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
      </div>
      ${seletorQuantidade({ id: 'qtd-comprada', quantidade: estado.quantidade, unidade: actual.unidade, unidadeTexto: actual.unidadeTexto })}
      <div class="folha__accoes"><button type="button" class="botao botao--primario" data-feito>Feito</button></div>`,
    { rotulo: 'Quantidade comprada' });
    const seletor = ligarSeletorQuantidade(folha.querySelector('[data-quantidade]'));
    folha.querySelector('[data-feito]').addEventListener('click', async () => {
      folha.querySelector('input').dispatchEvent(new Event('change'));
      const nova = seletor.valor();
      if (!estado.extra && pareceEngano(nova, actual.quantidadePrevista)) {
        const ok = await confirmar({
          titulo: 'Confirmas esta quantidade?',
          texto: `Planeaste ${formatarQuantidade(actual.quantidadePrevista, actual.unidade, actual.unidadeTexto)} e indicaste ${formatarQuantidade(nova, actual.unidade, actual.unidadeTexto)}.`,
          confirmar: 'Sim, está certo',
          cancelar: 'Corrigir',
        });
        if (!ok) return;
      }
      estado.quantidade = nova;
      folha.close();
      redesenhar();
    });
  }

  function abrirRegistado(item) {
    const folha = abrirFolha(html`
      <form novalidate>
        <div class="folha__cabecalho">
          <div><h2>${item.nome}</h2><p class="nota">Corrigir o que registaste</p></div>
          <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
        </div>
        <div class="campo"><span class="campo__rotulo">Quantidade</span>
          ${seletorQuantidade({ id: 'qtd-registada', quantidade: item.quantidade, unidade: item.unidade, unidadeTexto: item.unidadeTexto })}</div>
        ${campoKz({ id: 'preco-registado', rotulo: 'Preço pago', valor: item.precoReal })}
        <div class="folha__accoes">
          <button type="submit" class="botao botao--primario">Guardar</button>
          <button type="button" class="botao botao--texto botao--texto-perigo" data-retirar>Retirar desta compra</button>
        </div>
      </form>`, { rotulo: `Corrigir ${item.nome}` });
    ligarCamposKz(folha);
    const seletor = ligarSeletorQuantidade(folha.querySelector('[data-quantidade]'));
    const preco = folha.querySelector('#preco-registado');
    folha.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      executar(folha.querySelector('button[type="submit"]'), async () => {
        const pago = lerCampoKz(preco);
        const quantidade = seletor.valor();
        const contasCorrigidas = simularArtigo({ ...item, quantidade, precoReal: pago, anterior: item.anterior });
        if (!(await precoConfirmado(item.nome, pago, contasCorrigidas, item.anterior, contasCorrigidas.previsto))) return;
        try {
          await registarArtigo({
            compraId,
            itemListaId: item.itemListaId,
            produtoId: item.itemListaId ? null : item.produtoId,
            quantidade,
            precoReal: pago,
          });
        } catch (erro) {
          if (erro instanceof ErroKussumba && /preço/i.test(erro.message)) {
            mostrarErroCampo(preco, erro.message);
            return;
          }
          throw erro;
        }
        folha.close();
        redesenhar();
      });
    });
    folha.querySelector('[data-retirar]').addEventListener('click', (e) => {
      executar(e.currentTarget, async () => {
        await anularArtigo(item.id);
        folha.close();
        mostrarAviso(item.itemListaId ? `${item.nome} voltou a ficar por comprar.` : `${item.nome} saiu desta compra.`);
        redesenhar();
      });
    });
  }

  async function abrirForaDaLista() {
    const produtos = await listarProdutos();
    const folha = abrirFolha(html`
      <div class="folha__cabecalho">
        <div><h2>Artigo fora da lista</h2><p class="nota">Escolhe o produto que compraste.</p></div>
        <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <label class="pesquisa">
        <span class="visualmente-oculto">Procurar produto</span>
        <input type="search" placeholder="Procurar produto" autocomplete="off">
      </label>
      <ul class="linhas escolher-produto" data-produtos></ul>`, { rotulo: 'Artigo fora da lista' });
    const lista = folha.querySelector('[data-produtos]');
    const mostrar = (termo) => {
      const t = normalizarNome(termo);
      const visiveis = produtos.filter((p) => !t || p.nomeNormalizado.includes(t));
      montar(lista, visiveis.length
        ? visiveis.map((p) => html`<li><button type="button" class="linha" data-escolher="${p.id}">
            <span class="linha__texto"><span class="linha__titulo">${p.nome}</span></span>${icone('seguinte')}</button></li>`)
        : html`<li class="nota escolher-produto__vazio">Nenhum produto com este nome. Cria-o primeiro no catálogo.</li>`);
    };
    mostrar('');
    folha.querySelector('input[type="search"]').addEventListener('input', (e) => mostrar(e.target.value));
    lista.addEventListener('click', (e) => {
      const botao = e.target.closest('[data-escolher]');
      if (!botao) return;
      executar(botao, async () => {
        const produtoId = botao.dataset.escolher;
        if (d.itens.some((i) => i.produtoId === produtoId)) {
          mostrarAviso('Este produto já está registado nesta compra. Toca nele para corrigir.');
          return;
        }
        const naLista = d.pendentes.find((p) => p.produtoId === produtoId);
        folha.close();
        if (naLista) {
          // Está na lista: regista-se como artigo da lista, para a lista ficar certa.
          estado.ignorados.delete(naLista.id);
          Object.assign(estado, { extra: null, actualId: naLista.id, valor: '', quantidade: null });
        } else {
          Object.assign(estado, { extra: await produtoParaCompra(compraId, produtoId), valor: '', quantidade: null });
        }
        redesenhar();
      });
    });
  }

  async function concluir(botao) {
    if (d.pendentes.length) {
      const ok = await confirmar({
        titulo: 'Concluir esta compra?',
        texto: `${artigos(d.pendentes.length)} da lista ${d.pendentes.length === 1 ? 'fica' : 'ficam'} por comprar, para outra ida.`,
        confirmar: 'Concluir compra',
        cancelar: 'Continuar a registar',
      });
      if (!ok) return;
    }
    await executar(botao, async () => {
      await concluirCompra(compraId);
      reiniciarEstado(null);
      navegar(`compra/${compraId}/concluida`);
    });
  }

  async function cancelar(botao) {
    const ok = await confirmar({
      titulo: 'Cancelar esta compra?',
      texto: d.itens.length
        ? `${d.itens.length === 1 ? 'O artigo registado deixa' : `Os ${d.itens.length} artigos registados deixam`} de contar como gasto e a lista volta ao que estava.`
        : 'Ainda não registaste nenhum artigo.',
      confirmar: 'Cancelar compra',
      cancelar: 'Continuar a registar',
      perigo: true,
    });
    if (!ok) return;
    await executar(botao, async () => {
      await cancelarCompra(compraId);
      reiniciarEstado(null);
      mostrarAviso('Compra cancelada.');
      navegar('mes');
    });
  }

  raiz.addEventListener('click', (e) => {
    const tecla = e.target.closest('[data-tecla]');
    if (tecla) {
      premir(tecla.dataset.tecla);
      return;
    }
    const registado = e.target.closest('[data-registado]');
    if (registado) {
      abrirRegistado(d.itens.find((i) => i.id === registado.dataset.registado));
      return;
    }
    const botao = e.target.closest('[data-accao]');
    if (!botao) return;
    const accao = botao.dataset.accao;
    if (accao === 'guardar') executar(botao, guardar);
    if (accao === 'quantidade') abrirQuantidade();
    if (accao === 'saltar') {
      estado.ignorados.add(actual.id);
      limparArtigo();
      redesenhar();
    }
    if (accao === 'voltar-lista') {
      limparArtigo();
      redesenhar();
    }
    if (accao === 'mostrar-ignorados') {
      estado.ignorados.clear();
      redesenhar();
    }
    if (accao === 'ver-todos') {
      estado.verTodos = true;
      redesenhar();
    }
    if (accao === 'fora') executar(botao, abrirForaDaLista);
    if (accao === 'concluir') concluir(botao);
    if (accao === 'cancelar') cancelar(botao);
  });

  // No computador, o teclado físico também escreve o preço.
  const aoPremirTecla = (e) => {
    if (!raiz.isConnected) {
      document.removeEventListener('keydown', aoPremirTecla);
      return;
    }
    if (!actual || document.querySelector('dialog[open]') || e.target.closest?.('input, select, textarea')) return;
    // Enter e Backspace sobre um botão ou ligação pertencem a esse elemento.
    if ((e.key === 'Enter' || e.key === 'Backspace') && e.target.closest?.('button, a')) return;
    if (/^\d$/.test(e.key)) premir(e.key);
    else if (e.key === 'Backspace') premir('apagar');
    else if (e.key === 'Enter' && !botaoGuardar.disabled) executar(botaoGuardar, guardar);
    else return;
    e.preventDefault();
  };
  document.addEventListener('keydown', aoPremirTecla);

  actualizarCartao();
}

export async function desenhar(raiz, contexto) {
  const compra = await compraEmAndamento();
  if (!compra) {
    reiniciarEstado(null);
    await desenharInicio(raiz, contexto);
    return { separador: 'comprar' };
  }
  await desenharRegisto(raiz, contexto, compra.id);
  return { separador: null };
}
