// Catálogo de produtos (prompt mestre, §10 a §12).

import { transaccao } from '../dados/db.js';
import { novoId } from '../dados/ids.js';
import { CATEGORIAS, PRODUTOS_INICIAIS, normalizarNome } from '../dados/catalogo-inicial.js';
import { unidadeValida } from '../nucleo/unidades.js';
import { carimbo } from '../nucleo/datas.js';
import { ErroKussumba, validarTexto, validarQuantidade } from './comum.js';
import { resumoPreco, historicoDoProduto } from './precos.js';

const ORDEM_INICIAL = new Map(PRODUTOS_INICIAIS.map((p, i) => [p.id, i]));

/** Catálogo ordenado: primeiro os produtos iniciais pela ordem do catálogo, depois os criados pelo utilizador. */
export function ordenarCatalogo(produtos) {
  return [...produtos].sort((a, b) => {
    const oa = ORDEM_INICIAL.get(a.id) ?? Infinity;
    const ob = ORDEM_INICIAL.get(b.id) ?? Infinity;
    if (oa !== ob) return oa - ob;
    return a.nomeNormalizado.localeCompare(b.nomeNormalizado);
  });
}

export async function listarProdutos() {
  const todos = await transaccao(['produtos'], 'readonly', (t) => t.todos('produtos'));
  return ordenarCatalogo(todos.filter((p) => p.activo));
}

export async function obterProduto(id) {
  return transaccao(['produtos'], 'readonly', (t) => t.obter('produtos', id));
}

/** Produto e resumo do seu histórico de preços, para o cartão de produto (§11). */
export async function detalheProduto(produtoId) {
  return transaccao(['produtos', 'historicoPrecos'], 'readonly', async (t) => {
    const produto = await t.obter('produtos', produtoId);
    if (!produto) throw new ErroKussumba('Este produto não existe.');
    const registos = await historicoDoProduto(t, produtoId);
    return { produto, preco: resumoPreco(registos) };
  });
}

/** Cria um produto personalizado. Não aceita dois produtos activos com o mesmo nome. */
export async function criarProduto({ nome, categoria, unidade, unidadeTexto = null, quantidadeSugerida = 1 }) {
  const nomeLimpo = validarTexto(nome, 'Escreve o nome do produto.', 40);
  if (!CATEGORIAS.some((c) => c.id === categoria)) throw new ErroKussumba('Escolhe uma categoria.');
  if (!unidadeValida(unidade)) throw new ErroKussumba('Escolhe uma unidade.');
  const texto = unidade === 'outro' ? validarTexto(unidadeTexto, 'Escreve o nome da unidade.', 20) : null;
  const quantidade = validarQuantidade(quantidadeSugerida);
  const nomeNormalizado = normalizarNome(nomeLimpo);

  return transaccao(['produtos'], 'readwrite', async (t) => {
    const existentes = await t.todos('produtos');
    if (existentes.some((p) => p.activo && p.nomeNormalizado === nomeNormalizado)) {
      throw new ErroKussumba('Já existe um produto com este nome no catálogo.');
    }
    const instante = carimbo();
    const produto = {
      id: novoId(),
      nome: nomeLimpo,
      nomeNormalizado,
      categoria,
      unidade,
      unidadeTexto: texto,
      quantidadeSugerida: quantidade,
      icone: 'generico',
      genero: null,
      basico: false,
      activo: true,
      personalizado: true,
      criadoEm: instante,
      actualizadoEm: instante,
    };
    await t.guardar('produtos', produto);
    return produto;
  });
}
