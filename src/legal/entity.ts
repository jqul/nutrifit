// Los datos de quien presta el servicio y las decisiones pendientes que aparecen en los textos legales
// (src/legal/*.md), en un solo sitio. Mientras algo siga entre corchetes MAYÚSCULAS, el texto se muestra
// como BORRADOR y los enlaces públicos a los textos legales permanecen ocultos.
//
// PARA PUBLICARLOS:
//  1. Rellena los datos del titular y las decisiones pendientes de abajo.
//  2. Que un abogado o gestoría con experiencia en protección de datos revise los seis textos.
//  3. Pon LEGAL_REVIEWED = true: se activan los enlaces (pie de la web, registro, app del cliente) y la
//     casilla de aceptación en el registro.

/** true cuando los textos están revisados por un profesional y completos. */
export const LEGAL_REVIEWED = false

/** Fecha de esta versión de los textos; se guarda junto a la aceptación al registrarse. */
export const LEGAL_VERSION = '2026-10-07'
const LEGAL_DATE_TEXT = '7 de octubre de 2026'

export const LEGAL_ENTITY: Record<string, string> = {
  fecha: LEGAL_DATE_TEXT,

  // ── Datos del titular (obligatorios) ──
  titular: '[NOMBRE Y APELLIDOS O RAZÓN SOCIAL]',
  nif: '[NIF O CIF]',
  domicilio: '[DOMICILIO COMPLETO]',
  email: '[CORREO DE CONTACTO]',
  web: '[DIRECCIÓN DE LA WEB]',
  registro: 'no aplica',

  // ── Decisiones pendientes ──
  proveedor_pagos: '[PROVEEDOR DE PAGOS: P. EJ. STRIPE]',
  condiciones_pago: '[CONDICIONES DE PAGO PENDIENTES: PLANES, PRECIOS, PRUEBA GRATUITA, FACTURACIÓN Y RENOVACIÓN]',
  politica_copias: '[POLÍTICA DE COPIAS DE SEGURIDAD PENDIENTE: FRECUENCIA Y PLAZO DE CONSERVACIÓN SEGÚN EL PLAN CONTRATADO]',
  limite_responsabilidad: '[LÍMITE DE RESPONSABILIDAD PENDIENTE: A DEFINIR CON UN ABOGADO]',
  jurisdiccion: '[JURISDICCIÓN PENDIENTE: JUZGADOS COMPETENTES; SI LA PERSONA USUARIA ES CONSUMIDORA, LOS DE SU DOMICILIO]',
  plazo_supresion: '30',
}
