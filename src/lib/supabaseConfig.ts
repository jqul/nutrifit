// Qué URL y clave de Supabase usa la app, y por qué. Separado de supabase.ts
// para poder probarlo sin crear el cliente.
//
// La anon key de Supabase está diseñada para ir embebida en clientes públicos
// (el acceso real lo controla RLS, no el secreto de esta clave) — igual que ya
// va público en cualquier build de este proyecto. Se mantienen como fallback
// fijo porque algunas plataformas (visto en Vercel: variables de entorno con
// forma de JWT tratadas como "sensibles" y enmascaradas en el build estático)
// pueden acabar sirviendo un valor corrupto en vez del real si se dejan solo
// como variable de entorno.
export const FALLBACK_URL = 'https://yuhebegybxjrdmkpwjqa.supabase.co'
export const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aGViZWd5YnhqcmRta3B3anFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzU2MTgsImV4cCI6MjEwMDkxMTYxOH0.P8R5_g77FMhBE8kZtujaHhlg4QmUSMbfRSeucYG3r2k'

// Si la variable de entorno existe pero no tiene forma de JWT válido (p. ej.
// llegó enmascarada/truncada por la plataforma de despliegue), se ignora.
const looksLikeJwt = (v?: string) => !!v && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)

export interface SupabaseConfig {
  url: string
  key: string
  /** Motivos por los que se ha usado el valor de reserva (vacío si todo viene del entorno). */
  warnings: string[]
}

export function resolveSupabaseConfig(envUrl?: string, envKey?: string): SupabaseConfig {
  const warnings: string[] = []

  const urlOk = !!envUrl && envUrl.startsWith('https://')
  const keyOk = looksLikeJwt(envKey)
  const url = urlOk ? envUrl! : FALLBACK_URL
  const key = keyOk ? envKey! : FALLBACK_ANON_KEY

  if (!urlOk) warnings.push(envUrl ? 'VITE_SUPABASE_URL no es una URL https válida' : 'falta VITE_SUPABASE_URL')
  if (!keyOk) warnings.push(envKey ? 'VITE_SUPABASE_ANON_KEY no tiene forma de JWT (¿enmascarada o truncada por la plataforma?)' : 'falta VITE_SUPABASE_ANON_KEY')
  // El peor caso: una URL de otro proyecto con la clave de reserva (o al revés) no autentica en ninguno.
  if (urlOk !== keyOk && (urlOk ? url !== FALLBACK_URL : key !== FALLBACK_ANON_KEY)) {
    warnings.push(urlOk ? 'la URL viene del entorno pero la clave es la de reserva: pueden ser de proyectos distintos' : 'la clave viene del entorno pero la URL es la de reserva: pueden ser de proyectos distintos')
  }
  return { url, key, warnings }
}
