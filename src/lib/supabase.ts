/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'
import { resolveSupabaseConfig } from './supabaseConfig'

const config = resolveSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
)

// Seguir con los valores de reserva evita una pantalla en blanco, pero también
// puede ocultar una variable mal configurada en el despliegue: en producción se
// deja constancia en la consola (sin mostrar ninguna clave).
if (import.meta.env.PROD && config.warnings.length > 0) {
  console.warn(`[supabase] Usando valores de reserva: ${config.warnings.join('; ')}.`)
}

export const supabase = createClient(config.url, config.key)
