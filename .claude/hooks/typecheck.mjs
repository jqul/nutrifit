// Hook PostToolUse: tras editar un .ts/.tsx de src, pasa tsc y devuelve a Claude los errores de ESE fichero.
// Solo los de ese fichero para no repetir en cada edición errores que ya estaban en otros sitios.
// tsc es incremental (el estado se guarda en .claude/*.tsbuildinfo, ignorado por git): unos segundos en vez de ~35 s.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const entrada = JSON.parse(readFileSync(0, 'utf8') || '{}')
const fichero = entrada.tool_input?.file_path
if (!fichero || !/\.tsx?$/.test(fichero)) process.exit(0)

const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd()
const rel = relative(raiz, resolve(fichero)).replace(/\\/g, '/')

// Solo src entra en tsconfig.json; las funciones de Supabase son Deno y no se comprueban aquí.
if (!rel.startsWith('src/')) process.exit(0)

const tsc = join(raiz, 'node_modules', 'typescript', 'bin', 'tsc')
if (!existsSync(tsc)) process.exit(0)

const r = spawnSync(process.execPath, [
  tsc, '-p', 'tsconfig.json', '--noEmit', '--pretty', 'false',
  '--incremental', '--tsBuildInfoFile', '.claude/tsc-hook.tsbuildinfo',
], { cwd: raiz, encoding: 'utf8' })

// tsc escribe las rutas relativas a la carpeta desde la que se ejecuta (la raíz).
const errores = (r.stdout || '').split(/\r?\n/).filter((linea) => {
  const m = linea.match(/^(.+?)\(\d+,\d+\): error /)
  return m && resolve(raiz, m[1]) === resolve(fichero)
})

if (errores.length) {
  process.stderr.write(`tsc: ${errores.length} error(es) en ${rel}:\n${errores.join('\n')}\n`)
  process.exit(2)
}
