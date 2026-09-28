// Carrega todos os ficheiros de testes e corre-os pela ordem.
import { correr } from './mini-teste.js';
import './nucleo.teste.js';
import './dados.teste.js';
import './servicos.teste.js';
import './copia.teste.js';

const resumo = await correr(document.getElementById('resultados'));
document.getElementById('resumo').textContent =
  `${resumo.passou} de ${resumo.total} testes passaram` + (resumo.falhou ? ` · ${resumo.falhou} falharam` : '');
