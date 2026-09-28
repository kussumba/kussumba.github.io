// Catálogo inicial (prompt mestre, §10). Nenhum produto traz preço: os preços vêm sempre
// do que o utilizador indica ou paga, nunca de valores inventados.

export const CATEGORIAS = [
  { id: 'mercearia', nome: 'Mercearia' },
  { id: 'frescos', nome: 'Frescos' },
  { id: 'limpeza', nome: 'Limpeza' },
  { id: 'higiene', nome: 'Higiene' },
  { id: 'bebidas', nome: 'Bebidas' },
  { id: 'outros', nome: 'Outros' },
];

// genero: artigo usado nas mensagens ("o preço do óleo", "o preço da fuba").
// basico: entra em "Começar com produtos sugeridos" (§46).
function produto(id, nome, categoria, unidade, quantidadeSugerida, icone, genero, basico = false) {
  return { id: 'cat-' + id, nome, categoria, unidade, quantidadeSugerida, icone, genero, basico };
}

export const PRODUTOS_INICIAIS = [
  produto('arroz', 'Arroz', 'mercearia', 'kg', 25, 'saco', 'o', true),
  produto('oleo', 'Óleo alimentar', 'mercearia', 'L', 5, 'garrafa', 'o', true),
  produto('acucar', 'Açúcar', 'mercearia', 'kg', 10, 'saco', 'o', true),
  produto('feijao', 'Feijão', 'mercearia', 'kg', 5, 'saco', 'o', true),
  produto('fuba', 'Fuba de milho', 'mercearia', 'kg', 10, 'saco', 'a', true),
  produto('leite-po', 'Leite em pó', 'mercearia', 'lata', 2, 'lata', 'o', true),
  produto('massa', 'Massa', 'mercearia', 'pacote', 4, 'caixa', 'a', true),
  produto('sal', 'Sal', 'mercearia', 'kg', 1, 'saco', 'o'),
  produto('farinha-trigo', 'Farinha de trigo', 'mercearia', 'kg', 2, 'saco', 'a'),
  produto('ovos', 'Ovos', 'frescos', 'cartao', 1, 'ovos', 'os', true),
  produto('frango', 'Frango', 'frescos', 'kg', 5, 'frango', 'o'),
  produto('carne', 'Carne', 'frescos', 'kg', 2, 'carne', 'a'),
  produto('peixe', 'Peixe', 'frescos', 'kg', 3, 'peixe', 'o'),
  produto('tomate', 'Tomate', 'frescos', 'kg', 2, 'legume', 'o'),
  produto('cebola', 'Cebola', 'frescos', 'kg', 2, 'legume', 'a'),
  produto('batata', 'Batata', 'frescos', 'kg', 3, 'legume', 'a'),
  produto('sabao-po', 'Sabão em pó', 'limpeza', 'kg', 3, 'saco', 'o', true),
  produto('detergente', 'Detergente', 'limpeza', 'L', 1, 'garrafa', 'o'),
  produto('lixivia', 'Lixívia', 'limpeza', 'L', 1, 'garrafa', 'a'),
  produto('papel-higienico', 'Papel higiénico', 'higiene', 'pacote', 1, 'rolo', 'o', true),
  produto('sabonete', 'Sabonete', 'higiene', 'unidade', 4, 'sabonete', 'o'),
  produto('pasta-dentes', 'Pasta de dentes', 'higiene', 'unidade', 2, 'tubo', 'a'),
  produto('agua', 'Água', 'bebidas', 'garrafa', 6, 'garrafa', 'a'),
  produto('sumo', 'Sumo', 'bebidas', 'L', 2, 'garrafa', 'o'),
  produto('refrigerante', 'Refrigerante', 'bebidas', 'lata', 6, 'lata', 'o'),
  produto('gas', 'Gás de cozinha', 'outros', 'unidade', 1, 'botija', 'o'),
];

/** Nome sem acentos e em minúsculas, para a pesquisa encontrar "acucar" ao escrever "açúcar". */
export function normalizarNome(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
