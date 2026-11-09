# NutriFit

App para nutricionistas: panel del nutricionista, app del cliente (por enlace con token) y landing pública. React 18 + Vite 7 + TypeScript + Tailwind 4, datos en Supabase y despliegue en Vercel.

## Comandos
- `npx tsc --noEmit`: tipos (`src`)
- `npm test`: pruebas unitarias con Vitest (`*.test.ts` junto al código)
- `npm run build`: tipos + construcción; es lo que ejecuta el CI (`.github/workflows/ci.yml`) junto con `npm test`
- `node scripts/sync-edge-shared.mjs`: regenera las copias de `src/lib` que usan las funciones de Supabase (ver abajo)
- Servidor de desarrollo: `nutrifit-dev` en `.claude/launch.json`. Demo del nutricionista: `/?demo=1` (datos ficticios en `src/lib/demo-data`)

## Dónde está cada cosa
- `src/lib/`: lógica pura con su `*.test.ts`. `src/types/index.ts`: tipos compartidos.
- `src/components/trainer/`, `client/`, `shared/`: pantallas del nutricionista, del cliente y comunes.
- `src/hooks/`: carga de datos con Supabase.
- `src/help/*.md` y `topics.ts`: la Ayuda dentro de la app. `src/landing/`: textos de la landing.
- `src/legal/`: textos legales en borrador; se publican con `LEGAL_REVIEWED` en `entity.ts` (ver `docs/legal-revision.md`).
- `supabase/migrations/NNNN_nombre.sql`: migraciones numeradas en orden. `supabase/functions/`: funciones de borde (Deno).
- `docs/`: guion de comprobación con sesión real, revisión legal, tareas de UX y marketing. `replica/`: análisis de apps de la competencia.

## Cosas que no son obvias
- **Código compartido con las funciones de borde.** Algunos ficheros de `src/lib` (los de `FUNCTION_TARGETS` en `scripts/sync-edge-shared.mjs`, como `fetchAll`, `adherence` o `clientAlerts`) se copian a `supabase/functions/*/shared/`. Si cambias uno, ejecuta `node scripts/sync-edge-shared.mjs`; `src/lib/edgeShared.test.ts` falla si las copias no coinciden. Nunca edites `shared/` a mano.
- **Demo:** las pantallas nuevas deben funcionar en `/?demo=1` sin guardar nada (`demoMode`).
- Guardar un plan notifica al cliente y restaurar una versión cambia el plan que ve: en pruebas con datos reales, usa un cliente de prueba.
- No edites `.env*` ni `package-lock.json` a mano.

## Flujo
- Rama `feat/<tema>` desde `origin/main`, PR y merge con el CI en verde.
- Todo en español: comentarios (explican el porqué), commits y PRs.
- Antes de decir "hecho": `npx tsc --noEmit`, `npm test` y, si se ve, comprobarlo en la demo.

## Hook de tipos
Tras editar un `.ts`/`.tsx` de `src/`, `.claude/hooks/typecheck.mjs` pasa `tsc` (incremental) y avisa solo de los errores del fichero editado. No sustituye al `npm run build` completo antes del PR.
