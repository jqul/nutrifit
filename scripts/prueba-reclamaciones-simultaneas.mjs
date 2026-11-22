// PRUEBA DE RECLAMACIONES SIMULTÁNEAS contra un Supabase REAL (migraciones 0077 y 0078 aplicadas). NO EJECUTADA todavía.
//
// Qué comprueba: dos cuentas distintas (A y B), AMBAS válidas (email confirmado), usan a la vez la MISMA invitación sobre la misma ficha SIN email (la
// vinculación queda pendiente de aprobación). Debe salir exactamente UN 'pending_approval' y el otro rechazo ('invitation_used' o 'pending_exists'):
// nunca dos solicitudes. Después comprueba en la base que hay una sola solicitud pendiente. Repite la carrera ROUNDS veces con invitaciones nuevas.
// (Con una ficha CON email solo puede vincularse la cuenta con ese email, así que no habría dos candidatas válidas y la carrera no se ejercitaría.)
//
// DÓNDE EJECUTARLA: SOLO en un proyecto de Supabase aislado (una rama de base de datos o un proyecto de prueba) con datos FICTICIOS. No en producción.
//
// Variables de entorno (las contraseñas las escribe quien lo ejecuta; este fichero no las contiene):
//   SUPABASE_URL, SUPABASE_ANON_KEY
//   PROFESSIONAL_EMAIL, PROFESSIONAL_PASSWORD   — profesional de prueba dueño de la ficha
//   FICHA_ID                                    — ficha de prueba SIN email y sin vincular
//   CLIENT_A_EMAIL, CLIENT_A_PASSWORD           — cuenta A (email confirmado de verdad, no de profesional)
//   CLIENT_B_EMAIL, CLIENT_B_PASSWORD           — cuenta B (ídem)
//   ROUNDS (opcional, 5)
//
//   node scripts/prueba-reclamaciones-simultaneas.mjs
import { createClient } from '@supabase/supabase-js'

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta la variable ${k}`); process.exit(2) } return v }
const url = need('SUPABASE_URL'), anon = need('SUPABASE_ANON_KEY')
const rounds = Number(process.env.ROUNDS ?? 5)
const FICHA_ID = need('FICHA_ID')

async function sesion(email, password) {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo iniciar sesión (${email}): ${error.message}`)
  return c
}

const pro = await sesion(need('PROFESSIONAL_EMAIL'), need('PROFESSIONAL_PASSWORD'))
const a = await sesion(need('CLIENT_A_EMAIL'), need('CLIENT_A_PASSWORD'))
const b = await sesion(need('CLIENT_B_EMAIL'), need('CLIENT_B_PASSWORD'))

const pendientes = async () => (await pro.from('client_link_requests').select('id').eq('client_id', FICHA_ID).is('decision', null)).data ?? []
let fallos = 0
for (let i = 1; i <= rounds; i++) {
  // Estado limpio: sin solicitudes pendientes de la ronda anterior.
  for (const r of await pendientes()) await pro.rpc('reject_client_link', { p_request_id: r.id, p_reason: 'prueba de simultaneidad' })
  const { data: inv, error } = await pro.rpc('create_client_invitation', { p_client_id: FICHA_ID })
  if (error) throw new Error('create_client_invitation: ' + error.message)
  // Las dos reclamaciones salen a la vez.
  const [ra, rb] = await Promise.all([a.rpc('claim_client_with_invitation', { p_token: inv.token }), b.rpc('claim_client_with_invitation', { p_token: inv.token })])
  const resultados = [ra, rb].map((r) => (r.error ? `ERROR:${r.error.message}` : r.data?.result))
  const exitos = resultados.filter((r) => r === 'pending_approval').length
  const n = (await pendientes()).length
  const ok = exitos === 1 && n === 1 && resultados.every((r) => ['pending_approval', 'invitation_used', 'pending_exists'].includes(r))
  if (!ok) fallos++
  console.log(`ronda ${i}: A=${resultados[0]} B=${resultados[1]} · solicitudes pendientes=${n} → ${ok ? 'OK' : 'FALLO'}`)
}
for (const r of await pendientes()) await pro.rpc('reject_client_link', { p_request_id: r.id, p_reason: 'fin de la prueba' })
console.log(fallos === 0 ? 'RESULTADO: correcto, nunca hubo doble solicitud.' : `RESULTADO: ${fallos} ronda(s) incorrectas. NO desplegar.`)
process.exit(fallos === 0 ? 0 : 1)
