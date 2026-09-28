// Histórico de preços (prompt mestre, §15 e §44).
// Cada artigo comprado gera um registo. Os preços são guardados por unidade de base
// (kg, L, unidade, pacote...) para as comparações nunca misturarem unidades.

import { paraBase, unidadeBase, unidade } from '../nucleo/unidades.js';
import { precoMedioPonderado, variacaoPercentual } from '../nucleo/calculos.js';

/** Identificador do registo de histórico de um artigo comprado: um registo por artigo, nunca dois. */
export function idHistorico(itemCompraId) {
  return 'h-' + itemCompraId;
}

export function criarRegistoHistorico(itemCompra, compra) {
  const quantidadeBase = paraBase(itemCompra.quantidade, itemCompra.unidade);
  return {
    id: idHistorico(itemCompra.id),
    produtoId: itemCompra.produtoId,
    itemCompraId: itemCompra.id,
    compraId: compra.id,
    mesId: compra.mesId,
    data: compra.data,
    estabelecimento: compra.estabelecimento,
    precoTotal: itemCompra.precoReal,
    quantidade: itemCompra.quantidade,
    unidade: itemCompra.unidade,
    unidadeTexto: itemCompra.unidadeTexto ?? null,
    quantidadeBase,
    unidadeBase: unidadeBase(itemCompra.unidade, itemCompra.unidadeTexto),
    precoUnitarioBase: itemCompra.precoReal / quantidadeBase,
    registadoEm: itemCompra.registadoEm,
    corrigidoEm: itemCompra.corrigidoEm ?? null,
  };
}

/** Ordem cronológica: primeiro pela data da compra, depois pela hora do registo. */
export function ordenarCronologicamente(registos) {
  return [...registos].sort((a, b) =>
    a.data === b.data ? String(a.registadoEm).localeCompare(String(b.registadoEm)) : a.data.localeCompare(b.data));
}

/**
 * Último preço comparável antes de uma compra: mesma unidade de base, data igual ou anterior,
 * e nunca a própria compra que está a ser registada.
 */
export function ultimoComparavel(registos, { unidadeBase: base, excluirCompraId = null, ateData = null }) {
  const candidatos = registos.filter((r) =>
    r.unidadeBase === base && r.compraId !== excluirCompraId && (ateData === null || r.data <= ateData));
  return ordenarCronologicamente(candidatos).at(-1) ?? null;
}

/**
 * Resumo do preço de um produto para o cartão de produto (§11):
 * último preço, preço anterior, preço médio e variação entre os dois últimos.
 */
export function resumoPreco(registos) {
  const ordenados = ordenarCronologicamente(registos);
  const ultimo = ordenados.at(-1);
  if (!ultimo) return null;
  const comparaveis = ordenados.filter((r) => r.unidadeBase === ultimo.unidadeBase);
  const anterior = comparaveis.length >= 2 ? comparaveis.at(-2) : null;
  return {
    ultimo,
    anterior,
    unidadeBase: ultimo.unidadeBase,
    medio: precoMedioPonderado(comparaveis),
    variacao: anterior ? variacaoPercentual(ultimo.precoUnitarioBase, anterior.precoUnitarioBase) : null,
    registos: comparaveis.length,
  };
}

/** Converte um preço por unidade de base para a unidade do artigo: 1 280 Kz/kg → 1,28 Kz/g. */
export function precoNaUnidade(precoUnitarioBase, idUnidade) {
  return precoUnitarioBase * unidade(idUnidade).factor;
}

/** Preço unitário estimado a partir do último preço pago, ou null se não houver preço comparável. */
export function estimativaPeloHistorico(registos, idUnidade, unidadeTexto = null) {
  const ultimo = ultimoComparavel(registos, { unidadeBase: unidadeBase(idUnidade, unidadeTexto) });
  return ultimo ? precoNaUnidade(ultimo.precoUnitarioBase, idUnidade) : null;
}

/** Leitura dentro de uma transacção: todos os registos de um produto. */
export function historicoDoProduto(t, produtoId) {
  return t.porIndice('historicoPrecos', 'produtoId', produtoId);
}
