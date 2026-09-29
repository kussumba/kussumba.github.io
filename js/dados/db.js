// Persistência local em IndexedDB. Só esta camada conhece o IndexedDB;
// os serviços de negócio usam apenas a função transaccao().
//
// Colecções (prompt mestre, §31):
//   utilizador       registo único "eu": moeda e preferências
//   meses            um registo por mês ("2026-09"): plafond, estado, datas, resumo congelado no fecho
//   produtos         catálogo local, incluindo os produtos criados pelo utilizador
//   itensLista       lista de compras de cada mês (o PREVISTO)
//   compras          cada ida às compras (o REALIZADO)
//   itensCompra      artigos registados em cada compra, com o preço efectivamente pago
//   historicoPrecos  um registo por artigo comprado; nunca é substituído em silêncio

import { PRODUTOS_INICIAIS, normalizarNome } from './catalogo-inicial.js';

export const NOME_BD = 'kussumba';

/** Todas as colecções, pela ordem em que se exportam e repõem. */
export const COLECOES = ['utilizador', 'meses', 'produtos', 'itensLista', 'compras', 'itensCompra', 'historicoPrecos'];

/** O navegador não deixa guardar dados (modo anónimo, navegador dentro de outra aplicação, definições). */
export class ErroArmazenamento extends Error {
  constructor() {
    super('Este navegador não deixa a KUSSUMBA guardar dados no telefone. Abre-a no Chrome, fora do modo anónimo.');
    this.name = 'ErroArmazenamento';
  }
}

// Cada migração corre uma única vez, pela ordem. Para mudar a estrutura, acrescenta-se
// uma migração nova no fim; as antigas nunca se alteram.
const MIGRACOES = [
  function versao1(bd, tx, instante) {
    bd.createObjectStore('utilizador', { keyPath: 'id' });

    const meses = bd.createObjectStore('meses', { keyPath: 'id' });
    meses.createIndex('estado', 'estado');

    const produtos = bd.createObjectStore('produtos', { keyPath: 'id' });
    produtos.createIndex('categoria', 'categoria');

    const lista = bd.createObjectStore('itensLista', { keyPath: 'id' });
    lista.createIndex('mesId', 'mesId');
    lista.createIndex('produtoId', 'produtoId');

    const compras = bd.createObjectStore('compras', { keyPath: 'id' });
    compras.createIndex('mesId', 'mesId');

    const itensCompra = bd.createObjectStore('itensCompra', { keyPath: 'id' });
    itensCompra.createIndex('compraId', 'compraId');
    itensCompra.createIndex('mesId', 'mesId');

    const historico = bd.createObjectStore('historicoPrecos', { keyPath: 'id' });
    historico.createIndex('produtoId', 'produtoId');
    historico.createIndex('itemCompraId', 'itemCompraId', { unique: true });

    for (const p of PRODUTOS_INICIAIS) {
      produtos.add({
        ...p,
        nomeNormalizado: normalizarNome(p.nome),
        unidadeTexto: null,
        activo: true,
        personalizado: false,
        criadoEm: instante,
        actualizadoEm: instante,
      });
    }
  },
];

export const VERSAO_BD = MIGRACOES.length;

let nomeActivo = NOME_BD;
const ligacoes = new Map();

/** Os testes usam uma base de dados separada para nunca tocarem nos dados reais. */
export function usarBaseDeDados(nome) {
  nomeActivo = nome;
}

function abrir(nome) {
  if (!ligacoes.has(nome)) {
    const promessa = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new ErroArmazenamento());
        return;
      }
      let pedido;
      try {
        pedido = indexedDB.open(nome, VERSAO_BD);
      } catch {
        reject(new ErroArmazenamento());
        return;
      }
      pedido.onupgradeneeded = (evento) => {
        const instante = new Date().toISOString();
        for (let v = evento.oldVersion; v < VERSAO_BD; v++) {
          MIGRACOES[v](pedido.result, pedido.transaction, instante);
        }
      };
      pedido.onsuccess = () => {
        const bd = pedido.result;
        // Se outra aba abrir uma versão mais recente, esta liga-se de novo em vez de a bloquear.
        bd.onversionchange = () => {
          bd.close();
          ligacoes.delete(nome);
        };
        resolve(bd);
      };
      pedido.onerror = () => {
        ligacoes.delete(nome);
        reject(pedido.error?.name === 'QuotaExceededError' ? pedido.error : new ErroArmazenamento());
      };
      pedido.onblocked = () => {
        ligacoes.delete(nome);
        reject(new Error('A KUSSUMBA está aberta noutra janela com uma versão antiga. Fecha as outras janelas e tenta de novo.'));
      };
    });
    ligacoes.set(nome, promessa);
  }
  return ligacoes.get(nome);
}

function pedidoParaPromessa(pedido) {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

/**
 * Executa um trabalho numa única transacção. Ou tudo fica gravado, ou nada fica:
 * se o trabalho lançar um erro, a transacção é anulada e os dados ficam como estavam.
 *
 * O trabalho só pode esperar (await) por operações desta transacção. Esperar por outra coisa
 * (outra transacção, um temporizador) fecha a transacção antes do tempo.
 */
export async function transaccao(colecoes, modo, trabalho) {
  const bd = await abrir(nomeActivo);
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(colecoes, modo);
    let resultado;
    let erro = null;

    const t = {
      obter: (colecao, chave) => pedidoParaPromessa(tx.objectStore(colecao).get(chave)),
      todos: (colecao) => pedidoParaPromessa(tx.objectStore(colecao).getAll()),
      porIndice: (colecao, indice, valor) => pedidoParaPromessa(tx.objectStore(colecao).index(indice).getAll(valor)),
      guardar: (colecao, registo) => pedidoParaPromessa(tx.objectStore(colecao).put(registo)),
      apagar: (colecao, chave) => pedidoParaPromessa(tx.objectStore(colecao).delete(chave)),
      limpar: (colecao) => pedidoParaPromessa(tx.objectStore(colecao).clear()),
    };

    let trabalhoTerminado = false;
    let transaccaoCompleta = false;

    // Só responde quando a transacção gravou E o trabalho terminou; um erro nunca se perde.
    const concluir = () => {
      if (!trabalhoTerminado || !transaccaoCompleta) return;
      if (erro) reject(erro);
      else resolve(resultado);
    };

    tx.oncomplete = () => {
      transaccaoCompleta = true;
      concluir();
    };
    tx.onabort = () => reject(erro ?? tx.error ?? new Error('A operação foi anulada.'));

    let execucao;
    try {
      execucao = Promise.resolve(trabalho(t));
    } catch (e) {
      execucao = Promise.reject(e);
    }
    execucao.then(
      (valor) => {
        resultado = valor;
        trabalhoTerminado = true;
        concluir();
      },
      (e) => {
        erro = e;
        trabalhoTerminado = true;
        try {
          tx.abort();
        } catch {
          // A transacção já tinha terminado; concluir() devolve o erro.
        }
        concluir();
      },
    );
  });
}

/** Fecha e apaga uma base de dados. Usado apenas pelos testes. */
export async function apagarBaseDeDados(nome) {
  if (ligacoes.has(nome)) {
    try {
      (await ligacoes.get(nome)).close();
    } catch {
      // Se a abertura falhou, não há nada para fechar.
    }
    ligacoes.delete(nome);
  }
  await new Promise((resolve, reject) => {
    const pedido = indexedDB.deleteDatabase(nome);
    pedido.onsuccess = () => resolve();
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => resolve();
  });
}

/**
 * Pede ao navegador que não apague os dados da KUSSUMBA quando o telefone tiver pouco espaço.
 * O navegador pode recusar; nesse caso os dados continuam guardados, só sem essa garantia extra.
 */
export async function pedirArmazenamentoPersistente() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}
