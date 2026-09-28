// Endereço oficial da KUSSUMBA (auditoria SEC-001: a aplicação passou a ter uma origem só dela).
// No endereço antigo, a aplicação ajuda a levar os dados para o novo e não aceita utilizadores novos.

export const ENDERECO_OFICIAL = 'https://kussumba.github.io/';
export const NOME_DO_ENDERECO = 'kussumba.github.io';

const ENDERECOS_ANTIGOS = ['ladislaulucala-sys.github.io'];

export function estaNoEnderecoAntigo(maquina = location.hostname) {
  return ENDERECOS_ANTIGOS.includes(maquina);
}
