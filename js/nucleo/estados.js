// Estados da aplicação (prompt mestre, §47), calculados sempre da mesma maneira.

/** Mês: "aberto" (sem compras), "em_andamento" (com compras) ou "fechado". */
export function estadoDoMes(mes, numeroCompras) {
  if (mes.estado === 'fechado') return 'fechado';
  return numeroCompras > 0 ? 'em_andamento' : 'aberto';
}

/** Lista: "vazia", "criada" (nada comprado), "parcial" ou "comprada". */
export function estadoDaLista({ artigos, comprados }) {
  if (!artigos) return 'vazia';
  if (!comprados) return 'criada';
  return comprados < artigos ? 'parcial' : 'comprada';
}

export const ROTULOS = {
  mes: { aberto: 'Mês aberto', em_andamento: 'Mês em andamento', fechado: 'Mês fechado' },
  lista: { vazia: 'Vazia', criada: 'Por comprar', parcial: 'Parcialmente comprada', comprada: 'Toda comprada' },
  compra: { em_andamento: 'Compra em andamento', concluida: 'Compra concluída' },
};
