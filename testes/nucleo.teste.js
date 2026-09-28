// Testes da camada de cálculos e formatos, com os exemplos do prompt mestre.

import { teste, igual, aproximado, igualProfundo, ui } from './mini-teste.js';
import * as F from '../js/nucleo/formatos.js';
import * as C from '../js/nucleo/calculos.js';
import * as U from '../js/nucleo/unidades.js';
import * as D from '../js/nucleo/datas.js';
import * as A from '../js/nucleo/alertas.js';

// ---------- Formatos (§34) ----------

teste('formatos: valores em Kz sem casas decimais', () => {
  igual(F.formatarKz(250000), ui('250 000 Kz'));
  igual(F.formatarKz(67600), ui('67 600 Kz'));
  igual(F.formatarKz(1280), ui('1 280 Kz'));
  igual(F.formatarKz(500), ui('500 Kz'));
  igual(F.formatarKz(0), ui('0 Kz'));
  igual(F.formatarKz(1234567), ui('1 234 567 Kz'));
  igual(F.formatarKz(-25200), ui('-25 200 Kz'));
  igual(F.formatarKz(NaN), '');
  igual(F.formatarKz(null), '');
});

teste('formatos: Kz com sinal', () => {
  igual(F.formatarKzComSinal(500), ui('+500 Kz'));
  igual(F.formatarKzComSinal(-500), ui('-500 Kz'));
  igual(F.formatarKzComSinal(8700), ui('+8 700 Kz'));
  igual(F.formatarKzComSinal(0), ui('0 Kz'));
});

teste('formatos: números com vírgula decimal', () => {
  igual(F.formatarNumero(2.5, 3), '2,5');
  igual(F.formatarNumero(25, 3), '25');
  igual(F.formatarNumero(0.125, 3), '0,125');
  igual(F.formatarNumero(2266.6667), ui('2 267'));
});

teste('formatos: percentagens', () => {
  igual(F.formatarPercentagem(6.6667, { sinal: true }), '+6,7%');
  igual(F.formatarPercentagem(-8.3333, { sinal: true }), ui('-8,3%'));
  igual(F.formatarPercentagem(0, { sinal: true }), '0%');
  igual(F.formatarPercentagem(11.7647), '11,8%');
  igual(F.formatarPercentagem(72.96, { casas: 0 }), '73%');
  igual(F.formatarPercentagem(5, { sinal: true }), '+5%');
  igual(F.formatarPercentagem(0.04, { sinal: true }), '0%');
});

teste('formatos: leitura do que o utilizador escreve', () => {
  igual(F.lerKz('250 000'), 250000);
  igual(F.lerKz(ui('250 000 Kz')), 250000);
  igual(F.lerKz(''), null);
  igual(F.lerKz('abc'), null);
  igual(F.lerDecimal('2,5'), 2.5);
  igual(F.lerDecimal('2.5'), 2.5);
  igual(F.lerDecimal('10'), 10);
  igual(F.lerDecimal('2,5,1'), null);
  igual(F.lerDecimal(''), null);
  igual(F.lerDecimal('-3'), null);
  igual(F.formatarDigitacaoKz('0250000'), ui('250 000'));
  igual(F.formatarDigitacaoKz('12a3'), '123');
});

// ---------- Unidades (§12, §14) ----------

teste('unidades: conversão para a base e comparabilidade', () => {
  igual(U.paraBase(500, 'g'), 0.5);
  igual(U.paraBase(250, 'ml'), 0.25);
  igual(U.paraBase(25, 'kg'), 25);
  igual(U.unidadeBase('g'), 'kg');
  igual(U.unidadeBase('ml'), 'L');
  igual(U.unidadeBase('pacote'), 'pacote');
  igual(U.saoComparaveis(U.unidadeBase('g'), U.unidadeBase('kg')), true);
  igual(U.saoComparaveis(U.unidadeBase('kg'), U.unidadeBase('pacote')), false);
  igual(U.saoComparaveis(U.unidadeBase('outro', 'molho'), U.unidadeBase('outro', 'kit')), false);
  igual(U.saoComparaveis(U.unidadeBase('outro', 'Molho'), U.unidadeBase('outro', 'molho ')), true);
});

teste('unidades: quantidades e preço por unidade', () => {
  igual(U.formatarQuantidade(25, 'kg'), ui('25 kg'));
  igual(U.formatarQuantidade(2.5, 'kg'), ui('2,5 kg'));
  igual(U.formatarQuantidade(1, 'lata'), ui('1 lata'));
  igual(U.formatarQuantidade(3, 'pacote'), ui('3 pacotes'));
  igual(U.formatarQuantidade(2, 'cartao'), ui('2 cartões'));
  igual(U.formatarQuantidade(3, 'outro', 'molhos'), ui('3 molhos'));
  igual(U.formatarPrecoUnitario(1280, 'kg'), ui('1 280 Kz/kg'));
  igual(U.formatarPrecoUnitario(2000, 'L'), ui('2 000 Kz/L'));
  igual(U.formatarPrecoUnitario(150, 'unidade'), ui('150 Kz/un.'));
  igual(U.formatarPrecoUnitario(6800 / 3, 'kg'), ui('2 267 Kz/kg'));
});

teste('unidades: botões − e + nunca levam a quantidade a zero', () => {
  igual(U.passoQuantidade(25, 'kg', 1), 26);
  igual(U.passoQuantidade(25, 'kg', -1), 24);
  igual(U.passoQuantidade(1, 'kg', -1), 1);
  igual(U.passoQuantidade(2.5, 'kg', -1), 1.5);
  igual(U.passoQuantidade(0.5, 'kg', -1), 0.5);
  igual(U.passoQuantidade(500, 'g', 1), 600);
  igual(U.passoQuantidade(100, 'g', -1), 100);
});

// ---------- Cálculos (§43) com os exemplos do documento ----------

teste('cálculos: saldo e percentagem utilizada (§5)', () => {
  igual(C.saldo(250000, 182400), 67600);
  aproximado(C.percentagemUtilizada(182400, 250000), 72.96);
  igual(F.formatarPercentagem(C.percentagemUtilizada(182400, 250000), { casas: 0 }), '73%');
  igual(C.saldo(250000, 260000), -10000);
  igual(C.percentagemUtilizada(1000, 0), null, 'plafond zero não divide');
  igual(C.saldo(null, 100), null);
});

teste('cálculos: previsão das compras restantes (§6)', () => {
  igual(C.coberturaDaLista(67600, 92800), -25200);
  igual(C.coberturaDaLista(67600, 50000), 17600);
});

teste('cálculos: ritmo de gastos (§7)', () => {
  aproximado(C.mediaDiaria(182400, 18), 10133.333, 0.001);
  igual(C.previsaoMensal(C.mediaDiaria(182400, 18), 30), 304000);
  igual(C.mediaDiaria(182400, 0), null, 'sem dias decorridos não há média');
  igual(C.previsaoMensal(null, 30), null);
});

teste('cálculos: preço unitário (§14)', () => {
  igual(C.precoUnitario(32000, 25), 1280);
  igual(C.precoUnitario(10000, 5), 2000);
  igual(C.precoUnitario(18000, 2.5), 7200);
  igual(C.precoUnitario(100, 0), null, 'quantidade zero não divide');
  igual(C.precoUnitario(null, 5), null);
});

teste('cálculos: total previsto da lista de Setembro (§9)', () => {
  const lista = [
    { quantidade: 25, precoUnitario: 1280 },     // Arroz 32 000
    { quantidade: 5, precoUnitario: 1900 },      // Óleo 9 500
    { quantidade: 10, precoUnitario: 1100 },     // Açúcar 11 000
    { quantidade: 5, precoUnitario: 1500 },      // Feijão 7 500
    { quantidade: 10, precoUnitario: 800 },      // Fuba 8 000
    { quantidade: 3, precoUnitario: 6800 / 3 },  // Sabão 6 800
    { quantidade: 2.5, precoUnitario: 7200 },    // Leite 18 000
  ];
  igualProfundo(C.totalPrevisto(lista), { total: 92800, semPreco: 0 });
  igualProfundo(C.totalPrevisto([...lista, { quantidade: 1, precoUnitario: null }]), { total: 92800, semPreco: 1 });
  igualProfundo(C.totalPrevisto([]), { total: 0, semPreco: 0 });
});

teste('cálculos: preço pago e diferença (§19, §21)', () => {
  igual(C.diferenca(10000, 9500), 500);
  igual(C.diferenca(93300, 92800), 500);
  igual(C.diferenca(238700, 230000), 8700);
  igual(C.diferenca(100, null), null);
  igual(C.totalReal([{ precoReal: 32000 }, { precoReal: 10000 }, { precoReal: null }]), 42000);
});

teste('cálculos: variação de preço (§15, §20, §26)', () => {
  aproximado(C.variacaoPercentual(1280, 1200), 6.6667, 0.0001);
  igual(F.formatarPercentagem(C.variacaoPercentual(1280, 1200), { sinal: true }), '+6,7%');
  igual(F.formatarPercentagem(C.variacaoPercentual(2000, 1900), { sinal: true }), '+5,3%');
  igual(F.formatarPercentagem(C.variacaoPercentual(1900, 1700), { sinal: true }), '+11,8%');
  igual(F.formatarPercentagem(C.variacaoPercentual(1500, 1500), { sinal: true }), '0%');
  igual(F.formatarPercentagem(C.variacaoPercentual(1100, 1200), { sinal: true }), ui('-8,3%'));
  igual(C.variacaoPercentual(1280, null), null, 'sem preço anterior não há variação');
  igual(C.variacaoPercentual(1280, 0), null, 'preço anterior zero não divide');
});

teste('cálculos: redução de quantidade durante a compra (§22)', () => {
  // Planeado 5 L a 1 900 Kz/L; comprado 3 L por 6 000 Kz.
  const previstoAjustado = C.precoTotal(3, 1900);
  igual(previstoAjustado, 5700);
  igual(C.precoUnitario(6000, 3), 2000);
  igual(C.diferenca(6000, previstoAjustado), 300);
});

teste('cálculos: preço médio ponderado', () => {
  const registos = [
    { precoTotal: 32000, quantidadeBase: 25 },
    { precoTotal: 6000, quantidadeBase: 5 },
  ];
  aproximado(C.precoMedioPonderado(registos), 38000 / 30);
  igual(C.precoMedioPonderado([]), null);
  igual(C.precoMedioPonderado([{ precoTotal: 100, quantidadeBase: 0 }]), null);
});

teste('cálculos: cabaz habitual e sugestão de plafond (§29, tela Novo mês)', () => {
  const r = C.cabaz([
    { quantidade: 25, precoActual: 1280, precoAnterior: 1200 },
    { quantidade: 5, precoActual: 1900, precoAnterior: 1700 },
    { quantidade: 10, precoActual: 1100, precoAnterior: 1200 },
  ]);
  igual(r.actual, 32000 + 9500 + 11000);
  igual(r.anterior, 30000 + 8500 + 12000);
  aproximado(r.variacao, ((52500 - 50500) / 50500) * 100);
  igual(C.cabaz([]), null);
  igual(F.formatarPercentagem(C.variacaoPercentual(198400, 187600), { sinal: true }), '+5,8%');
  igual(C.sugestaoPlafond(250000, 3.4), 258500);
  igual(C.sugestaoPlafond(250000, null), null);
});

teste('cálculos: fecho do mês (§24)', () => {
  igual(C.saldo(250000, 238700), 11300);
});

// ---------- Datas ----------

teste('datas: meses, dias decorridos e restantes', () => {
  const hoje = new Date(2026, 8, 18, 10, 0);
  igual(D.rotuloMes(2026, 9), 'Setembro 2026');
  igual(D.diasNoMes(2026, 9), 30);
  igual(D.diasNoMes(2028, 2), 29);
  igual(D.diasDecorridos(2026, 9, hoje), 18);
  igual(D.diasRestantes(2026, 9, hoje), 12);
  igual(D.diasDecorridos(2026, 10, hoje), 0, 'mês futuro');
  igual(D.diasDecorridos(2026, 8, hoje), 31, 'mês passado');
  igualProfundo(D.mesSeguinte({ ano: 2026, mes: 12 }), { ano: 2027, mes: 1 });
  igualProfundo(D.mesAnterior({ ano: 2027, mes: 1 }), { ano: 2026, mes: 12 });
  igual(D.idMes(2026, 9), '2026-09');
  igual(D.formatarDataCurta('2026-09-02'), '02 Set');
  igual(D.formatarDataLonga('2026-09-02'), '2 de Setembro de 2026');
  igual(D.dataISO(new Date(2026, 8, 2, 23, 30)), '2026-09-02');
  igual(D.dataValida('2026-02-30'), false);
  igual(D.dataValida('2026-09-02'), true);
});

// ---------- Alertas (§37) ----------

teste('alertas: orçamento perto do limite, como na tela de referência', () => {
  const a = A.alertasOrcamento({
    plafond: 250000, gasto: 182400, percentagem: 72.96, diasRestantes: 12,
    previsaoMensal: 304000, diasDecorridos: 18, mesTerminado: false, nomeDoMes: 'Setembro',
  });
  igual(a[0].tipo, 'proximo_limite');
  igual(a[0].texto, 'Já usaste 73% do plafond e faltam 12 dias para o fim do mês.');
  igual(a[1].tipo, 'previsao_acima');
  igual(a[1].texto, ui('Ao ritmo actual, o mês pode fechar 54 000 Kz acima do plafond.'));
});

teste('alertas: orçamento ultrapassado', () => {
  const a = A.alertasOrcamento({
    plafond: 250000, gasto: 262000, percentagem: 104.8, diasRestantes: 3,
    previsaoMensal: 280000, diasDecorridos: 27, mesTerminado: false, nomeDoMes: 'Setembro',
  });
  igual(a.length, 1);
  igual(a[0].texto, ui('Orçamento ultrapassado em 12 000 Kz.'));
});

teste('alertas: sem avisos quando está tudo dentro do orçamento', () => {
  const a = A.alertasOrcamento({
    plafond: 250000, gasto: 50000, percentagem: 20, diasRestantes: 20,
    previsaoMensal: 150000, diasDecorridos: 10, mesTerminado: false, nomeDoMes: 'Setembro',
  });
  igual(a.length, 0);
});

teste('alertas: previsão pelo ritmo só depois de alguns dias', () => {
  const a = A.alertasOrcamento({
    plafond: 250000, gasto: 128900, percentagem: 51.56, diasRestantes: 28,
    previsaoMensal: 1933500, diasDecorridos: 2, mesTerminado: false, nomeDoMes: 'Setembro',
  });
  igual(a.length, 0);
});

teste('alertas: lista acima do saldo', () => {
  igual(A.alertaLista({ pendente: 92800, saldo: 67600, artigosPendentes: 7 }).texto, 'Ei, comadre! A tua lista está acima do saldo disponível.');
  igual(A.alertaLista({ pendente: 50000, saldo: 67600, artigosPendentes: 3 }), null);
  igual(A.alertaLista({ pendente: 0, saldo: 67600, artigosPendentes: 0 }), null);
});

teste('alertas: valores que parecem engano de digitação (auditoria SEC-007)', () => {
  igual(A.pareceEngano(1280, 1200), false);
  igual(A.pareceEngano(12800000, 1280), true, 'três zeros a mais');
  igual(A.pareceEngano(128, 1280), true, 'um zero a menos: um décimo do preço');
  igual(A.pareceEngano(200, 1280), true);
  igual(A.pareceEngano(300, 1280), false);
  igual(A.pareceEngano(100, null), false, 'sem referência não há comparação');
  igual(A.pareceEngano(0, 100), false);
  igual(A.motivoPrecoEstranho({ precoReal: 300000, plafond: 250000 }), 'é maior do que o plafond do mês inteiro');
  igual(A.motivoPrecoEstranho({ precoReal: 320000, plafond: 500000, precoUnitarioBase: 12800, anteriorUnitarioBase: 1200 }), 'está muito longe do preço da última compra');
  igual(A.motivoPrecoEstranho({ precoReal: 95000, plafond: 500000, previsto: 9500 }), 'está muito longe do previsto');
  igual(A.motivoPrecoEstranho({ precoReal: 10000, plafond: 250000, precoUnitarioBase: 2000, anteriorUnitarioBase: 1900, previsto: 9500 }), null);
  igual(A.motivoPrecoEstranho({ precoReal: null, plafond: 250000 }), null);
});

teste('alertas: preços e fim de compra', () => {
  igual(
    A.alertaPreco({ nomeProduto: 'Óleo alimentar', genero: 'o', variacao: 11.76 }).texto,
    'Atenção, comadre: o preço do óleo alimentar subiu 11,8% desde a última compra.',
  );
  igual(A.alertaPreco({ nomeProduto: 'Fuba de milho', genero: 'a', variacao: 5 }), null, 'subida pequena não alerta');
  igual(A.alertaPreco({ nomeProduto: 'Açúcar', genero: 'o', variacao: -8.33 }).nivel, 'positivo');
  igual(A.alertaPreco({ nomeProduto: 'Coca-Cola', variacao: 12 }).texto.includes('de Coca-Cola'), true);
  igual(A.alertaPreco({ nomeProduto: 'Arroz', variacao: null }), null);
  igual(A.alertaFimCompra({ diferenca: -1200 }).texto, 'Boa, comadre! Gastaste menos do que o previsto nesta compra.');
  igual(A.alertaFimCompra({ diferenca: null }), null);
});
