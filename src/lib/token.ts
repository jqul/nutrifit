// Token del enlace personal del cliente (?c=<token>). Funciona como credencial
// inicial: quien lo conoce puede ver el nombre del cliente y reclamar la ficha
// si aún no se ha registrado. Por eso se genera con el CSPRNG del navegador
// (nunca Math.random, que es predecible): 16 bytes = 128 bits, en hexadecimal.
export function generateClientToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
