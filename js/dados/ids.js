// Identificadores únicos universais. Permitem, no futuro, sincronizar vários telefones
// sem colisões de identificadores.

export function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // randomUUID só existe em páginas seguras (https ou localhost). getRandomValues existe sempre.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
