// Testes da persistência local (IndexedDB). Usam uma base de dados própria, apagada antes de cada teste.

import { teste, igual, verdade, falha } from './mini-teste.js';
import { transaccao, usarBaseDeDados, apagarBaseDeDados, VERSAO_BD } from '../js/dados/db.js';
import { PRODUTOS_INICIAIS, CATEGORIAS, normalizarNome } from '../js/dados/catalogo-inicial.js';
import { novoId } from '../js/dados/ids.js';
import { unidadeValida } from '../js/nucleo/unidades.js';

export const BD_TESTES = 'kussumba-testes';

async function bdLimpa() {
  await apagarBaseDeDados(BD_TESTES);
  usarBaseDeDados(BD_TESTES);
}

teste('dados: a base de dados abre com o catálogo inicial', async () => {
  await bdLimpa();
  const produtos = await transaccao(['produtos'], 'readonly', (t) => t.todos('produtos'));
  igual(produtos.length, PRODUTOS_INICIAIS.length);
  verdade(VERSAO_BD >= 1);
  const arroz = produtos.find((p) => p.id === 'cat-arroz');
  igual(arroz.nome, 'Arroz');
  igual(arroz.unidade, 'kg');
  igual(arroz.quantidadeSugerida, 25);
  igual(arroz.activo, true);
  igual(arroz.personalizado, false);
  igual('precoEstimado' in arroz, false, 'o catálogo não traz preços inventados');
});

teste('dados: catálogo cobre as categorias e produtos do documento (§10)', async () => {
  const exigidos = ['Arroz', 'Óleo alimentar', 'Açúcar', 'Feijão', 'Fuba de milho', 'Leite em pó', 'Massa', 'Ovos',
    'Sabão em pó', 'Detergente', 'Papel higiénico', 'Frango', 'Carne', 'Peixe'];
  for (const nome of exigidos) verdade(PRODUTOS_INICIAIS.some((p) => p.nome === nome), `falta ${nome}`);
  igual(CATEGORIAS.map((c) => c.nome).join(','), 'Mercearia,Frescos,Limpeza,Higiene,Bebidas,Outros');
  for (const c of CATEGORIAS) verdade(PRODUTOS_INICIAIS.some((p) => p.categoria === c.id), `categoria vazia: ${c.nome}`);
  for (const p of PRODUTOS_INICIAIS) verdade(unidadeValida(p.unidade), `unidade inválida em ${p.nome}`);
  const ids = new Set(PRODUTOS_INICIAIS.map((p) => p.id));
  igual(ids.size, PRODUTOS_INICIAIS.length, 'identificadores repetidos no catálogo');
});

teste('dados: pesquisa sem acentos', () => {
  igual(normalizarNome('  Açúcar  '), 'acucar');
  igual(normalizarNome('Papel   Higiénico'), 'papel higienico');
});

teste('dados: guardar, ler por índice e apagar', async () => {
  await bdLimpa();
  const id = novoId();
  await transaccao(['itensLista'], 'readwrite', (t) =>
    t.guardar('itensLista', { id, mesId: '2026-09', produtoId: 'cat-arroz', quantidadePrevista: 25 }));
  const doMes = await transaccao(['itensLista'], 'readonly', (t) => t.porIndice('itensLista', 'mesId', '2026-09'));
  igual(doMes.length, 1);
  igual(doMes[0].quantidadePrevista, 25);
  await transaccao(['itensLista'], 'readwrite', (t) => t.apagar('itensLista', id));
  const depois = await transaccao(['itensLista'], 'readonly', (t) => t.obter('itensLista', id));
  igual(depois, undefined);
});

teste('dados: uma operação que falha a meio não deixa nada gravado', async () => {
  await bdLimpa();
  await falha(() => transaccao(['meses', 'itensLista'], 'readwrite', async (t) => {
    await t.guardar('meses', { id: '2026-09', estado: 'aberto' });
    await t.guardar('itensLista', { id: 'x', mesId: '2026-09' });
    throw new Error('falha simulada');
  }), 'falha simulada');
  const mes = await transaccao(['meses'], 'readonly', (t) => t.obter('meses', '2026-09'));
  const item = await transaccao(['itensLista'], 'readonly', (t) => t.obter('itensLista', 'x'));
  igual(mes, undefined, 'o mês não devia ter ficado gravado');
  igual(item, undefined, 'o item não devia ter ficado gravado');
});

teste('dados: o histórico de preços não aceita dois registos do mesmo artigo comprado', async () => {
  await bdLimpa();
  await transaccao(['historicoPrecos'], 'readwrite', (t) => t.guardar('historicoPrecos', { id: 'h1', produtoId: 'p', itemCompraId: 'ic1' }));
  await falha(() => transaccao(['historicoPrecos'], 'readwrite', (t) =>
    t.guardar('historicoPrecos', { id: 'h2', produtoId: 'p', itemCompraId: 'ic1' })));
  const todos = await transaccao(['historicoPrecos'], 'readonly', (t) => t.todos('historicoPrecos'));
  igual(todos.length, 1);
});

teste('dados: identificadores únicos', () => {
  const vistos = new Set();
  for (let i = 0; i < 1000; i++) vistos.add(novoId());
  igual(vistos.size, 1000);
  verdade(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(novoId()));
});
