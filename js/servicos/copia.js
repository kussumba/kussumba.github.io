// Cópia de segurança (prompt mestre, §33; auditoria SEC-003).
// Exporta todos os dados para um ficheiro e repõe-nos a partir dele, por exemplo ao mudar de telefone.
//
// Um ficheiro de cópia vem de fora da aplicação e é tratado como não fiável: tamanho limitado,
// cada campo validado, campos desconhecidos descartados, referências entre registos verificadas.
// A reposição é uma única transacção: ou entra tudo, ou nada muda.

import { transaccao, COLECOES, VERSAO_BD } from '../dados/db.js';
import { CATEGORIAS } from '../dados/catalogo-inicial.js';
import { unidadeValida } from '../nucleo/unidades.js';
import { carimbo, dataValida } from '../nucleo/datas.js';
import { ErroKussumba, MAXIMO_KZ } from './comum.js';
import { calcularRelatorio, recolherDadosRelatorio } from './relatorio.js';

export const FORMATO_COPIA = 'kussumba-copia';
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;
const REGISTOS_MAXIMOS = 200_000;

// ---------- Regras de cada campo ----------

const texto = (maximo) => (v) => typeof v === 'string' && v.length > 0 && v.length <= maximo;
const opcional = (regra) => (v) => v === null || v === undefined || regra(v);
const inteiroPositivo = (v) => Number.isSafeInteger(v) && v > 0;
const kz = (v) => inteiroPositivo(v) && v <= MAXIMO_KZ;
const positivo = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const naoNegativo = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const numero = (v) => typeof v === 'number' && Number.isFinite(v);
const booleano = (v) => typeof v === 'boolean';
const umDe = (valores) => (v) => valores.includes(v);
const data = (v) => typeof v === 'string' && dataValida(v);
const idMes = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const id = texto(80);
const instante = opcional(texto(40));

// Só estes campos são repostos; qualquer outro é descartado.
// O resumo dos meses fechados não vem da cópia: é recalculado a partir dos dados.
const ESQUEMA = {
  utilizador: {
    id: umDe(['eu']), nome: opcional(texto(60)), moeda: umDe(['AOA']), ultimaCopiaEm: instante,
    criadoEm: instante, actualizadoEm: instante,
  },
  meses: {
    id: idMes, ano: inteiroPositivo, mes: (v) => Number.isInteger(v) && v >= 1 && v <= 12, plafond: kz,
    estado: umDe(['aberto', 'fechado']), listaCopiadaDe: opcional(idMes),
    criadoEm: instante, fechadoEm: instante, actualizadoEm: instante,
  },
  produtos: {
    id, nome: texto(60), nomeNormalizado: texto(80), categoria: umDe(CATEGORIAS.map((c) => c.id)),
    unidade: unidadeValida, unidadeTexto: opcional(texto(20)), quantidadeSugerida: positivo,
    icone: opcional(texto(20)), genero: opcional(umDe(['o', 'a', 'os', 'as'])),
    basico: opcional(booleano), activo: booleano, personalizado: opcional(booleano),
    criadoEm: instante, actualizadoEm: instante,
  },
  itensLista: {
    id, mesId: idMes, produtoId: id, unidade: unidadeValida, unidadeTexto: opcional(texto(20)),
    quantidadePrevista: positivo, precoUnitarioPrevisto: opcional(naoNegativo), comprado: booleano,
    compraId: opcional(id), ordem: numero, criadoEm: instante, actualizadoEm: instante,
  },
  compras: {
    id, mesId: idMes, estabelecimento: texto(60), data, estado: umDe(['em_andamento', 'concluida']),
    origem: opcional(texto(20)), totalPrevisto: opcional(naoNegativo), totalReal: opcional(naoNegativo),
    diferenca: opcional(numero), artigos: opcional(naoNegativo),
    criadoEm: instante, concluidaEm: instante, actualizadoEm: instante,
  },
  itensCompra: {
    id, compraId: id, mesId: idMes, produtoId: id, itemListaId: opcional(id),
    quantidadePlaneada: opcional(positivo), quantidade: positivo, unidade: unidadeValida,
    unidadeTexto: opcional(texto(20)), precoUnitarioPrevisto: opcional(naoNegativo),
    precoPrevisto: opcional(naoNegativo), precoReal: kz, precoUnitarioReal: positivo,
    registadoEm: instante, corrigidoEm: instante, actualizadoEm: instante,
  },
  historicoPrecos: {
    id, produtoId: id, itemCompraId: id, compraId: id, mesId: idMes, data, estabelecimento: texto(60),
    precoTotal: kz, quantidade: positivo, unidade: unidadeValida, unidadeTexto: opcional(texto(20)),
    quantidadeBase: positivo, unidadeBase: texto(40), precoUnitarioBase: positivo,
    registadoEm: instante, corrigidoEm: instante,
  },
};

function danificada(detalhe) {
  return new ErroKussumba(`A cópia está danificada ou não é da KUSSUMBA (${detalhe}).`);
}

/** Valida um registo e devolve-o só com os campos conhecidos. */
function limparRegisto(colecao, registo, posicao) {
  if (!registo || typeof registo !== 'object' || Array.isArray(registo)) throw danificada(`${colecao}, registo ${posicao + 1}`);
  const limpo = {};
  for (const [campo, regra] of Object.entries(ESQUEMA[colecao])) {
    if (!regra(registo[campo])) throw danificada(`${colecao}, registo ${posicao + 1}, campo ${campo}`);
    if (registo[campo] !== undefined) limpo[campo] = registo[campo];
  }
  return limpo;
}

function verificarReferencias(d) {
  const ids = {};
  for (const colecao of COLECOES) {
    ids[colecao] = new Set(d[colecao].map((r) => r.id));
    if (ids[colecao].size !== d[colecao].length) throw danificada(`${colecao} com identificadores repetidos`);
  }
  const existe = (colecao, valor, onde) => {
    if (!ids[colecao].has(valor)) throw danificada(`${onde} refere um registo que não existe`);
  };
  if (d.utilizador.length !== 1) throw danificada('utilizador');
  if (!d.meses.length) throw danificada('sem meses');
  const abertos = d.meses.filter((m) => m.estado === 'aberto');
  if (abertos.length > 1) throw danificada('mais do que um mês aberto');

  for (const i of d.itensLista) {
    existe('meses', i.mesId, 'itensLista');
    existe('produtos', i.produtoId, 'itensLista');
    if (i.compraId) existe('compras', i.compraId, 'itensLista');
  }
  const compras = new Map(d.compras.map((c) => [c.id, c]));
  for (const c of d.compras) {
    existe('meses', c.mesId, 'compras');
    if (c.estado === 'em_andamento' && c.mesId !== abertos[0]?.id) throw danificada('compra em andamento num mês fechado');
  }
  if (d.compras.filter((c) => c.estado === 'em_andamento').length > 1) throw danificada('mais do que uma compra em andamento');
  for (const i of d.itensCompra) {
    existe('compras', i.compraId, 'itensCompra');
    existe('produtos', i.produtoId, 'itensCompra');
    if (compras.get(i.compraId).mesId !== i.mesId) throw danificada('itensCompra noutro mês');
    if (i.itemListaId) existe('itensLista', i.itemListaId, 'itensCompra');
  }
  const historicoPorArtigo = new Set();
  for (const h of d.historicoPrecos) {
    existe('produtos', h.produtoId, 'historicoPrecos');
    existe('itensCompra', h.itemCompraId, 'historicoPrecos');
    if (historicoPorArtigo.has(h.itemCompraId)) throw danificada('historicoPrecos repetido');
    historicoPorArtigo.add(h.itemCompraId);
  }
}

function resumir(dados, criadaEm) {
  return {
    criadaEm,
    meses: dados.meses.length,
    compras: dados.compras.length,
    artigosComprados: dados.itensCompra.length,
  };
}

// ---------- Exportar ----------

/** Todos os dados num texto JSON, pronto a guardar num ficheiro. */
export async function exportarCopia() {
  const dados = await transaccao(COLECOES, 'readonly', async (t) => {
    const resultado = {};
    for (const colecao of COLECOES) resultado[colecao] = await t.todos(colecao);
    return resultado;
  });
  // O resumo dos meses fechados não vai na cópia: recalcula-se ao repor.
  dados.meses = dados.meses.map(({ resumoFecho, ...mes }) => mes);
  const criadaEm = carimbo();
  return JSON.stringify({ formato: FORMATO_COPIA, versaoDados: VERSAO_BD, criadaEm, resumo: resumir(dados, criadaEm), dados });
}

/** Guarda a data da última cópia, para o utilizador saber quando fez a última. */
export async function registarCopiaFeita() {
  return transaccao(['utilizador'], 'readwrite', async (t) => {
    const utilizador = await t.obter('utilizador', 'eu');
    if (!utilizador) return null;
    utilizador.ultimaCopiaEm = carimbo();
    await t.guardar('utilizador', utilizador);
    return utilizador.ultimaCopiaEm;
  });
}

// ---------- Repor ----------

/**
 * Lê e valida o texto de um ficheiro de cópia. Não grava nada.
 * Devolve a cópia limpa e um resumo para o utilizador confirmar.
 */
export function lerCopia(textoDoFicheiro) {
  if (typeof textoDoFicheiro !== 'string' || textoDoFicheiro.length > TAMANHO_MAXIMO) {
    throw new ErroKussumba('O ficheiro é demasiado grande para ser uma cópia da KUSSUMBA.');
  }
  let bruto;
  try {
    bruto = JSON.parse(textoDoFicheiro);
  } catch {
    throw new ErroKussumba('Este ficheiro não é uma cópia da KUSSUMBA.');
  }
  if (!bruto || bruto.formato !== FORMATO_COPIA || !bruto.dados || typeof bruto.dados !== 'object') {
    throw new ErroKussumba('Este ficheiro não é uma cópia da KUSSUMBA.');
  }
  if (!Number.isInteger(bruto.versaoDados) || bruto.versaoDados < 1) throw danificada('versão');
  if (bruto.versaoDados > VERSAO_BD) {
    throw new ErroKussumba('Esta cópia foi feita por uma versão mais recente da KUSSUMBA. Actualiza a aplicação e tenta de novo.');
  }
  let total = 0;
  const dados = {};
  for (const colecao of COLECOES) {
    const registos = bruto.dados[colecao];
    if (!Array.isArray(registos)) throw danificada(colecao);
    total += registos.length;
    if (total > REGISTOS_MAXIMOS) throw danificada('demasiados registos');
    dados[colecao] = registos.map((r, i) => limparRegisto(colecao, r, i));
  }
  verificarReferencias(dados);
  const criadaEm = typeof bruto.criadaEm === 'string' ? bruto.criadaEm : null;
  return { dados, resumo: resumir(dados, criadaEm) };
}

/**
 * Substitui todos os dados deste telefone pelos da cópia já validada por lerCopia.
 * Os resumos dos meses fechados são recalculados a partir dos dados repostos.
 */
export async function reporCopia({ dados }) {
  return transaccao(COLECOES, 'readwrite', async (t) => {
    for (const colecao of COLECOES) await t.limpar(colecao);
    for (const colecao of COLECOES) {
      for (const registo of dados[colecao]) {
        await t.guardar(colecao, colecao === 'meses' ? { ...registo, resumoFecho: null } : registo);
      }
    }
    for (const mes of dados.meses.filter((m) => m.estado === 'fechado')) {
      const resumoFecho = calcularRelatorio(await recolherDadosRelatorio(t, mes.id));
      await t.guardar('meses', { ...mes, resumoFecho });
    }
    return resumir(dados, null);
  });
}
