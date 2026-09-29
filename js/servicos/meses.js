// Utilizador e ciclo de vida dos meses: primeira utilização (§45), plafond,
// fecho do mês (§30) e preparação do mês seguinte (§16, tela Novo mês).

import { transaccao } from '../dados/db.js';
import { precoTotal, sugestaoPlafond } from '../nucleo/calculos.js';
import { agora, carimbo, compararMeses, idMes, mesDaData, mesSeguinte, nomeMes, rotuloMes } from '../nucleo/datas.js';
import { ErroKussumba, exigirMesAberto, validarKz } from './comum.js';
import { estimativaPeloHistorico, historicoDoProduto } from './precos.js';
import { novoItemLista } from './lista.js';
import { calcularRelatorio, recolherDadosRelatorio } from './relatorio.js';

const MENSAGEM_PLAFOND = 'Indica um plafond maior do que zero.';

function novoRegistoMes(ano, mes, plafond, listaCopiadaDe, instante) {
  return {
    id: idMes(ano, mes),
    ano,
    mes,
    plafond,
    estado: 'aberto',
    listaCopiadaDe,
    criadoEm: instante,
    fechadoEm: null,
    resumoFecho: null,
    actualizadoEm: instante,
  };
}

export async function obterUtilizador() {
  return transaccao(['utilizador'], 'readonly', (t) => t.obter('utilizador', 'eu'));
}

/**
 * Primeira utilização: guarda o utilizador (sem dados pessoais) e cria o mês em curso
 * com o plafond indicado.
 */
export async function configurarInicio({ plafond }) {
  const valor = validarKz(plafond, MENSAGEM_PLAFOND);
  const { ano, mes } = mesDaData(agora());
  return transaccao(['utilizador', 'meses'], 'readwrite', async (t) => {
    if (await t.obter('utilizador', 'eu')) throw new ErroKussumba('A KUSSUMBA já está configurada neste telefone.');
    const instante = carimbo();
    await t.guardar('utilizador', { id: 'eu', nome: null, moeda: 'AOA', preferencias: {}, criadoEm: instante, actualizadoEm: instante });
    const registo = novoRegistoMes(ano, mes, valor, null, instante);
    await t.guardar('meses', registo);
    return registo;
  });
}

export async function obterMesAberto() {
  return transaccao(['meses'], 'readonly', async (t) => (await t.porIndice('meses', 'estado', 'aberto'))[0] ?? null);
}

export async function obterMes(id) {
  return transaccao(['meses'], 'readonly', (t) => t.obter('meses', id));
}

/** Mês que o Relatório mostra: o mês aberto ou, entre o fecho e o mês seguinte, o último mês. */
export async function mesParaRelatorio() {
  const meses = await transaccao(['meses'], 'readonly', (t) => t.todos('meses'));
  return meses.find((m) => m.estado === 'aberto') ?? meses.sort((a, b) => b.id.localeCompare(a.id))[0] ?? null;
}

export async function listarMeses() {
  const meses = await transaccao(['meses'], 'readonly', (t) => t.todos('meses'));
  return meses.sort((a, b) => b.id.localeCompare(a.id));
}

export async function alterarPlafond(mesId, plafond) {
  const valor = validarKz(plafond, MENSAGEM_PLAFOND);
  return transaccao(['meses'], 'readwrite', async (t) => {
    const mes = exigirMesAberto(await t.obter('meses', mesId));
    mes.plafond = valor;
    mes.actualizadoEm = carimbo();
    await t.guardar('meses', mes);
    return mes;
  });
}

/**
 * Mês que começa depois de fechar o último: o seguinte ao último mês,
 * ou o mês do calendário se entretanto já passaram meses sem uso.
 */
export function proximoMes(ultimo, hoje) {
  const seguinte = mesSeguinte(ultimo);
  const actual = mesDaData(hoje);
  return compararMeses(actual, seguinte) > 0 ? actual : seguinte;
}

/**
 * Fecha o mês (§30): congela o resumo, preserva todo o histórico e não apaga nada.
 * Não fecha com uma compra por concluir.
 */
export async function fecharMes(mesId) {
  return transaccao(['meses', 'itensLista', 'compras', 'itensCompra', 'produtos'], 'readwrite', async (t) => {
    const mes = exigirMesAberto(await t.obter('meses', mesId));
    const compras = await t.porIndice('compras', 'mesId', mesId);
    const emCurso = compras.find((c) => c.estado === 'em_andamento');
    if (emCurso) {
      throw new ErroKussumba(`Há uma compra por concluir em ${emCurso.estabelecimento}. Conclui-a ou cancela-a antes de fechar o mês.`);
    }
    const resumo = calcularRelatorio(await recolherDadosRelatorio(t, mesId));
    const instante = carimbo();
    Object.assign(mes, { estado: 'fechado', fechadoEm: instante, resumoFecho: resumo, actualizadoEm: instante });
    await t.guardar('meses', mes);
    return mes;
  });
}

/** Preço previsto para um artigo copiado: o último preço pago; sem ele, o previsto do mês anterior. */
async function precoParaCopia(t, item) {
  const registos = await historicoDoProduto(t, item.produtoId);
  return estimativaPeloHistorico(registos, item.unidade, item.unidadeTexto) ?? item.precoUnitarioPrevisto ?? null;
}

/**
 * Dados para a tela Novo mês: que mês vem a seguir, como fechou o anterior,
 * sugestão de plafond pelo cabaz e os artigos que podem ser copiados.
 */
export async function prepararNovoMes() {
  return transaccao(['meses', 'itensLista', 'produtos', 'historicoPrecos'], 'readonly', async (t) => {
    const meses = (await t.todos('meses')).sort((a, b) => a.id.localeCompare(b.id));
    const aberto = meses.find((m) => m.estado === 'aberto');
    if (aberto) return { mesAberto: aberto };
    const ultimo = meses.at(-1);
    if (!ultimo) throw new ErroKussumba('Ainda não há nenhum mês criado.');

    const { ano, mes } = proximoMes(ultimo, agora());
    const produtos = new Map((await t.todos('produtos')).map((p) => [p.id, p]));
    const itensAnteriores = (await t.porIndice('itensLista', 'mesId', ultimo.id)).sort((a, b) => a.ordem - b.ordem);
    const itens = [];
    for (const item of itensAnteriores) {
      const produto = produtos.get(item.produtoId);
      if (!produto?.activo) continue;
      const preco = await precoParaCopia(t, item);
      itens.push({
        itemId: item.id,
        produtoId: item.produtoId,
        nome: produto.nome,
        icone: produto.icone,
        quantidade: item.quantidadePrevista,
        unidade: item.unidade,
        unidadeTexto: item.unidadeTexto,
        precoUnitarioPrevisto: preco,
        precoTotalPrevisto: precoTotal(item.quantidadePrevista, preco),
      });
    }

    const resumo = ultimo.resumoFecho;
    const variacaoCabaz = resumo?.cabaz?.variacao ?? null;
    return {
      mesAberto: null,
      ano,
      mes,
      rotulo: rotuloMes(ano, mes),
      nomeMes: nomeMes(mes),
      anterior: {
        id: ultimo.id,
        nome: nomeMes(ultimo.mes),
        rotulo: rotuloMes(ultimo.ano, ultimo.mes),
        plafond: ultimo.plafond,
        sobrou: resumo?.sobrou ?? null,
        variacaoCabaz,
      },
      plafondSugerido: variacaoCabaz === null ? null : sugestaoPlafond(ultimo.plafond, variacaoCabaz),
      itens,
    };
  });
}

/**
 * Cria o mês seguinte. Com copiarDe, copia os artigos seleccionados da lista desse mês,
 * com os últimos preços pagos. Os dados do mês anterior ficam intactos.
 */
export async function criarMes({ plafond, copiarDe = null, itensSeleccionados = null }) {
  const valor = validarKz(plafond, MENSAGEM_PLAFOND);
  return transaccao(['meses', 'itensLista', 'produtos', 'historicoPrecos'], 'readwrite', async (t) => {
    const meses = (await t.todos('meses')).sort((a, b) => a.id.localeCompare(b.id));
    if (meses.some((m) => m.estado === 'aberto')) throw new ErroKussumba('Já existe um mês aberto. Fecha-o antes de começar outro.');
    const ultimo = meses.at(-1);
    if (!ultimo) throw new ErroKussumba('Ainda não há nenhum mês criado.');
    const { ano, mes } = proximoMes(ultimo, agora());
    const id = idMes(ano, mes);
    if (meses.some((m) => m.id === id)) throw new ErroKussumba(`${rotuloMes(ano, mes)} já existe.`);

    let origem = null;
    if (copiarDe) {
      const fonte = meses.find((m) => m.id === copiarDe);
      if (!fonte) throw new ErroKussumba('O mês a copiar não existe.');
      origem = fonte.id;
      const seleccao = itensSeleccionados ? new Set(itensSeleccionados) : null;
      const itens = (await t.porIndice('itensLista', 'mesId', fonte.id)).sort((a, b) => a.ordem - b.ordem);
      let ordem = 0;
      for (const item of itens) {
        if (seleccao && !seleccao.has(item.id)) continue;
        const produto = await t.obter('produtos', item.produtoId);
        if (!produto?.activo) continue;
        ordem += 1;
        const novo = await novoItemLista(t, {
          mesId: id,
          produto,
          quantidade: item.quantidadePrevista,
          precoUnitarioPrevisto: await precoParaCopia(t, item),
          ordem,
        });
        // Mantém a unidade do artigo copiado, que é a do preço calculado.
        novo.unidade = item.unidade;
        novo.unidadeTexto = item.unidadeTexto;
        await t.guardar('itensLista', novo);
      }
    }

    const registo = novoRegistoMes(ano, mes, valor, origem, carimbo());
    await t.guardar('meses', registo);
    return registo;
  });
}
