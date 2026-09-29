// Datas e meses. As datas guardam-se como texto "AAAA-MM-DD" na hora local,
// para que uma compra feita às 23h30 em Luanda não mude de dia.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

let fonteDoTempo = () => new Date();

/** Data e hora actuais. Os testes podem substituir o relógio com definirRelogio. */
export function agora() {
  return fonteDoTempo();
}

export function definirRelogio(funcao) {
  fonteDoTempo = funcao ?? (() => new Date());
}

export function carimbo() {
  return agora().toISOString();
}

export function dataISO(data = agora()) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function dataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto))) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const data = new Date(a, m - 1, d);
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d;
}

export function idMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function partesIdMes(id) {
  const [ano, mes] = id.split('-').map(Number);
  return { ano, mes };
}

export function nomeMes(mes) {
  return MESES[mes - 1];
}

export function rotuloMes(ano, mes) {
  return `${nomeMes(mes)} ${ano}`;
}

export function diasNoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function indiceMes(ano, mes) {
  return ano * 12 + (mes - 1);
}

/** Negativo se a vier antes de b, zero se for o mesmo mês. */
export function compararMeses(a, b) {
  return indiceMes(a.ano, a.mes) - indiceMes(b.ano, b.mes);
}

export function mesSeguinte({ ano, mes }) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

export function mesAnterior({ ano, mes }) {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}

export function mesDaData(data = agora()) {
  return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
}

/**
 * Dias decorridos do mês, contando o dia de hoje.
 * Mês futuro: 0. Mês já terminado: todos os dias do mês.
 */
export function diasDecorridos(ano, mes, hoje = agora()) {
  const comparacao = compararMeses(mesDaData(hoje), { ano, mes });
  if (comparacao < 0) return 0;
  if (comparacao > 0) return diasNoMes(ano, mes);
  return hoje.getDate();
}

export function diasRestantes(ano, mes, hoje = agora()) {
  return diasNoMes(ano, mes) - diasDecorridos(ano, mes, hoje);
}

/** "2026-09-02" → "02 Set". */
export function formatarDataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d} ${MESES_CURTOS[Number(m) - 1]}`;
}

/** "2026-09-02" → "2 de Setembro de 2026". */
export function formatarDataLonga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
