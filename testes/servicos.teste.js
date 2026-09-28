// Testes dos serviços de negócio com a base de dados real (IndexedDB de testes).

import { teste, igual, aproximado, verdade, falha, ui } from './mini-teste.js';
import { usarBaseDeDados, apagarBaseDeDados, transaccao } from '../js/dados/db.js';
import { definirRelogio } from '../js/nucleo/datas.js';
import { formatarKz, formatarPercentagem } from '../js/nucleo/formatos.js';
import * as Meses from '../js/servicos/meses.js';
import * as Lista from '../js/servicos/lista.js';
import * as Compras from '../js/servicos/compras.js';
import * as Produtos from '../js/servicos/produtos.js';
import * as Relatorio from '../js/servicos/relatorio.js';

const BD = 'kussumba-testes-servicos';

function relogio(ano, mes, dia) {
  definirRelogio(() => new Date(ano, mes - 1, dia, 10, 0));
}

async function comecar(ano, mes, dia, plafond = 250000) {
  await apagarBaseDeDados(BD);
  usarBaseDeDados(BD);
  relogio(ano, mes, dia);
  return Meses.configurarInicio({ plafond });
}

async function itemDe(mesId, produtoId) {
  const { itens } = await Lista.obterLista(mesId);
  return itens.find((i) => i.produtoId === produtoId);
}

/** Agosto: uma compra com arroz, óleo, feijão e açúcar. Fecha Agosto e cria Setembro copiando a lista. */
async function cenarioAgostoSetembro() {
  const agosto = await comecar(2026, 8, 5, 240000);
  for (const [id, qtd] of [['cat-arroz', 25], ['cat-oleo', 5], ['cat-feijao', 5], ['cat-acucar', 10]]) {
    await Lista.adicionarProduto(agosto.id, id, qtd);
  }
  const compraAgosto = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo', data: '2026-08-05' });
  const precosAgosto = { 'cat-arroz': 30000, 'cat-oleo': 8500, 'cat-feijao': 7500, 'cat-acucar': 12000 };
  for (const [produtoId, preco] of Object.entries(precosAgosto)) {
    const item = await itemDe(agosto.id, produtoId);
    await Compras.registarArtigo({ compraId: compraAgosto.id, itemListaId: item.id, quantidade: item.quantidadePrevista, precoReal: preco });
  }
  await Compras.concluirCompra(compraAgosto.id);
  relogio(2026, 8, 31);
  await Meses.fecharMes(agosto.id);

  relogio(2026, 9, 1);
  const setembro = await Meses.criarMes({ plafond: 250000, copiarDe: agosto.id });
  return { agosto, setembro, compraAgosto };
}

/** Setembro: compra no Armazém do Cazenga com os preços das telas de referência. */
async function compraSetembro(setembro) {
  relogio(2026, 9, 2);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Armazém do Cazenga', data: '2026-09-02' });
  const precos = { 'cat-arroz': 32000, 'cat-oleo': 9500, 'cat-feijao': 7500, 'cat-acucar': 11000 };
  for (const [produtoId, preco] of Object.entries(precos)) {
    const item = await itemDe(setembro.id, produtoId);
    await Compras.registarArtigo({ compraId: compra.id, itemListaId: item.id, quantidade: item.quantidadePrevista, precoReal: preco });
  }
  return compra;
}

// ---------- Primeira utilização e meses ----------

teste('serviços: primeira utilização cria o utilizador e o mês em curso', async () => {
  const mes = await comecar(2026, 9, 18);
  igual(mes.id, '2026-09');
  igual(mes.plafond, 250000);
  igual(mes.estado, 'aberto');
  const u = await Meses.obterUtilizador();
  igual(u.moeda, 'AOA');
  igual(u.nome, null, 'não recolhe dados pessoais');
  await falha(() => Meses.configurarInicio({ plafond: 100000 }), 'já está configurada');
});

teste('serviços: plafond tem de ser maior do que zero', async () => {
  await apagarBaseDeDados(BD);
  usarBaseDeDados(BD);
  await falha(() => Meses.configurarInicio({ plafond: 0 }), 'plafond');
  await falha(() => Meses.configurarInicio({ plafond: 12.5 }), 'plafond');
  await falha(() => Meses.configurarInicio({ plafond: null }), 'plafond');
});

teste('serviços: mês seguinte ao fecho, saltando meses sem uso', () => {
  const r1 = Meses.proximoMes({ ano: 2026, mes: 9 }, new Date(2026, 8, 28));
  igual(`${r1.ano}-${r1.mes}`, '2026-10', 'fechar Setembro ainda em Setembro abre Outubro');
  const r2 = Meses.proximoMes({ ano: 2026, mes: 9 }, new Date(2026, 11, 5));
  igual(`${r2.ano}-${r2.mes}`, '2026-12', 'depois de meses sem uso, abre o mês do calendário');
  const r3 = Meses.proximoMes({ ano: 2026, mes: 12 }, new Date(2026, 11, 31));
  igual(`${r3.ano}-${r3.mes}`, '2027-1');
});

// ---------- Lista ----------

teste('serviços: lista sem repetidos, com quantidade sugerida e sem preço inventado', async () => {
  const mes = await comecar(2026, 9, 1);
  const a = await Lista.adicionarProduto(mes.id, 'cat-arroz');
  const b = await Lista.adicionarProduto(mes.id, 'cat-arroz');
  igual(a.id, b.id, 'o mesmo produto não entra duas vezes');
  igual(a.quantidadePrevista, 25);
  igual(a.precoUnitarioPrevisto, null, 'sem histórico, não há preço previsto');
  const { resumo } = await Lista.obterLista(mes.id);
  igual(resumo.artigos, 1);
  igual(resumo.semPreco, 1);
  igual(resumo.totalPrevisto, 0);
  igual(resumo.estado, 'criada');
});

teste('serviços: começar com produtos sugeridos (§46)', async () => {
  const mes = await comecar(2026, 9, 1);
  await Lista.adicionarProduto(mes.id, 'cat-arroz');
  const acrescentados = await Lista.adicionarSugeridos(mes.id);
  const { resumo } = await Lista.obterLista(mes.id);
  igual(acrescentados, 9, 'o arroz já estava na lista');
  igual(resumo.artigos, 10);
});

teste('serviços: preço previsto e quantidade (§13, §14)', async () => {
  const mes = await comecar(2026, 9, 1);
  const item = await Lista.adicionarProduto(mes.id, 'cat-sabao-po', 3);
  await Lista.definirPrecoPrevisto(item.id, 6800);
  let actual = await itemDe(mes.id, 'cat-sabao-po');
  igual(actual.precoTotalPrevisto, 6800);
  igual(formatarKz(actual.precoUnitarioBasePrevisto), ui('2 267 Kz'));
  await Lista.alterarQuantidade(item.id, 4);
  actual = await itemDe(mes.id, 'cat-sabao-po');
  igual(actual.precoTotalPrevisto, 9067, 'o total acompanha a quantidade');
  await Lista.definirPrecoPrevisto(item.id, null);
  actual = await itemDe(mes.id, 'cat-sabao-po');
  igual(actual.precoTotalPrevisto, null);
  await falha(() => Lista.alterarQuantidade(item.id, 0), 'quantidade');
  await falha(() => Lista.definirPrecoPrevisto(item.id, -5), 'preço');
  await Lista.removerDaLista(item.id);
  igual((await Lista.obterLista(mes.id)).itens.length, 0);
});

teste('serviços: produtos personalizados (§10)', async () => {
  await comecar(2026, 9, 1);
  const p = await Produtos.criarProduto({ nome: '  Coca-Cola  ', categoria: 'bebidas', unidade: 'lata', quantidadeSugerida: 12 });
  igual(p.nome, 'Coca-Cola');
  igual(p.personalizado, true);
  await falha(() => Produtos.criarProduto({ nome: 'coca-cola', categoria: 'bebidas', unidade: 'lata' }), 'Já existe');
  await falha(() => Produtos.criarProduto({ nome: 'acucar', categoria: 'mercearia', unidade: 'kg' }), 'Já existe');
  await falha(() => Produtos.criarProduto({ nome: '', categoria: 'bebidas', unidade: 'lata' }), 'nome');
  await falha(() => Produtos.criarProduto({ nome: 'Kitaba', categoria: 'bebidas', unidade: 'outro' }), 'unidade');
  const k = await Produtos.criarProduto({ nome: 'Kitaba', categoria: 'mercearia', unidade: 'outro', unidadeTexto: 'pacotinho' });
  igual(k.unidadeTexto, 'pacotinho');
  const catalogo = await Produtos.listarProdutos();
  igual(catalogo[0].id, 'cat-arroz', 'produtos do catálogo primeiro');
  igual(catalogo.at(-1).nome, 'Kitaba');
});

// ---------- Compras ----------

teste('serviços: registo da compra actualiza saldo, lista e histórico (§18 a §21)', async () => {
  const mes = await comecar(2026, 9, 2);
  const oleo = await Lista.adicionarProduto(mes.id, 'cat-oleo', 5);
  await Lista.definirPrecoPrevisto(oleo.id, 9500);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Armazém do Cazenga', data: '2026-09-02' });
  await falha(() => Compras.iniciarCompra({ estabelecimento: 'Outro sítio' }), 'Já tens uma compra');

  await Compras.registarArtigo({ compraId: compra.id, itemListaId: oleo.id, quantidade: 5, precoReal: 10000 });
  const d = await Compras.detalheCompra(compra.id);
  igual(d.itens.length, 1);
  igual(d.itens[0].diferenca, 500);
  igual(d.itens[0].precoUnitarioBase, 2000);
  igual(d.itens[0].variacao, null, 'primeira compra do produto: sem variação');
  igual(d.resumo.previsto, 9500);
  igual(d.resumo.real, 10000);
  igual(d.resumo.diferenca, 500);
  igual(d.gastoMes, 10000);
  igual(d.saldoMes, 240000);
  igual(d.pendentes.length, 0);

  const lista = await Lista.obterLista(mes.id);
  igual(lista.itens[0].comprado, true);
  igual(lista.resumo.estado, 'comprada');
  const historico = await transaccao(['historicoPrecos'], 'readonly', (t) => t.todos('historicoPrecos'));
  igual(historico.length, 1);
  igual(historico[0].precoUnitarioBase, 2000);
  igual(historico[0].estabelecimento, 'Armazém do Cazenga');

  // Registar outra vez o mesmo artigo corrige o registo, não cria outro.
  await Compras.registarArtigo({ compraId: compra.id, itemListaId: oleo.id, quantidade: 5, precoReal: 9800 });
  const d2 = await Compras.detalheCompra(compra.id);
  igual(d2.itens.length, 1);
  igual(d2.resumo.real, 9800);
  igual((await transaccao(['historicoPrecos'], 'readonly', (t) => t.todos('historicoPrecos'))).length, 1);
});

teste('serviços: alteração de quantidade durante a compra (§22)', async () => {
  const mes = await comecar(2026, 9, 2);
  const oleo = await Lista.adicionarProduto(mes.id, 'cat-oleo', 5);
  await Lista.definirPrecoPrevisto(oleo.id, 9500);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Mercado do 30' });
  const item = await Compras.registarArtigo({ compraId: compra.id, itemListaId: oleo.id, quantidade: 3, precoReal: 6000 });
  igual(item.quantidadePlaneada, 5);
  igual(item.quantidade, 3);
  igual(item.precoPrevisto, 5700, 'o previsto acompanha a quantidade comprada');
  igual(item.precoUnitarioReal, 2000);
  const d = await Compras.detalheCompra(compra.id);
  igual(d.resumo.diferenca, 300);
  igual(d.saldoMes, 244000);
});

teste('serviços: artigo fora da lista e artigo sem preço previsto', async () => {
  const mes = await comecar(2026, 9, 2);
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  await Lista.definirPrecoPrevisto(arroz.id, 30000);
  const feijao = await Lista.adicionarProduto(mes.id, 'cat-feijao', 5);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Cantina do bairro' });
  await Compras.registarArtigo({ compraId: compra.id, itemListaId: arroz.id, quantidade: 25, precoReal: 31000 });
  await Compras.registarArtigo({ compraId: compra.id, itemListaId: feijao.id, quantidade: 5, precoReal: 7500 });
  await Compras.registarArtigo({ compraId: compra.id, produtoId: 'cat-sal', quantidade: 1, precoReal: 400 });
  const { resumo } = await Compras.detalheCompra(compra.id);
  igual(resumo.real, 38900);
  igual(resumo.previsto, 30000);
  igual(resumo.diferenca, 1000, 'a diferença só compara artigos com preço previsto');
  igual(resumo.semPrevisao.artigos, 2);
  igual(resumo.semPrevisao.total, 7900);
  const { resumo: rl } = await Lista.obterLista(mes.id);
  igual(rl.artigos, 2, 'o artigo fora da lista não entra na lista');
});

teste('serviços: anular artigo e cancelar compra devolvem tudo ao estado anterior', async () => {
  const mes = await comecar(2026, 9, 2);
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  const acucar = await Lista.adicionarProduto(mes.id, 'cat-acucar', 10);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo' });
  const r1 = await Compras.registarArtigo({ compraId: compra.id, itemListaId: arroz.id, quantidade: 25, precoReal: 32000 });
  await Compras.registarArtigo({ compraId: compra.id, itemListaId: acucar.id, quantidade: 10, precoReal: 11000 });

  await Compras.anularArtigo(r1.id);
  igual((await itemDe(mes.id, 'cat-arroz')).comprado, false);
  igual((await Compras.detalheCompra(compra.id)).gastoMes, 11000);

  await Compras.cancelarCompra(compra.id);
  const painel = await Relatorio.painelMes(mes.id);
  igual(painel.orcamento.gasto, 0);
  igual(painel.compras.length, 0);
  igual((await itemDe(mes.id, 'cat-acucar')).comprado, false);
  igual((await transaccao(['historicoPrecos'], 'readonly', (t) => t.todos('historicoPrecos'))).length, 0);
});

teste('serviços: concluir compra guarda os totais (§23)', async () => {
  const mes = await comecar(2026, 9, 2);
  const compraVazia = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo' });
  await falha(() => Compras.concluirCompra(compraVazia.id), 'pelo menos um artigo');
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  await Lista.definirPrecoPrevisto(arroz.id, 32000);
  await Compras.registarArtigo({ compraId: compraVazia.id, itemListaId: arroz.id, quantidade: 25, precoReal: 31000 });
  const { compra, resumo } = await Compras.concluirCompra(compraVazia.id);
  igual(compra.estado, 'concluida');
  igual(compra.totalPrevisto, 32000);
  igual(compra.totalReal, 31000);
  igual(compra.diferenca, -1000);
  igual(resumo.artigos, 1);
  await falha(() => Compras.registarArtigo({ compraId: compra.id, produtoId: 'cat-sal', quantidade: 1, precoReal: 400 }), 'concluída');
  igual(await Compras.compraEmAndamento(), null);
});

teste('serviços: a data da compra fica entre o mês anterior e hoje (auditoria SEC-004)', async () => {
  const mes = await comecar(2026, 9, 18);
  const intervalo = Compras.intervaloDataCompra(mes, new Date(2026, 8, 18));
  igual(intervalo.min, '2026-08-01');
  igual(intervalo.max, '2026-09-18');
  await falha(() => Compras.iniciarCompra({ estabelecimento: 'Erro', data: '2062-09-02' }), 'data da compra');
  await falha(() => Compras.iniciarCompra({ estabelecimento: 'Erro', data: '2026-09-19' }), 'data da compra');
  await falha(() => Compras.iniciarCompra({ estabelecimento: 'Erro', data: '2026-07-31' }), 'data da compra');
  const c = await Compras.iniciarCompra({ estabelecimento: 'Mês anterior', data: '2026-08-01' });
  igual(c.data, '2026-08-01');
  await Compras.cancelarCompra(c.id);
  const hoje = await Compras.iniciarCompra({ estabelecimento: 'Hoje', data: '2026-09-18' });
  igual(hoje.data, '2026-09-18');
  // Janeiro: o mês anterior é Dezembro do ano anterior.
  igual(Compras.intervaloDataCompra({ ano: 2027, mes: 1 }, new Date(2027, 0, 3)).min, '2026-12-01');
});

teste('serviços: um artigo comprado não pode ser comprado outra vez noutra ida', async () => {
  const mes = await comecar(2026, 9, 2);
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  const c1 = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo' });
  await Compras.registarArtigo({ compraId: c1.id, itemListaId: arroz.id, quantidade: 25, precoReal: 32000 });
  await Compras.concluirCompra(c1.id);
  const c2 = await Compras.iniciarCompra({ estabelecimento: 'Mercado do 30' });
  await falha(() => Compras.registarArtigo({ compraId: c2.id, itemListaId: arroz.id, quantidade: 25, precoReal: 30000 }), 'já foi comprado');
  await falha(() => Lista.alterarQuantidade(arroz.id, 30), 'já foi comprado');
});

teste('serviços: o previsto nunca conta como gasto real (§44)', async () => {
  const mes = await comecar(2026, 9, 18);
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  await Lista.definirPrecoPrevisto(arroz.id, 92800);
  const p = await Relatorio.painelMes(mes.id);
  igual(p.orcamento.gasto, 0);
  igual(p.orcamento.saldo, 250000);
  igual(p.lista.pendentePrevisto, 92800);
});

// ---------- Painel da tela Mês ----------

teste('serviços: painel do mês com os números da tela de referência', () => {
  const mes = { id: '2026-09', ano: 2026, mes: 9, plafond: 250000, estado: 'aberto' };
  const compras = [
    { id: 'c1', mesId: mes.id, estabelecimento: 'Grossista Kikolo', data: '2026-09-02', estado: 'concluida', criadoEm: '1' },
    { id: 'c2', mesId: mes.id, estabelecimento: 'Cantina do bairro', data: '2026-09-09', estado: 'concluida', criadoEm: '2' },
    { id: 'c3', mesId: mes.id, estabelecimento: 'Mercado do 30', data: '2026-09-16', estado: 'concluida', criadoEm: '3' },
  ];
  const itensCompra = [
    { compraId: 'c1', precoReal: 128900 },
    { compraId: 'c2', precoReal: 21300 },
    { compraId: 'c3', precoReal: 32200 },
  ];
  const itensLista = [
    { quantidadePrevista: 25, precoUnitarioPrevisto: 1280, comprado: false },
    { quantidadePrevista: 5, precoUnitarioPrevisto: 1900, comprado: false },
    { quantidadePrevista: 10, precoUnitarioPrevisto: 1100, comprado: false },
    { quantidadePrevista: 5, precoUnitarioPrevisto: 1500, comprado: false },
    { quantidadePrevista: 10, precoUnitarioPrevisto: 800, comprado: false },
    { quantidadePrevista: 3, precoUnitarioPrevisto: 6800 / 3, comprado: false },
    { quantidadePrevista: 2.5, precoUnitarioPrevisto: 7200, comprado: false },
  ];
  const p = Relatorio.calcularPainel({ mes, itensLista, compras, itensCompra, hoje: new Date(2026, 8, 18, 10) });
  igual(p.rotulo, 'Setembro 2026');
  igual(p.estado, 'em_andamento');
  igual(p.orcamento.gasto, 182400);
  igual(p.orcamento.saldo, 67600);
  igual(formatarPercentagem(p.orcamento.percentagem, { casas: 0 }), '73%');
  igual(p.lista.pendentePrevisto, 92800);
  igual(p.lista.cobertura, -25200, 'faltam 25 200 Kz para cumprir a lista');
  igual(p.alertas[0].texto, 'Já usaste 73% do plafond e faltam 12 dias para o fim do mês.');
  igual(p.alertaLista.tipo, 'lista_acima_saldo');
  igual(p.ritmo.diasDecorridos, 18);
  aproximado(p.ritmo.mediaDiaria, 10133.33, 0.01);
  igual(p.ritmo.previsaoMensal, 304000);
  igual(p.ritmo.faceAoPlafond, 54000);
  igual(p.compras.map((c) => c.estabelecimento).join(','), 'Mercado do 30,Cantina do bairro,Grossista Kikolo');
  igual(p.compras[2].total, 128900);
  igual(p.mesTerminado, false);
});

teste('serviços: orçamento ultrapassado e mês terminado', () => {
  const mes = { id: '2026-09', ano: 2026, mes: 9, plafond: 100000, estado: 'aberto' };
  const compras = [{ id: 'c1', mesId: mes.id, estabelecimento: 'X', data: '2026-09-02', estado: 'concluida', criadoEm: '1' }];
  const p = Relatorio.calcularPainel({ mes, itensLista: [], compras, itensCompra: [{ compraId: 'c1', precoReal: 112000 }], hoje: new Date(2026, 9, 3) });
  igual(p.orcamento.saldo, -12000);
  igual(p.orcamento.ultrapassado, true);
  igual(p.orcamento.larguraBarra, 100);
  igual(p.mesTerminado, true);
  igual(p.alertas[0].tipo, 'mes_terminado');
  igual(p.alertas[1].texto, ui('Orçamento ultrapassado em 12 000 Kz.'));
});

// ---------- Fecho, relatório e novo mês ----------

teste('serviços: Setembro copia a lista de Agosto com os últimos preços pagos (§16)', async () => {
  const { setembro, agosto } = await cenarioAgostoSetembro();
  igual(setembro.id, '2026-09');
  igual(setembro.listaCopiadaDe, agosto.id);
  const { itens, resumo } = await Lista.obterLista(setembro.id);
  igual(itens.length, 4);
  igual(itens.every((i) => !i.comprado), true);
  igual(itens.find((i) => i.produtoId === 'cat-arroz').precoTotalPrevisto, 30000);
  igual(resumo.totalPrevisto, 58000);
  const agostoFechado = await Meses.obterMes(agosto.id);
  igual(agostoFechado.estado, 'fechado');
  igual((await Lista.obterLista(agosto.id)).itens.length, 4, 'a lista de Agosto fica intacta');
});

teste('serviços: comparação com a última compra durante a compra (§20)', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  const compra = await compraSetembro(setembro);
  const d = await Compras.detalheCompra(compra.id);
  const oleo = d.itens.find((i) => i.produtoId === 'cat-oleo');
  igual(oleo.anterior.precoUnitarioBase, 1700);
  igual(oleo.precoUnitarioBase, 1900);
  igual(formatarPercentagem(oleo.variacao, { sinal: true }), '+11,8%');
  igual(oleo.diferenca, 1000);
  igual(d.resumo.previsto, 58000);
  igual(d.resumo.real, 60000);
  igual(d.resumo.diferenca, 2000);
  igual(d.saldoMes, 190000);
});

teste('serviços: relatório de Setembro face a Agosto (§24 a §29)', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  const compra = await compraSetembro(setembro);
  await Compras.concluirCompra(compra.id);
  const r = await Relatorio.relatorioMes(setembro.id);
  igual(r.plafond, 250000);
  igual(r.gasto, 60000);
  igual(r.sobrou, 190000);
  igual(r.previsto, 58000);
  igual(r.diferencaPrevisto, 2000);
  igual(r.mesAnterior.nome, 'Agosto');
  igual(r.precos.map((p) => p.nome).join(','), 'Óleo alimentar,Arroz,Feijão,Açúcar');
  igual(r.precos.map((p) => formatarPercentagem(p.variacao, { sinal: true })).join(' '), ui('+11,8% +6,7% 0% -8,3%'));
  igual(r.maiorAumento.nome, 'Óleo alimentar');
  igual(r.maiorReducao.nome, 'Açúcar');
  igual(r.maiorDespesa.nome, 'Arroz');
  igual(r.maiorDespesa.total, 32000);
  igual(r.ondeGastou.length, 1);
  igual(r.ondeGastou[0].estabelecimento, 'Armazém do Cazenga');
  igual(r.ondeGastou[0].proporcao, 100);
  igual(r.cabaz.actual, 60000);
  igual(r.cabaz.anterior, 58000);
  igual(formatarPercentagem(r.cabaz.variacao), '3,4%');
  igual(r.congelado, false);
});

teste('serviços: fechar o mês congela o resumo e bloqueia alterações (§30, §44)', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  const compra = await compraSetembro(setembro);
  relogio(2026, 9, 30);
  await falha(() => Meses.fecharMes(setembro.id), 'compra por concluir');
  await Compras.concluirCompra(compra.id);
  await Meses.fecharMes(setembro.id);
  const r = await Relatorio.relatorioMes(setembro.id);
  igual(r.congelado, true);
  igual(r.sobrou, 190000);
  const arroz = await itemDe(setembro.id, 'cat-arroz');
  const d = await Compras.detalheCompra(compra.id);
  await falha(() => Lista.definirPrecoPrevisto(arroz.id, 1), 'fechado');
  await falha(() => Compras.corrigirArtigo(d.itens[0].id, { quantidade: 25, precoReal: 1 }), 'fechado');
  await falha(() => Meses.alterarPlafond(setembro.id, 300000), 'fechado');
  await falha(() => Compras.iniciarCompra({ estabelecimento: 'X' }), 'Não há nenhum mês aberto');
  await falha(() => Meses.fecharMes(setembro.id), 'fechado');
});

teste('serviços: novo mês sugere plafond pelo cabaz, como na tela Novo mês', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  const compra = await compraSetembro(setembro);
  await Compras.concluirCompra(compra.id);
  relogio(2026, 9, 30);
  await Meses.fecharMes(setembro.id);
  const n = await Meses.prepararNovoMes();
  igual(n.rotulo, 'Outubro 2026');
  igual(n.anterior.nome, 'Setembro');
  igual(n.anterior.sobrou, 190000);
  igual(formatarPercentagem(n.anterior.variacaoCabaz), '3,4%');
  igual(n.plafondSugerido, 258500);
  igual(n.itens.length, 4);
  igual(n.itens.find((i) => i.produtoId === 'cat-oleo').precoTotalPrevisto, 9500, 'último preço pago');

  const arroz = n.itens.find((i) => i.produtoId === 'cat-arroz');
  const outubro = await Meses.criarMes({ plafond: 258500, copiarDe: setembro.id, itensSeleccionados: [arroz.itemId] });
  igual(outubro.id, '2026-10');
  const { itens } = await Lista.obterLista(outubro.id);
  igual(itens.length, 1, 'só copia os artigos seleccionados');
  igual(itens[0].precoTotalPrevisto, 32000);
  await falha(() => Meses.criarMes({ plafond: 1000 }), 'Já existe um mês aberto');
});

teste('serviços: correcção de um preço mal escrito mantém o histórico coerente', async () => {
  const mes = await comecar(2026, 9, 2);
  const arroz = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Grossista Kikolo' });
  const item = await Compras.registarArtigo({ compraId: compra.id, itemListaId: arroz.id, quantidade: 25, precoReal: 320000 });
  await Compras.concluirCompra(compra.id);
  await Compras.corrigirArtigo(item.id, { quantidade: 25, precoReal: 32000 });
  const d = await Compras.detalheCompra(compra.id);
  igual(d.compra.totalReal, 32000);
  igual(d.gastoMes, 32000);
  const h = await transaccao(['historicoPrecos'], 'readonly', (t) => t.todos('historicoPrecos'));
  igual(h.length, 1);
  igual(h[0].precoUnitarioBase, 1280);
  verdade(h[0].corrigidoEm !== null, 'o registo fica marcado como corrigido');
});

teste('serviços: preços em g e kg comparam-se; kg e pacote não (§44)', async () => {
  const mes = await comecar(2026, 9, 5);
  const c1 = await Compras.iniciarCompra({ estabelecimento: 'A', data: '2026-09-02' });
  await Compras.registarArtigo({ compraId: c1.id, produtoId: 'cat-sal', quantidade: 1, precoReal: 400 });
  await Compras.concluirCompra(c1.id);
  const p = await Produtos.criarProduto({ nome: 'Sal fino', categoria: 'mercearia', unidade: 'g', quantidadeSugerida: 500 });
  const c2 = await Compras.iniciarCompra({ estabelecimento: 'B', data: '2026-09-03' });
  await Compras.registarArtigo({ compraId: c2.id, produtoId: p.id, quantidade: 500, precoReal: 250 });
  const d = await Compras.detalheCompra(c2.id);
  igual(d.itens[0].unidadeBase, 'kg');
  igual(d.itens[0].precoUnitarioBase, 500);
  await Compras.concluirCompra(c2.id);

  // O mesmo produto comprado em pacote não se compara com o preço ao kg.
  const c3 = await Compras.iniciarCompra({ estabelecimento: 'C', data: '2026-09-04' });
  const arrozKg = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  await Compras.registarArtigo({ compraId: c3.id, itemListaId: arrozKg.id, quantidade: 25, precoReal: 32000 });
  await Compras.concluirCompra(c3.id);
  await transaccao(['produtos'], 'readwrite', async (t) => {
    const arroz = await t.obter('produtos', 'cat-arroz');
    arroz.unidade = 'saco';
    await t.guardar('produtos', arroz);
  });
  const c4 = await Compras.iniciarCompra({ estabelecimento: 'D', data: '2026-09-05' });
  await Compras.registarArtigo({ compraId: c4.id, produtoId: 'cat-arroz', quantidade: 1, precoReal: 33000 });
  const d4 = await Compras.detalheCompra(c4.id);
  igual(d4.itens[0].unidadeBase, 'saco');
  igual(d4.itens[0].anterior, null, 'kg e saco não se comparam');
  igual(d4.itens[0].variacao, null);
});

teste('serviços: cartão de produto com último preço, médio e variação (§11)', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  const compra = await compraSetembro(setembro);
  await Compras.concluirCompra(compra.id);
  const { preco } = await Produtos.detalheProduto('cat-arroz');
  igual(preco.ultimo.precoTotal, 32000);
  igual(preco.ultimo.precoUnitarioBase, 1280);
  igual(preco.anterior.precoUnitarioBase, 1200);
  igual(formatarPercentagem(preco.variacao, { sinal: true }), '+6,7%');
  igual(preco.medio, 1240);
  const semHistorico = await Produtos.detalheProduto('cat-gas');
  igual(semHistorico.preco, null);
});

teste('serviços: estabelecimentos recentes sem repetições', async () => {
  await comecar(2026, 9, 2);
  for (const nome of ['Grossista Kikolo', 'Mercado do 30', 'grossista kikolo']) {
    const c = await Compras.iniciarCompra({ estabelecimento: nome });
    await Compras.registarArtigo({ compraId: c.id, produtoId: 'cat-sal', quantidade: 1, precoReal: 400 });
    await Compras.concluirCompra(c.id);
  }
  const nomes = await Compras.estabelecimentosRecentes();
  igual(nomes.length, 2);
});

teste('serviços: editar quantidade e preço previsto de uma vez', async () => {
  const mes = await comecar(2026, 9, 1);
  const item = await Lista.adicionarProduto(mes.id, 'cat-arroz', 25);
  await Lista.actualizarItem(item.id, { quantidade: 20, precoTotalPrevisto: 25600 });
  const actual = await itemDe(mes.id, 'cat-arroz');
  igual(actual.quantidadePrevista, 20);
  igual(actual.precoTotalPrevisto, 25600);
  igual(actual.precoUnitarioBasePrevisto, 1280);
  await Lista.actualizarItem(item.id, { quantidade: 20, precoTotalPrevisto: null });
  igual((await itemDe(mes.id, 'cat-arroz')).precoTotalPrevisto, null);
  await falha(() => Lista.actualizarItem(item.id, { quantidade: -1, precoTotalPrevisto: 100 }), 'quantidade');
});

teste('serviços: contas do artigo enquanto se escreve o preço (§19, §20, §22)', () => {
  const r = Compras.simularArtigo({ quantidade: 5, unidade: 'L', precoUnitarioPrevisto: 1900, precoReal: 10000, anterior: { precoUnitarioBase: 1900 } });
  igual(r.previsto, 9500);
  igual(r.diferenca, 500);
  igual(r.precoUnitarioBase, 2000);
  igual(r.unidadeBase, 'L');
  igual(formatarPercentagem(r.variacao, { sinal: true }), '+5,3%');
  const menos = Compras.simularArtigo({ quantidade: 3, unidade: 'L', precoUnitarioPrevisto: 1900, precoReal: 6000 });
  igual(menos.previsto, 5700);
  igual(menos.diferenca, 300);
  igual(menos.variacao, null, 'sem compra anterior não há variação');
  const vazio = Compras.simularArtigo({ quantidade: 5, unidade: 'L', precoUnitarioPrevisto: null, precoReal: null });
  igual(vazio.previsto, null);
  igual(vazio.diferenca, null);
  igual(vazio.precoUnitarioBase, null);
  const gramas = Compras.simularArtigo({ quantidade: 500, unidade: 'g', precoReal: 650 });
  igual(gramas.unidadeBase, 'kg');
  igual(gramas.precoUnitarioBase, 1300);
});

teste('serviços: artigos por comprar trazem o último preço pago; artigo fora da lista também', async () => {
  const { setembro } = await cenarioAgostoSetembro();
  relogio(2026, 9, 2);
  const compra = await Compras.iniciarCompra({ estabelecimento: 'Armazém do Cazenga', data: '2026-09-02' });
  const d = await Compras.detalheCompra(compra.id);
  const oleo = d.pendentes.find((i) => i.produtoId === 'cat-oleo');
  igual(oleo.anterior.precoUnitarioBase, 1700);
  igual(oleo.anterior.estabelecimento, 'Grossista Kikolo');
  const sal = await Compras.produtoParaCompra(compra.id, 'cat-sal');
  igual(sal.anterior, null);
  igual(sal.unidade, 'kg');
  const arroz = await Compras.produtoParaCompra(compra.id, 'cat-arroz');
  igual(arroz.anterior.precoUnitarioBase, 1200);
  igual((await Meses.mesParaRelatorio()).id, setembro.id);
});

teste('serviços: depois do fecho, o Relatório mostra o último mês fechado', async () => {
  const mes = await comecar(2026, 9, 30);
  await Meses.fecharMes(mes.id);
  const m = await Meses.mesParaRelatorio();
  igual(m.id, mes.id);
  igual(m.estado, 'fechado');
});

teste('serviços: repõe o relógio real no fim', () => {
  definirRelogio(null);
  verdade(Math.abs(Date.now() - new Date().getTime()) < 1000);
});
