// Lista de compras do mês: o PREVISTO (prompt mestre, §9 a §16).

import { transaccao } from '../dados/db.js';
import { novoId } from '../dados/ids.js';
import { precoTotal, totalPrevisto } from '../nucleo/calculos.js';
import { unidade as dadosUnidade, unidadeBase } from '../nucleo/unidades.js';
import { estadoDaLista } from '../nucleo/estados.js';
import { carimbo } from '../nucleo/datas.js';
import { ErroKussumba, exigirMesAberto, validarKz, validarQuantidade } from './comum.js';
import { estimativaPeloHistorico, historicoDoProduto } from './precos.js';

/** Junta ao item da lista os dados do produto e os valores calculados. */
export function enriquecerItem(item, produto) {
  const factor = dadosUnidade(item.unidade).factor;
  return {
    ...item,
    nome: produto?.nome ?? 'Produto removido',
    icone: produto?.icone ?? 'generico',
    categoria: produto?.categoria ?? 'outros',
    genero: produto?.genero ?? null,
    precoTotalPrevisto: precoTotal(item.quantidadePrevista, item.precoUnitarioPrevisto),
    unidadeBase: unidadeBase(item.unidade, item.unidadeTexto),
    precoUnitarioBasePrevisto: item.precoUnitarioPrevisto === null ? null : item.precoUnitarioPrevisto / factor,
  };
}

/**
 * Totais da lista. O total previsto soma todos os artigos com preço;
 * o pendente soma só o que ainda falta comprar, que é o que se compara com o saldo.
 */
export function resumoLista(itens) {
  const linhas = (lista) => lista.map((i) => ({ quantidade: i.quantidadePrevista, precoUnitario: i.precoUnitarioPrevisto }));
  const pendentes = itens.filter((i) => !i.comprado);
  const todos = totalPrevisto(linhas(itens));
  const porComprar = totalPrevisto(linhas(pendentes));
  const comprados = itens.length - pendentes.length;
  return {
    artigos: itens.length,
    comprados,
    pendentes: pendentes.length,
    totalPrevisto: todos.total,
    semPreco: todos.semPreco,
    pendentePrevisto: porComprar.total,
    pendenteSemPreco: porComprar.semPreco,
    estado: estadoDaLista({ artigos: itens.length, comprados }),
  };
}

function ordenarItens(itens) {
  return [...itens].sort((a, b) => a.ordem - b.ordem);
}

async function produtosPorId(t) {
  const produtos = await t.todos('produtos');
  return new Map(produtos.map((p) => [p.id, p]));
}

export async function obterLista(mesId) {
  return transaccao(['meses', 'itensLista', 'produtos'], 'readonly', async (t) => {
    const mes = await t.obter('meses', mesId);
    if (!mes) throw new ErroKussumba('Este mês não existe.');
    const produtos = await produtosPorId(t);
    const itens = ordenarItens(await t.porIndice('itensLista', 'mesId', mesId)).map((i) => enriquecerItem(i, produtos.get(i.produtoId)));
    return { mes, itens, resumo: resumoLista(itens) };
  });
}

/** Cria o registo de um item de lista. O preço previsto parte do último preço pago, se existir. */
export async function novoItemLista(t, { mesId, produto, quantidade, precoUnitarioPrevisto, ordem }) {
  let preco = precoUnitarioPrevisto;
  if (preco === undefined) {
    const registos = await historicoDoProduto(t, produto.id);
    preco = estimativaPeloHistorico(registos, produto.unidade, produto.unidadeTexto);
  }
  const instante = carimbo();
  return {
    id: novoId(),
    mesId,
    produtoId: produto.id,
    unidade: produto.unidade,
    unidadeTexto: produto.unidadeTexto ?? null,
    quantidadePrevista: quantidade,
    precoUnitarioPrevisto: preco ?? null,
    comprado: false,
    compraId: null,
    ordem,
    criadoEm: instante,
    actualizadoEm: instante,
  };
}

async function itemEditavel(t, itemId) {
  const item = await t.obter('itensLista', itemId);
  if (!item) throw new ErroKussumba('Este artigo já não está na lista.');
  exigirMesAberto(await t.obter('meses', item.mesId));
  if (item.comprado) throw new ErroKussumba('Este artigo já foi comprado. O que foi previsto fica guardado como estava.');
  return item;
}

/**
 * Acrescenta um produto à lista do mês. Se já lá estiver, devolve o item existente
 * em vez de criar um repetido.
 */
export async function adicionarProduto(mesId, produtoId, quantidade = null) {
  return transaccao(['meses', 'itensLista', 'produtos', 'historicoPrecos'], 'readwrite', async (t) => {
    exigirMesAberto(await t.obter('meses', mesId));
    const produto = await t.obter('produtos', produtoId);
    if (!produto || !produto.activo) throw new ErroKussumba('Este produto não está no catálogo.');
    const itens = await t.porIndice('itensLista', 'mesId', mesId);
    const existente = itens.find((i) => i.produtoId === produtoId);
    if (existente) return existente;
    const qtd = validarQuantidade(quantidade ?? produto.quantidadeSugerida ?? 1);
    const ordem = itens.reduce((max, i) => Math.max(max, i.ordem), 0) + 1;
    const item = await novoItemLista(t, { mesId, produto, quantidade: qtd, ordem });
    await t.guardar('itensLista', item);
    return item;
  });
}

/** Acrescenta os produtos básicos do catálogo que ainda não estão na lista (§46). */
export async function adicionarSugeridos(mesId) {
  return transaccao(['meses', 'itensLista', 'produtos', 'historicoPrecos'], 'readwrite', async (t) => {
    exigirMesAberto(await t.obter('meses', mesId));
    const produtos = (await t.todos('produtos')).filter((p) => p.activo && p.basico);
    const itens = await t.porIndice('itensLista', 'mesId', mesId);
    const naLista = new Set(itens.map((i) => i.produtoId));
    let ordem = itens.reduce((max, i) => Math.max(max, i.ordem), 0);
    let acrescentados = 0;
    for (const produto of produtos) {
      if (naLista.has(produto.id)) continue;
      ordem += 1;
      const item = await novoItemLista(t, { mesId, produto, quantidade: produto.quantidadeSugerida ?? 1, ordem });
      await t.guardar('itensLista', item);
      acrescentados += 1;
    }
    return acrescentados;
  });
}

/** Muda a quantidade prevista. O preço unitário mantém-se; o total é recalculado. */
export async function alterarQuantidade(itemId, quantidade) {
  const qtd = validarQuantidade(quantidade);
  return transaccao(['meses', 'itensLista'], 'readwrite', async (t) => {
    const item = await itemEditavel(t, itemId);
    item.quantidadePrevista = qtd;
    item.actualizadoEm = carimbo();
    await t.guardar('itensLista', item);
    return item;
  });
}

/**
 * Define o preço previsto a partir do total que o utilizador espera pagar pela quantidade prevista.
 * Guarda o preço unitário, para o total acompanhar as mudanças de quantidade.
 * Com null, o artigo fica sem preço previsto.
 */
export async function definirPrecoPrevisto(itemId, precoTotalPrevisto) {
  const total = precoTotalPrevisto === null ? null : validarKz(precoTotalPrevisto, 'Indica um preço maior do que zero.');
  return transaccao(['meses', 'itensLista'], 'readwrite', async (t) => {
    const item = await itemEditavel(t, itemId);
    item.precoUnitarioPrevisto = total === null ? null : total / item.quantidadePrevista;
    item.actualizadoEm = carimbo();
    await t.guardar('itensLista', item);
    return item;
  });
}

/** Altera quantidade e preço previsto de uma só vez (folha de edição da lista). */
export async function actualizarItem(itemId, { quantidade, precoTotalPrevisto }) {
  const qtd = validarQuantidade(quantidade);
  const total = precoTotalPrevisto === null ? null : validarKz(precoTotalPrevisto, 'Indica um preço maior do que zero.');
  return transaccao(['meses', 'itensLista'], 'readwrite', async (t) => {
    const item = await itemEditavel(t, itemId);
    item.quantidadePrevista = qtd;
    item.precoUnitarioPrevisto = total === null ? null : total / qtd;
    item.actualizadoEm = carimbo();
    await t.guardar('itensLista', item);
    return item;
  });
}

export async function removerDaLista(itemId) {
  return transaccao(['meses', 'itensLista'], 'readwrite', async (t) => {
    const item = await itemEditavel(t, itemId);
    await t.apagar('itensLista', item.id);
    return true;
  });
}
