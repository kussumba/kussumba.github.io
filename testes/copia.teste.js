// Testes da cópia de segurança (auditoria SEC-003): ida e volta, e ficheiros adulterados ou danificados.

import { teste, igual, verdade, falha } from './mini-teste.js';
import { usarBaseDeDados, apagarBaseDeDados, transaccao } from '../js/dados/db.js';
import { definirRelogio } from '../js/nucleo/datas.js';
import * as Meses from '../js/servicos/meses.js';
import * as Lista from '../js/servicos/lista.js';
import * as Compras from '../js/servicos/compras.js';
import * as Relatorio from '../js/servicos/relatorio.js';
import * as Copia from '../js/servicos/copia.js';

const BD = 'kussumba-testes-copia';

function relogio(ano, mes, dia) {
  definirRelogio(() => new Date(ano, mes - 1, dia, 10, 0));
}

async function bdLimpa() {
  await apagarBaseDeDados(BD);
  usarBaseDeDados(BD);
}

/** Agosto fechado com uma compra; Setembro aberto com lista e uma compra concluída. */
async function cenario() {
  await bdLimpa();
  relogio(2026, 8, 5);
  const agosto = await Meses.configurarInicio({ plafond: 240000 });
  const arroz = await Lista.adicionarProduto(agosto.id, 'cat-arroz', 25);
  const c1 = await Compras.iniciarCompra({ estabelecimento: 'Grossista <b>Kikolo</b>', data: '2026-08-05' });
  await Compras.registarArtigo({ compraId: c1.id, itemListaId: arroz.id, quantidade: 25, precoReal: 30000 });
  await Compras.concluirCompra(c1.id);
  relogio(2026, 8, 31);
  await Meses.fecharMes(agosto.id);
  relogio(2026, 9, 2);
  const setembro = await Meses.criarMes({ plafond: 250000, copiarDe: agosto.id });
  const { itens } = await Lista.obterLista(setembro.id);
  const c2 = await Compras.iniciarCompra({ estabelecimento: 'Armazém do Cazenga', data: '2026-09-02' });
  await Compras.registarArtigo({ compraId: c2.id, itemListaId: itens[0].id, quantidade: 25, precoReal: 32000 });
  await Compras.concluirCompra(c2.id);
  return { agosto, setembro };
}

async function contagens() {
  return transaccao(['meses', 'produtos', 'itensLista', 'compras', 'itensCompra', 'historicoPrecos'], 'readonly', async (t) => ({
    meses: (await t.todos('meses')).length,
    produtos: (await t.todos('produtos')).length,
    itensLista: (await t.todos('itensLista')).length,
    compras: (await t.todos('compras')).length,
    itensCompra: (await t.todos('itensCompra')).length,
    historicoPrecos: (await t.todos('historicoPrecos')).length,
  }));
}

teste('cópia: guardar e repor devolve exactamente os mesmos dados e números', async () => {
  const { agosto, setembro } = await cenario();
  const antes = await contagens();
  const relatorioAgosto = await Relatorio.relatorioMes(agosto.id);
  const painelSetembro = await Relatorio.painelMes(setembro.id);
  const texto = await Copia.exportarCopia();
  const ficheiro = JSON.parse(texto);
  igual(ficheiro.formato, 'kussumba-copia');
  igual(ficheiro.resumo.meses, 2);
  igual(ficheiro.dados.meses.some((m) => 'resumoFecho' in m), false, 'o resumo congelado não vai na cópia');

  await bdLimpa();
  const copia = Copia.lerCopia(texto);
  await Copia.reporCopia(copia);
  const depois = await contagens();
  igual(JSON.stringify(depois), JSON.stringify(antes));
  const relatorioReposto = await Relatorio.relatorioMes(agosto.id);
  igual(relatorioReposto.congelado, true, 'o mês fechado continua fechado e com resumo');
  igual(relatorioReposto.sobrou, relatorioAgosto.sobrou);
  igual(relatorioReposto.gasto, relatorioAgosto.gasto);
  const painelReposto = await Relatorio.painelMes(setembro.id);
  igual(painelReposto.orcamento.saldo, painelSetembro.orcamento.saldo);
  igual(painelReposto.compras[0].estabelecimento, 'Armazém do Cazenga');
  const utilizador = await Meses.obterUtilizador();
  igual(utilizador.moeda, 'AOA');
});

teste('cópia: repor substitui os dados que já estavam no telefone', async () => {
  await cenario();
  const texto = await Copia.exportarCopia();
  await bdLimpa();
  relogio(2026, 9, 20);
  const outro = await Meses.configurarInicio({ plafond: 99000 });
  await Lista.adicionarProduto(outro.id, 'cat-gas', 1);
  await Copia.reporCopia(Copia.lerCopia(texto));
  const meses = await Meses.listarMeses();
  igual(meses.length, 2);
  igual(meses.find((m) => m.estado === 'aberto').plafond, 250000);
});

teste('cópia: regista a data da última cópia', async () => {
  await cenario();
  relogio(2026, 9, 3);
  const quando = await Copia.registarCopiaFeita();
  igual(quando.slice(0, 10), '2026-09-03');
  igual((await Meses.obterUtilizador()).ultimaCopiaEm, quando);
});

teste('cópia: recusa ficheiros que não são cópias da KUSSUMBA', () => {
  const recusa = (texto, parte) => {
    let erro = null;
    try { Copia.lerCopia(texto); } catch (e) { erro = e; }
    verdade(erro && erro.message.includes(parte), `esperava "${parte}", obtive ${erro ? `"${erro.message}"` : 'aceitação'}`);
  };
  recusa('isto não é JSON', 'não é uma cópia');
  recusa(JSON.stringify({ formato: 'outra-coisa', dados: {} }), 'não é uma cópia');
  recusa(JSON.stringify({ formato: 'kussumba-copia', versaoDados: 99, dados: {} }), 'versão mais recente');
  recusa(JSON.stringify({ formato: 'kussumba-copia', versaoDados: 1, dados: {} }), 'danificada');
  recusa('x'.repeat(Copia.TAMANHO_MAXIMO + 1), 'demasiado grande');
});

teste('cópia: recusa ficheiros adulterados e descarta campos desconhecidos', async () => {
  await cenario();
  const original = JSON.parse(await Copia.exportarCopia());
  const alterar = (mudanca) => {
    const copia = structuredClone(original);
    mudanca(copia.dados);
    return JSON.stringify(copia);
  };
  const recusa = async (texto, parte) => { await falha(() => Copia.lerCopia(texto), parte); };

  await recusa(alterar((d) => { d.itensCompra[0].precoReal = '32000'; }), 'campo precoReal');
  await recusa(alterar((d) => { d.itensCompra[0].precoReal = -5; }), 'campo precoReal');
  await recusa(alterar((d) => { d.itensCompra[0].compraId = 'inexistente'; }), 'não existe');
  await recusa(alterar((d) => { d.meses.forEach((m) => { m.estado = 'aberto'; }); }), 'mais do que um mês aberto');
  await recusa(alterar((d) => { d.produtos[0].nome = 'x'.repeat(5000); }), 'campo nome');
  await recusa(alterar((d) => { d.compras[0].data = '2026-02-31'; }), 'campo data');
  await recusa(alterar((d) => { d.produtos.push({ ...d.produtos[0] }); }), 'repetidos');
  await recusa(alterar((d) => { d.utilizador = []; }), 'utilizador');

  const comExtra = alterar((d) => { d.compras[0].malicioso = '<script>alert(1)</script>'; d.meses[0].resumoFecho = { precos: 'não é uma lista' }; });
  const lida = Copia.lerCopia(comExtra);
  igual('malicioso' in lida.dados.compras[0], false, 'campo desconhecido descartado');
  igual('resumoFecho' in lida.dados.meses[0], false, 'o resumo vindo do ficheiro nunca é usado');
  igual(lida.dados.compras.find((c) => c.estabelecimento.includes('<b>')).estabelecimento, 'Grossista <b>Kikolo</b>', 'o texto fica como foi escrito; o ecrã escapa-o');
});

teste('cópia: repõe o relógio real no fim', () => {
  definirRelogio(null);
});
