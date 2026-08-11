/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

// La anon key de Supabase está diseñada para ir embebida en clientes públicos
// (el acceso real lo controla RLS, no el secreto de esta clave) — igual que ya
// va público en cualquier build de este proyecto. Se mantienen como fallback
// fijo porque algunas plataformas (visto en Vercel: variables de entorno con
// forma de JWT tratadas como "sensibles" y enmascaradas en el build estático)
// pueden acabar sirviendo un valor corrupto en vez del real si se dejan solo
// como variable de entorno.
const FALLBACK_URL = 'https://yuhebegybxjrdmkpwjqa.supabase.co'
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1aGViZWd5YnhqcmRta3B3anFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzU2MTgsImV4cCI6MjEwMDkxMTYxOH0.P8R5_g77FMhBE8kZtujaHhlg4QmUSMbfRSeucYG3r2k'

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Si la variable de entorno existe pero no tiene forma de JWT válido (p. ej.
// llegó enmascarada/truncada por la plataforma de despliegue), se ignora y se
// usa el valor de reserva en su lugar.
const looksLikeJwt = (v?: string) => !!v && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)

const SUPABASE_URL = envUrl && envUrl.startsWith('https://') ? envUrl : FALLBACK_URL
const SUPABASE_KEY = looksLikeJwt(envKey) ? envKey! : FALLBACK_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
