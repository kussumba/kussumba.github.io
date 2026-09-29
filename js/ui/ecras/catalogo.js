// Tela Catálogo (prompt mestre, §10 a §13; tela de referência 2).

import { html, montar } from '../html.js';
import { icone, iconeProduto } from '../icones.js';
import { abrirFolha, seletorQuantidade, ligarSeletorQuantidade, executar, mostrarAviso, tratarErro } from '../componentes.js';
import { formatarNumero, lerDecimal } from '../../nucleo/formatos.js';
import { formatarQuantidade, UNIDADES } from '../../nucleo/unidades.js';
import { CATEGORIAS, normalizarNome } from '../../dados/catalogo-inicial.js';
import { listarProdutos, criarProduto } from '../../servicos/produtos.js';
import { obterLista, adicionarProduto, removerDaLista, alterarQuantidade } from '../../servicos/lista.js';
import { ErroKussumba } from '../../servicos/comum.js';

export const titulo = 'Catálogo';
export const precisaMesAberto = true;

// A categoria escolhida mantém-se enquanto a aplicação estiver aberta.
let categoriaEscolhida = CATEGORIAS[0].id;

function artigosSeleccionados(n) {
  return html`<strong>${formatarNumero(n)} ${n === 1 ? 'artigo' : 'artigos'}</strong><span>${n === 1 ? 'seleccionado' : 'seleccionados'}</span>`;
}

function cartaoProduto(produto, item) {
  const naLista = Boolean(item);
  const estado = item?.comprado
    ? 'Já comprado'
    : naLista
      ? 'Na lista'
      : `Sugestão: ${formatarQuantidade(produto.quantidadeSugerida, produto.unidade, produto.unidadeTexto)}`;
  return html`<li class="produto${naLista ? ' produto--na-lista' : ''}">
    <button type="button" class="produto__tocar" data-produto="${produto.id}" aria-pressed="${naLista ? 'true' : 'false'}">
      <span class="produto__icone">${iconeProduto(produto.icone)}</span>
      ${naLista ? html`<span class="produto__marca">${icone('check')}</span>` : ''}
      <span class="produto__nome">${produto.nome}</span>
      <span class="produto__estado">${estado}</span>
    </button>
    ${naLista && !item.comprado
      ? seletorQuantidade({ id: item.id, quantidade: item.quantidadePrevista, unidade: item.unidade, unidadeTexto: item.unidadeTexto, compacto: true })
      : ''}
  </li>`;
}

function formularioNovoProduto(categoriaInicial) {
  return html`<form class="novo-produto" novalidate>
    <div class="folha__cabecalho">
      <div><h2>Novo produto</h2><p class="nota">Fica no teu catálogo e entra já na lista.</p></div>
      <button type="button" class="folha__fechar" data-fechar-folha aria-label="Fechar">${icone('fechar')}</button>
    </div>
    <div class="campo">
      <label class="campo__rotulo" for="np-nome">Nome</label>
      <input class="campo-texto" id="np-nome" type="text" maxlength="40" autocomplete="off" placeholder="Ex.: Farinha de mandioca">
    </div>
    <div class="campos-lado">
      <div class="campo">
        <label class="campo__rotulo" for="np-categoria">Categoria</label>
        <select class="campo-texto" id="np-categoria">
          ${CATEGORIAS.map((c) => html`<option value="${c.id}"${c.id === categoriaInicial ? html` selected` : ''}>${c.nome}</option>`)}
        </select>
      </div>
      <div class="campo">
        <label class="campo__rotulo" for="np-unidade">Unidade</label>
        <select class="campo-texto" id="np-unidade">
          ${UNIDADES.map((u) => html`<option value="${u.id}">${u.id === 'outro' ? 'outra' : u.singular}</option>`)}
        </select>
      </div>
    </div>
    <div class="campo" data-unidade-texto hidden>
      <label class="campo__rotulo" for="np-unidade-texto">Nome da unidade</label>
      <input class="campo-texto" id="np-unidade-texto" type="text" maxlength="20" autocomplete="off" placeholder="Ex.: molho">
    </div>
    <div class="campo">
      <label class="campo__rotulo" for="np-quantidade">Quantidade habitual</label>
      <input class="campo-texto" id="np-quantidade" type="text" inputmode="decimal" value="1" autocomplete="off">
    </div>
    <p class="campo__erro" data-erro hidden></p>
    <div class="folha__accoes">
      <button type="submit" class="botao botao--primario">Criar e pôr na lista</button>
    </div>
  </form>`;
}

export async function desenhar(raiz, { contexto }) {
  const mesId = contexto.mesAberto.id;
  let produtos = await listarProdutos();
  let lista = await obterLista(mesId);
  let pesquisa = '';

  montar(raiz, html`
    <header class="topo-voltar">
      <a class="botao-voltar" href="#/lista" aria-label="Voltar à lista">${icone('voltar')}</a>
      <h1 tabindex="-1">O que vais comprar?</h1>
    </header>
    <label class="pesquisa">
      <span class="visualmente-oculto">Procurar produto</span>
      <input type="search" placeholder="Procurar produto" autocomplete="off" enterkeyhint="search">
    </label>
    <div class="chips" data-chips role="group" aria-label="Categorias"></div>
    <p class="nota catalogo__aviso" data-aviso-pesquisa hidden>Resultados de todas as categorias.</p>
    <ul class="grelha" data-grelha aria-label="Produtos"></ul>
    <div class="rodape-fixo">
      <p class="rodape-fixo__texto" data-contagem></p>
      <a class="botao botao--primario rodape-fixo__botao" href="#/lista">Ver lista</a>
    </div>`);

  const grelha = raiz.querySelector('[data-grelha]');
  const chips = raiz.querySelector('[data-chips]');
  const contagem = raiz.querySelector('[data-contagem]');
  const avisoPesquisa = raiz.querySelector('[data-aviso-pesquisa]');

  function desenharChips() {
    montar(chips, CATEGORIAS.map((c) => html`<button type="button" class="chip" data-categoria="${c.id}"
      aria-pressed="${!pesquisa && c.id === categoriaEscolhida ? 'true' : 'false'}">${c.nome}</button>`));
  }

  function desenharGrelha(focarProduto = null) {
    const porProduto = new Map(lista.itens.map((i) => [i.produtoId, i]));
    const termo = normalizarNome(pesquisa);
    const visiveis = termo
      ? produtos.filter((p) => p.nomeNormalizado.includes(termo))
      : produtos.filter((p) => p.categoria === categoriaEscolhida);
    avisoPesquisa.hidden = !termo;
    montar(grelha, html`
      ${visiveis.map((p) => cartaoProduto(p, porProduto.get(p.id)))}
      ${termo && !visiveis.length ? html`<li class="grelha__vazia nota">Nenhum produto com este nome. Podes criá-lo.</li>` : ''}
      <li class="produto produto--novo">
        <button type="button" class="produto__tocar" data-novo-produto>${icone('mais')}<span>Novo produto</span></button>
      </li>`);
    for (const seletor of grelha.querySelectorAll('[data-quantidade]')) {
      const itemId = seletor.dataset.id;
      // O número já mudou no ecrã; só se grava e se actualizam os dados, sem redesenhar a grelha.
      ligarSeletorQuantidade(seletor, (nova) => {
        alterarQuantidade(itemId, nova)
          .then(async () => {
            lista = await obterLista(mesId);
          })
          .catch(tratarErro);
      });
    }
    montar(contagem, artigosSeleccionados(lista.itens.length));
    if (focarProduto) grelha.querySelector(`[data-produto="${CSS.escape(focarProduto)}"]`)?.focus();
  }

  async function recarregarLista(focarProduto = null) {
    lista = await obterLista(mesId);
    desenharGrelha(focarProduto);
  }

  async function alternar(botao) {
    const produtoId = botao.dataset.produto;
    const item = lista.itens.find((i) => i.produtoId === produtoId);
    if (item?.comprado) {
      mostrarAviso('Este artigo já foi comprado este mês.');
      return;
    }
    if (item) await removerDaLista(item.id);
    else await adicionarProduto(mesId, produtoId);
    await recarregarLista(produtoId);
  }

  function abrirNovoProduto() {
    const folha = abrirFolha(formularioNovoProduto(categoriaEscolhida), { rotulo: 'Novo produto' });
    const unidade = folha.querySelector('#np-unidade');
    const blocoTexto = folha.querySelector('[data-unidade-texto]');
    const erro = folha.querySelector('[data-erro]');
    const nome = folha.querySelector('#np-nome');
    nome.value = pesquisa;
    nome.focus();
    unidade.addEventListener('change', () => {
      blocoTexto.hidden = unidade.value !== 'outro';
    });
    folha.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      executar(folha.querySelector('button[type="submit"]'), async () => {
        try {
          const produto = await criarProduto({
            nome: nome.value,
            categoria: folha.querySelector('#np-categoria').value,
            unidade: unidade.value,
            unidadeTexto: folha.querySelector('#np-unidade-texto').value,
            quantidadeSugerida: lerDecimal(folha.querySelector('#np-quantidade').value) ?? 0,
          });
          await adicionarProduto(mesId, produto.id);
          folha.close();
          mostrarAviso(`${produto.nome} entrou no catálogo e na lista.`);
          produtos = await listarProdutos();
          categoriaEscolhida = produto.categoria;
          pesquisa = '';
          raiz.querySelector('input[type="search"]').value = '';
          desenharChips();
          await recarregarLista(produto.id);
        } catch (falha) {
          if (!(falha instanceof ErroKussumba)) throw falha;
          erro.textContent = falha.message;
          erro.hidden = false;
        }
      });
    });
  }

  raiz.querySelector('input[type="search"]').addEventListener('input', (e) => {
    pesquisa = e.target.value;
    desenharChips();
    desenharGrelha();
  });
  chips.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-categoria]');
    if (!chip) return;
    categoriaEscolhida = chip.dataset.categoria;
    pesquisa = '';
    raiz.querySelector('input[type="search"]').value = '';
    desenharChips();
    desenharGrelha();
  });
  grelha.addEventListener('click', (e) => {
    const produto = e.target.closest('[data-produto]');
    if (produto) {
      executar(produto, () => alternar(produto));
      return;
    }
    if (e.target.closest('[data-novo-produto]')) abrirNovoProduto();
  });

  desenharChips();
  desenharGrelha();
}
