// La guía de uso para el nutricionista: un tema por archivo Markdown en esta carpeta.
import empezar from './empezar.md?raw'
import clientes from './clientes.md?raw'
import planes from './planes.md?raw'
import seguimiento from './seguimiento.md?raw'
import comunicacion from './comunicacion.md?raw'
import negocio from './negocio.md?raw'
import ajustes from './ajustes.md?raw'
import appCliente from './app-cliente.md?raw'
import preguntas from './preguntas.md?raw'

export interface HelpTopic { slug: string; title: string; summary: string; raw: string }

export const HELP_TOPICS: HelpTopic[] = [
  { slug: 'empezar', title: 'Empieza aquí', summary: 'Cómo funciona NutriFit y el mapa del panel.', raw: empezar },
  { slug: 'clientes', title: 'Clientes', summary: 'Crear, importar (con su historial de peso), ficha, baja.', raw: clientes },
  { slug: 'planes', title: 'Planes de dieta', summary: 'Objetivos, comidas, opciones, sustituciones, versiones y plantillas.', raw: planes },
  { slug: 'seguimiento', title: 'Seguimiento', summary: 'Revisión semanal, reajuste, balance de lo que come e informes.', raw: seguimiento },
  { slug: 'comunicacion', title: 'Citas, mensajes y avisos', summary: 'Calendario, WhatsApp, difusión, encuestas y notificaciones.', raw: comunicacion },
  { slug: 'negocio', title: 'Inicio, negocio y herramientas', summary: 'Tu día, ingresos, retención, conversor y micronutrientes.', raw: negocio },
  { slug: 'ajustes', title: 'Ajustes', summary: 'Cuenta, avisos, preguntas, marca y consentimiento.', raw: ajustes },
  { slug: 'app-cliente', title: 'La app del cliente', summary: 'Darle acceso, instalarla y qué ve en cada pestaña.', raw: appCliente },
  { slug: 'preguntas', title: 'Preguntas y problemas', summary: 'Si algo no se ve, no llega o no sabes dónde está.', raw: preguntas },
]
