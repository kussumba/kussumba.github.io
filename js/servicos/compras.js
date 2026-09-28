// Idas às compras: o REALIZADO (prompt mestre, §18 a §23).
// Só o preço efectivamente pago conta como gasto. O previsto nunca entra no gasto real.

import { transaccao } from '../dados/db.js';
import { novoId } from '../dados/ids.js';
import { precoTotal, precoUnitario, variacaoPercentual, diferenca, saldo } from '../nucleo/calculos.js';
import { unidadeBase, paraBase } from '../nucleo/unidades.js';
import { carimbo, dataISO, dataValida } from '../nucleo/datas.js';
import { normalizarNome } from '../dados/catalogo-inicial.js';
import { ErroKussumba, exigirMesAberto, validarKz, validarQuantidade, validarTexto } from './comum.js';
import { criarRegistoHistorico, idHistorico, ultimoComparavel, historicoDoProduto } from './precos.js';
import { enriquecerItem } from './lista.js';

const TODAS = ['meses', 'compras', 'itensCompra', 'itensLista', 'produtos', 'historicoPrecos'];

/**
 * Totais de uma compra. A diferença só compara artigos que tinham preço previsto;
 * os artigos sem previsão entram no total real e são mostrados à parte.
 */
export function resumoCompra(itens) {
  const comPrevisao = itens.filter((i) => i.precoPrevisto !== null && i.precoPrevisto !== undefined);
  const semPrevisao = itens.filter((i) => i.precoPrevisto === null || i.precoPrevisto === undefined);
  const soma = (lista, campo) => lista.reduce((s, i) => s + i[campo], 0);
  const previsto = soma(comPrevisao, 'precoPrevisto');
  const realComPrevisao = soma(comPrevisao, 'precoReal');
  return {
    artigos: itens.length,
    previsto,
    realComPrevisao,
    real: soma(itens, 'precoReal'),
    diferenca: comPrevisao.length ? realComPrevisao - previsto : null,
    semPrevisao: { artigos: semPrevisao.length, total: soma(semPrevisao, 'precoReal') },
  };
}

/**
 * Contas de um artigo durante a compra (§19, §20, §22): previsto para a quantidade comprada,
 * diferença para o preço pago, preço por unidade de base e variação face à última compra.
 * A tela Comprar usa-a enquanto o utilizador escreve; o registo usa as mesmas regras ao gravar.
 */
export function simularArtigo({ quantidade, unidade, unidadeTexto = null, precoUnitarioPrevisto = null, precoReal = null, anterior = null }) {
  const previsto = precoTotal(quantidade, precoUnitarioPrevisto);
  const precoUnitarioBase = precoReal ? precoUnitario(precoReal, paraBase(quantidade, unidade)) : null;
  return {
    previsto,
    diferenca: precoReal ? diferenca(precoReal, previsto) : null,
    unidadeBase: unidadeBase(unidade, unidadeTexto),
    precoUnitarioBase,
    variacao: anterior && precoUnitarioBase !== null ? variacaoPercentual(precoUnitarioBase, anterior.precoUnitarioBase) : null,
  };
}

function resumoAnterior(registo) {
  return registo ? { precoUnitarioBase: registo.precoUnitarioBase, data: registo.data, estabelecimento: registo.estabelecimento } : null;
}

async function precoAnterior(t, compra, produtoId, base) {
  const registos = await historicoDoProduto(t, produtoId);
  return resumoAnterior(ultimoComparavel(registos, { unidadeBase: base, excluirCompraId: compra.id, ateData: compra.data }));
}

async function compraEditavel(t, compraId) {
  const compra = await t.obter('compras', compraId);
  if (!compra) throw new ErroKussumba('Esta compra não existe.');
  exigirMesAberto(await t.obter('meses', compra.mesId));
  if (compra.estado !== 'em_andamento') throw new ErroKussumba('Esta compra já foi concluída.');
  return compra;
}

async function mesAberto(t) {
  const abertos = await t.porIndice('meses', 'estado', 'aberto');
  if (!abertos.length) throw new ErroKussumba('Não há nenhum mês aberto.');
  return abertos[0];
}

/** Começa uma ida às compras no mês aberto. Só pode haver uma compra em andamento de cada vez. */
export async function iniciarCompra({ estabelecimento, data = dataISO() }) {
  const nome = validarTexto(estabelecimento, 'Escreve onde vais fazer as compras.', 60);
  if (!dataValida(data)) throw new ErroKussumba('Escolhe uma data válida.');
  return transaccao(['meses', 'compras'], 'readwrite', async (t) => {
    const mes = await mesAberto(t);
    const compras = await t.porIndice('compras', 'mesId', mes.id);
    const emCurso = compras.find((c) => c.estado === 'em_andamento');
    if (emCurso) throw new ErroKussumba(`Já tens uma compra em andamento em ${emCurso.estabelecimento}.`);
    const instante = carimbo();
    const compra = {
      id: novoId(),
      mesId: mes.id,
      estabelecimento: nome,
      data,
      estado: 'em_andamento',
      // "manual" hoje; a leitura de talões (§39) criará compras com outra origem,
      // que ficam em andamento até o utilizador as rever e confirmar.
      origem: 'manual',
      totalPrevisto: null,
      totalReal: null,
      diferenca: null,
      criadoEm: instante,
      concluidaEm: null,
      actualizadoEm: instante,
    };
    await t.guardar('compras', compra);
    return compra;
  });
}

/** Compra em andamento do mês aberto, ou null. */
export async function compraEmAndamento() {
  return transaccao(['meses', 'compras'], 'readonly', async (t) => {
    const abertos = await t.porIndice('meses', 'estado', 'aberto');
    if (!abertos.length) return null;
    const compras = await t.porIndice('compras', 'mesId', abertos[0].id);
    return compras.find((c) => c.estado === 'em_andamento') ?? null;
  });
}

/**
 * Tudo o que a tela Comprar precisa: a compra, os artigos já registados (com a comparação
 * de preços), os artigos da lista que faltam, os totais e o saldo do mês.
 */
export async function detalheCompra(compraId) {
  return transaccao(TODAS, 'readonly', async (t) => {
    const compra = await t.obter('compras', compraId);
    if (!compra) throw new ErroKussumba('Esta compra não existe.');
    const mes = await t.obter('meses', compra.mesId);
    const produtos = new Map((await t.todos('produtos')).map((p) => [p.id, p]));
    const itensDoMes = await t.porIndice('itensCompra', 'mesId', compra.mesId);
    const registados = itensDoMes
      .filter((i) => i.compraId === compra.id)
      .sort((a, b) => String(a.registadoEm).localeCompare(String(b.registadoEm)));

    const itens = [];
    for (const i of registados) {
      const produto = produtos.get(i.produtoId);
      const anterior = await precoAnterior(t, compra, i.produtoId, unidadeBase(i.unidade, i.unidadeTexto));
      const contas = simularArtigo({ ...i, anterior });
      itens.push({
        ...i,
        nome: produto?.nome ?? 'Produto removido',
        genero: produto?.genero ?? null,
        icone: produto?.icone ?? 'generico',
        unidadeBase: contas.unidadeBase,
        precoUnitarioBase: contas.precoUnitarioBase,
        diferenca: i.precoPrevisto === null ? null : diferenca(i.precoReal, i.precoPrevisto),
        anterior,
        variacao: contas.variacao,
      });
    }

    const lista = (await t.porIndice('itensLista', 'mesId', compra.mesId))
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => enriquecerItem(i, produtos.get(i.produtoId)));
    const pendentes = [];
    for (const i of lista.filter((item) => !item.comprado)) {
      pendentes.push({ ...i, anterior: await precoAnterior(t, compra, i.produtoId, i.unidadeBase) });
    }

    const gastoMes = itensDoMes.reduce((s, i) => s + i.precoReal, 0);
    return {
      compra,
      mes,
      itens,
      pendentes,
      artigosDaLista: lista.length,
      resumo: resumoCompra(itens),
      gastoMes,
      saldoMes: saldo(mes.plafond, gastoMes),
    };
  });
}

/** Produto escolhido fora da lista durante uma compra, com o último preço comparável. */
export async function produtoParaCompra(compraId, produtoId) {
  return transaccao(TODAS, 'readonly', async (t) => {
    const compra = await t.obter('compras', compraId);
    if (!compra) throw new ErroKussumba('Esta compra não existe.');
    const produto = await t.obter('produtos', produtoId);
    if (!produto) throw new ErroKussumba('Este produto não está no catálogo.');
    const base = unidadeBase(produto.unidade, produto.unidadeTexto);
    return {
      produtoId: produto.id,
      nome: produto.nome,
      genero: produto.genero ?? null,
      icone: produto.icone,
      unidade: produto.unidade,
      unidadeTexto: produto.unidadeTexto ?? null,
      quantidadePrevista: produto.quantidadeSugerida ?? 1,
      precoUnitarioPrevisto: null,
      unidadeBase: base,
      anterior: await precoAnterior(t, compra, produto.id, base),
    };
  });
}

/**
 * Regista o preço efectivamente pago por um artigo (§19, §22).
 * Se o artigo já estava registado nesta compra, actualiza o registo em vez de criar outro.
 * Grava ao mesmo tempo o artigo, o histórico de preços e a marca "comprado" na lista.
 */
export async function registarArtigo({ compraId, itemListaId = null, produtoId = null, quantidade, precoReal }) {
  const qtd = validarQuantidade(quantidade);
  const pago = validarKz(precoReal, 'Indica o preço pago, maior do que zero.');
  return transaccao(TODAS, 'readwrite', async (t) => {
    const compra = await compraEditavel(t, compraId);

    let itemLista = null;
    let idProduto = produtoId;
    if (itemListaId) {
      itemLista = await t.obter('itensLista', itemListaId);
      if (!itemLista || itemLista.mesId !== compra.mesId) throw new ErroKussumba('Este artigo não está na lista deste mês.');
      if (itemLista.comprado && itemLista.compraId !== compra.id) {
        throw new ErroKussumba('Este artigo já foi comprado noutra ida às compras.');
      }
      idProduto = itemLista.produtoId;
    }
    const produto = await t.obter('produtos', idProduto);
    if (!produto) throw new ErroKussumba('Escolhe um produto do catálogo.');

    const itensDaCompra = await t.porIndice('itensCompra', 'compraId', compra.id);
    const existente = itensDaCompra.find((i) =>
      itemLista ? i.itemListaId === itemLista.id : !i.itemListaId && i.produtoId === produto.id);

    const idUnidade = itemLista?.unidade ?? produto.unidade;
    const unidadeTexto = itemLista ? itemLista.unidadeTexto : produto.unidadeTexto ?? null;
    const precoUnitarioPrevisto = itemLista?.precoUnitarioPrevisto ?? null;
    const instante = carimbo();

    const item = {
      id: existente?.id ?? novoId(),
      compraId: compra.id,
      mesId: compra.mesId,
      produtoId: produto.id,
      itemListaId: itemLista?.id ?? null,
      quantidadePlaneada: itemLista?.quantidadePrevista ?? null,
      quantidade: qtd,
      unidade: idUnidade,
      unidadeTexto,
      precoUnitarioPrevisto,
      // Se a quantidade mudou, o previsto acompanha-a, para a diferença medir o preço e não a quantidade.
      precoPrevisto: precoTotal(qtd, precoUnitarioPrevisto),
      precoReal: pago,
      precoUnitarioReal: precoUnitario(pago, qtd),
      registadoEm: existente?.registadoEm ?? instante,
      corrigidoEm: null,
      actualizadoEm: instante,
    };
    await t.guardar('itensCompra', item);
    await t.guardar('historicoPrecos', criarRegistoHistorico(item, compra));

    if (itemLista) {
      itemLista.comprado = true;
      itemLista.compraId = compra.id;
      itemLista.actualizadoEm = instante;
      await t.guardar('itensLista', itemLista);
    }
    compra.actualizadoEm = instante;
    await t.guardar('compras', compra);
    return item;
  });
}

async function desfazerArtigo(t, item) {
  await t.apagar('itensCompra', item.id);
  await t.apagar('historicoPrecos', idHistorico(item.id));
  if (item.itemListaId) {
    const itemLista = await t.obter('itensLista', item.itemListaId);
    if (itemLista && itemLista.compraId === item.compraId) {
      itemLista.comprado = false;
      itemLista.compraId = null;
      itemLista.actualizadoEm = carimbo();
      await t.guardar('itensLista', itemLista);
    }
  }
}

/** Retira um artigo registado numa compra em andamento; o artigo volta a ficar por comprar na lista. */
export async function anularArtigo(itemCompraId) {
  return transaccao(TODAS, 'readwrite', async (t) => {
    const item = await t.obter('itensCompra', itemCompraId);
    if (!item) throw new ErroKussumba('Este artigo já não está registado.');
    await compraEditavel(t, item.compraId);
    await desfazerArtigo(t, item);
    return true;
  });
}

/** Conclui a compra e guarda os totais (§23). */
export async function concluirCompra(compraId) {
  return transaccao(TODAS, 'readwrite', async (t) => {
    const compra = await compraEditavel(t, compraId);
    const itens = await t.porIndice('itensCompra', 'compraId', compra.id);
    if (!itens.length) throw new ErroKussumba('Regista pelo menos um artigo antes de concluir a compra.');
    const resumo = resumoCompra(itens);
    const instante = carimbo();
    Object.assign(compra, {
      estado: 'concluida',
      totalPrevisto: resumo.previsto,
      totalReal: resumo.real,
      diferenca: resumo.diferenca,
      artigos: resumo.artigos,
      concluidaEm: instante,
      actualizadoEm: instante,
    });
    await t.guardar('compras', compra);
    return { compra, resumo };
  });
}

/** Cancela uma compra em andamento. Apaga os artigos registados nela; a lista volta ao que estava. */
export async function cancelarCompra(compraId) {
  return transaccao(TODAS, 'readwrite', async (t) => {
    const compra = await compraEditavel(t, compraId);
    const itens = await t.porIndice('itensCompra', 'compraId', compra.id);
    for (const item of itens) await desfazerArtigo(t, item);
    await t.apagar('compras', compra.id);
    return true;
  });
}

/**
 * Corrige um erro de digitação num artigo já registado, enquanto o mês estiver aberto.
 * O registo de histórico desse artigo é actualizado e fica marcado como corrigido;
 * os registos de outras compras nunca são tocados.
 */
export async function corrigirArtigo(itemCompraId, { quantidade, precoReal }) {
  const qtd = validarQuantidade(quantidade);
  const pago = validarKz(precoReal, 'Indica o preço pago, maior do que zero.');
  return transaccao(TODAS, 'readwrite', async (t) => {
    const item = await t.obter('itensCompra', itemCompraId);
    if (!item) throw new ErroKussumba('Este artigo já não está registado.');
    const compra = await t.obter('compras', item.compraId);
    exigirMesAberto(await t.obter('meses', compra.mesId));
    const instante = carimbo();
    Object.assign(item, {
      quantidade: qtd,
      precoPrevisto: precoTotal(qtd, item.precoUnitarioPrevisto),
      precoReal: pago,
      precoUnitarioReal: precoUnitario(pago, qtd),
      corrigidoEm: instante,
      actualizadoEm: instante,
    });
    await t.guardar('itensCompra', item);
    await t.guardar('historicoPrecos', criarRegistoHistorico(item, compra));
    if (compra.estado === 'concluida') {
      const resumo = resumoCompra(await t.porIndice('itensCompra', 'compraId', compra.id));
      Object.assign(compra, { totalPrevisto: resumo.previsto, totalReal: resumo.real, diferenca: resumo.diferenca, artigos: resumo.artigos });
    }
    compra.actualizadoEm = instante;
    await t.guardar('compras', compra);
    return item;
  });
}

/** Compras de um mês, das mais recentes para as mais antigas, com o total e o número de artigos. */
export async function listarCompras(mesId) {
  return transaccao(['compras', 'itensCompra'], 'readonly', async (t) => {
    const compras = await t.porIndice('compras', 'mesId', mesId);
    const itens = await t.porIndice('itensCompra', 'mesId', mesId);
    return resumirCompras(compras, itens);
  });
}

export function resumirCompras(compras, itensDoMes) {
  return compras
    .map((c) => {
      const itens = itensDoMes.filter((i) => i.compraId === c.id);
      return { ...c, artigos: itens.length, total: itens.reduce((s, i) => s + i.precoReal, 0) };
    })
    .sort((a, b) => (a.data === b.data ? String(b.criadoEm).localeCompare(String(a.criadoEm)) : b.data.localeCompare(a.data)));
}

/** Estabelecimentos já usados, do mais recente para o mais antigo, sem repetições. */
export async function estabelecimentosRecentes(limite = 6) {
  const compras = await transaccao(['compras'], 'readonly', (t) => t.todos('compras'));
  const ordenadas = compras.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const vistos = new Set();
  const nomes = [];
  for (const c of ordenadas) {
    const chave = normalizarNome(c.estabelecimento);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    nomes.push(c.estabelecimento);
    if (nomes.length >= limite) break;
  }
  return nomes;
}
