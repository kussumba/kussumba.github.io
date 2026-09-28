// Painel da tela Mês (§5 a §8, §38) e relatório de fecho (§24 a §29).

import { transaccao } from '../dados/db.js';
import { normalizarNome } from '../dados/catalogo-inicial.js';
import {
  saldo, percentagemUtilizada, totalReal, totalPrevisto, diferenca, variacaoPercentual,
  mediaDiaria, previsaoMensal, coberturaDaLista, precoMedioPonderado, cabaz, limitarPercentagem,
} from '../nucleo/calculos.js';
import { paraBase, unidadeBase } from '../nucleo/unidades.js';
import { agora, compararMeses, diasDecorridos, diasNoMes, diasRestantes, mesDaData, nomeMes, rotuloMes } from '../nucleo/datas.js';
import { alertasOrcamento, alertaLista, DIAS_MINIMOS_RITMO } from '../nucleo/alertas.js';
import { estadoDoMes } from '../nucleo/estados.js';
import { ErroKussumba } from './comum.js';
import { resumoLista } from './lista.js';
import { resumirCompras } from './compras.js';

/** O cabaz habitual só se mostra quando há pelo menos este número de produtos comprados nos dois meses. */
export const MIN_PRODUTOS_CABAZ = 3;

// ---------- Painel do mês ----------

export function calcularPainel({ mes, itensLista, compras, itensCompra, hoje }) {
  const gasto = totalReal(itensCompra);
  const saldoActual = saldo(mes.plafond, gasto);
  const percentagem = percentagemUtilizada(gasto, mes.plafond);
  const lista = resumoLista(itensLista);
  const decorridos = diasDecorridos(mes.ano, mes.mes, hoje);
  const restantes = diasRestantes(mes.ano, mes.mes, hoje);
  const totalDias = diasNoMes(mes.ano, mes.mes);
  const media = mediaDiaria(gasto, decorridos);
  const previsao = previsaoMensal(media, totalDias);
  const mesTerminado = mes.estado !== 'fechado' && compararMeses(mesDaData(hoje), mes) > 0;
  const comprasDoMes = resumirCompras(compras, itensCompra);

  return {
    mes,
    rotulo: rotuloMes(mes.ano, mes.mes),
    estado: estadoDoMes(mes, compras.length),
    orcamento: {
      plafond: mes.plafond,
      gasto,
      saldo: saldoActual,
      percentagem,
      ultrapassado: saldoActual < 0,
      larguraBarra: limitarPercentagem(percentagem),
    },
    lista: { ...lista, cobertura: coberturaDaLista(saldoActual, lista.pendentePrevisto) },
    ritmo: {
      diasDecorridos: decorridos,
      diasRestantes: restantes,
      diasNoMes: totalDias,
      mediaDiaria: media,
      previsaoMensal: previsao,
      disponivel: decorridos >= DIAS_MINIMOS_RITMO && gasto > 0,
      diasMinimos: DIAS_MINIMOS_RITMO,
      // Diferença entre a previsão e o plafond: positiva quando a previsão passa o plafond.
      faceAoPlafond: previsao === null ? null : diferenca(previsao, mes.plafond),
    },
    compras: comprasDoMes,
    compraEmAndamento: comprasDoMes.find((c) => c.estado === 'em_andamento') ?? null,
    mesTerminado,
    alertas: alertasOrcamento({
      plafond: mes.plafond,
      gasto,
      percentagem,
      diasRestantes: restantes,
      previsaoMensal: previsao,
      diasDecorridos: decorridos,
      mesTerminado,
      nomeDoMes: nomeMes(mes.mes),
    }),
    alertaLista: alertaLista({ pendente: lista.pendentePrevisto, saldo: saldoActual, artigosPendentes: lista.pendentes }),
  };
}

export async function painelMes(mesId) {
  return transaccao(['meses', 'itensLista', 'compras', 'itensCompra'], 'readonly', async (t) => {
    const mes = await t.obter('meses', mesId);
    if (!mes) throw new ErroKussumba('Este mês não existe.');
    const itensLista = await t.porIndice('itensLista', 'mesId', mesId);
    const compras = await t.porIndice('compras', 'mesId', mesId);
    const itensCompra = await t.porIndice('itensCompra', 'mesId', mesId);
    return calcularPainel({ mes, itensLista, compras, itensCompra, hoje: agora() });
  });
}

// ---------- Relatório do mês ----------

/** Agrupa os artigos comprados por produto e unidade de base, com o preço médio ponderado. */
function precosPorProduto(itensCompra) {
  const grupos = new Map();
  for (const i of itensCompra) {
    const base = unidadeBase(i.unidade, i.unidadeTexto);
    const chave = `${i.produtoId}|${base}`;
    const grupo = grupos.get(chave) ?? { produtoId: i.produtoId, unidadeBase: base, registos: [], total: 0, quantidadeBase: 0 };
    const quantidadeBase = paraBase(i.quantidade, i.unidade);
    grupo.registos.push({ precoTotal: i.precoReal, quantidadeBase });
    grupo.total += i.precoReal;
    grupo.quantidadeBase += quantidadeBase;
    grupos.set(chave, grupo);
  }
  for (const g of grupos.values()) g.precoMedio = precoMedioPonderado(g.registos);
  return grupos;
}

// Uma variação que arredonda a 0,0% não conta como aumento nem como redução.
function arredondada(v) {
  return Number(v.toFixed(1));
}

export function calcularRelatorio({ mes, itensLista, compras, itensCompra, produtos, anterior }) {
  const nome = (id) => produtos.get(id)?.nome ?? 'Produto removido';
  const gasto = totalReal(itensCompra);
  const sobrou = saldo(mes.plafond, gasto);
  const previsto = totalPrevisto(itensLista.map((i) => ({ quantidade: i.quantidadePrevista, precoUnitario: i.precoUnitarioPrevisto })));

  // Preços face ao mês anterior (§26): só produtos comprados nos dois meses, na mesma unidade de base.
  const actuais = precosPorProduto(itensCompra);
  const anteriores = anterior ? precosPorProduto(anterior.itensCompra) : new Map();
  const precos = [];
  for (const [chave, g] of actuais) {
    const a = anteriores.get(chave);
    if (!a || g.precoMedio === null || a.precoMedio === null) continue;
    precos.push({
      produtoId: g.produtoId,
      nome: nome(g.produtoId),
      unidadeBase: g.unidadeBase,
      anterior: a.precoMedio,
      actual: g.precoMedio,
      variacao: variacaoPercentual(g.precoMedio, a.precoMedio),
      quantidadeBase: g.quantidadeBase,
    });
  }
  precos.sort((x, y) => y.variacao - x.variacao || x.nome.localeCompare(y.nome));

  // Maiores alterações (§27).
  const aumentos = precos.filter((p) => arredondada(p.variacao) > 0);
  const reducoes = precos.filter((p) => arredondada(p.variacao) < 0);
  const gastoPorProduto = new Map();
  for (const i of itensCompra) gastoPorProduto.set(i.produtoId, (gastoPorProduto.get(i.produtoId) ?? 0) + i.precoReal);
  const [maiorDespesaId, maiorDespesaValor] = [...gastoPorProduto].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  // Onde gastou (§28): barras proporcionais à parte de cada estabelecimento no gasto total.
  const porLoja = new Map();
  for (const c of compras) {
    const total = itensCompra.filter((i) => i.compraId === c.id).reduce((s, i) => s + i.precoReal, 0);
    if (!total) continue;
    const chave = normalizarNome(c.estabelecimento);
    const loja = porLoja.get(chave) ?? { estabelecimento: c.estabelecimento, total: 0, idas: 0 };
    loja.total += total;
    loja.idas += 1;
    porLoja.set(chave, loja);
  }
  const ondeGastou = [...porLoja.values()]
    .sort((a, b) => b.total - a.total)
    .map((l) => ({ ...l, proporcao: gasto > 0 ? (l.total / gasto) * 100 : 0 }));

  // Cabaz habitual (§29): os mesmos produtos, nas quantidades deste mês, aos preços de cada mês.
  const cabazHabitual = precos.length >= MIN_PRODUTOS_CABAZ
    ? cabaz(precos.map((p) => ({ quantidade: p.quantidadeBase, precoActual: p.actual, precoAnterior: p.anterior })))
    : null;

  return {
    mesId: mes.id,
    rotulo: rotuloMes(mes.ano, mes.mes),
    nomeMes: nomeMes(mes.mes),
    plafond: mes.plafond,
    gasto,
    sobrou,
    ultrapassado: sobrou < 0,
    previsto: previsto.total,
    previstoSemPreco: previsto.semPreco,
    artigosNaLista: itensLista.length,
    diferencaPrevisto: itensLista.length && previsto.total > 0 ? diferenca(gasto, previsto.total) : null,
    mesAnterior: anterior ? { id: anterior.mes.id, nome: nomeMes(anterior.mes.mes), rotulo: rotuloMes(anterior.mes.ano, anterior.mes.mes) } : null,
    precos,
    maiorAumento: aumentos[0] ?? null,
    maiorReducao: reducoes.at(-1) ?? null,
    maiorDespesa: maiorDespesaId ? { produtoId: maiorDespesaId, nome: nome(maiorDespesaId), total: maiorDespesaValor } : null,
    ondeGastou,
    cabaz: cabazHabitual,
    compras: compras.length,
    artigosComprados: itensCompra.length,
  };
}

/** Reúne, dentro de uma transacção, os dados do mês e do último mês anterior com compras. */
export async function recolherDadosRelatorio(t, mesId) {
  const mes = await t.obter('meses', mesId);
  if (!mes) throw new ErroKussumba('Este mês não existe.');
  const itensLista = await t.porIndice('itensLista', 'mesId', mesId);
  const compras = await t.porIndice('compras', 'mesId', mesId);
  const itensCompra = await t.porIndice('itensCompra', 'mesId', mesId);
  const produtos = new Map((await t.todos('produtos')).map((p) => [p.id, p]));
  const mesesAntes = (await t.todos('meses')).filter((m) => m.id < mesId).sort((a, b) => b.id.localeCompare(a.id));
  let anterior = null;
  for (const m of mesesAntes) {
    const itens = await t.porIndice('itensCompra', 'mesId', m.id);
    if (itens.length) {
      anterior = { mes: m, itensCompra: itens };
      break;
    }
  }
  return { mes, itensLista, compras, itensCompra, produtos, anterior };
}

/** Relatório de um mês. Num mês fechado, devolve o resumo congelado no fecho. */
export async function relatorioMes(mesId) {
  return transaccao(['meses', 'itensLista', 'compras', 'itensCompra', 'produtos'], 'readonly', async (t) => {
    const mes = await t.obter('meses', mesId);
    if (mes?.estado === 'fechado' && mes.resumoFecho) return { ...mes.resumoFecho, congelado: true };
    return { ...calcularRelatorio(await recolherDadosRelatorio(t, mesId)), congelado: false };
  });
}
