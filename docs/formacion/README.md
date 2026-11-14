# Programa de formación en nutrición para NutriFit

Programa de 16 módulos más un examen integrador, pedido el 2026-11-14. El objetivo es que quien trabaje en NutriFit (aquí, la IA que ayuda a construirlo) tenga criterio nutricional para **diseñar, desarrollar y auditar** la aplicación.

**NutriFit no incorpora una IA como funcionalidad del producto.** La IA es quien se forma, no una función de la app.

## Cómo leer estos documentos

- Cada módulo sigue la misma estructura: objetivos, temario, desarrollo, fórmulas, errores frecuentes, limitaciones y controversias, casos prácticos, bibliografía, examen, criterios de corrección y aplicaciones a NutriFit.
- **Los exámenes están respondidos por la IA y NO están corregidos ni puntuados.** La corrección la hace el usuario con los criterios de cada módulo. Ninguna nota de este programa es una autoevaluación.
- Marcas de fiabilidad en las cifras y referencias:
  - **[V]** verificado en una fuente durante esta formación (2026-11-14).
  - **[M]** de memoria o de manual, **sin verificar**: comprobar la fuente primaria antes de usarlo en el producto o en un texto dirigido a clientes.
  - Sin marca: razonamiento o descripción general que no depende de una cifra concreta.
- Se distingue entre evidencia sólida, evidencia limitada, hipótesis y opinión. Cuando no se sabe, se dice.
- Todo lo que dice «NutriFit hoy» describe el código **en el momento de escribir** (rama `main`, 2026-11-14) y se comprobó leyéndolo o ejecutándolo. No se ha cambiado código durante la formación.

## Índice

| # | Módulo |
|---|---|
| 1 | [Anatomía, fisiología y metabolismo humano](modulo-01-fisiologia-metabolismo.md) |
| 2 | [Bioquímica nutricional y composición de los nutrientes](modulo-02-bioquimica-nutrientes.md) |
| 3 | [Evaluación nutricional y antropometría](modulo-03-evaluacion-antropometria.md) |
| 4 | [Requerimientos energéticos y cálculos nutricionales](modulo-04-requerimientos-energeticos.md) |
| 5 | [Dietética y planificación alimentaria](modulo-05-dietetica-planificacion.md) |
| 6 | [Bases de datos de alimentos y composición](modulo-06-bases-datos-alimentos.md) |
| 7 | [Micronutrientes, suplementación y deficiencias](modulo-07-micronutrientes.md) |
| 8 | [Nutrición clínica y dietoterapia](modulo-08-nutricion-clinica.md) |
| 9 | [Nutrición deportiva](modulo-09-nutricion-deportiva.md) |
| 10 | [Nutrición en las etapas de la vida](modulo-10-etapas-vida.md) |
| 11 | [Alergias, intolerancias y seguridad alimentaria](modulo-11-alergias-seguridad.md) |
| 12 | [Conducta alimentaria, psicología y adherencia](modulo-12-conducta-adherencia.md) |
| 13 | [Investigación científica y medicina basada en la evidencia](modulo-13-evidencia-cientifica.md) |
| 14 | [Gestión profesional de consultas de nutrición](modulo-14-gestion-consulta.md) |
| 15 | [Ingeniería de software aplicada a la nutrición](modulo-15-ingenieria-software.md) |
| 16 | [Auditoría y desarrollo integral de NutriFit](modulo-16-auditoria-nutrifit.md) |
| — | [Examen integrador](examen-integrador.md) |
| — | [Recuperación del Módulo 16](recuperacion-modulo-16.md): corrección recibida, rediseño del control de objetivos energéticos y protocolo de incidentes por alérgenos |

## Estado

| Módulo | Desarrollado | Examen respondido por la IA | Corregido por el usuario |
|---|---|---|---|
| 1 a 16 | sí | sí | pendiente |
| Integrador | sí | sí | pendiente |

## Referencias verificadas en esta formación [V]

- Elia M. (1992), tasas metabólicas de órganos y tejidos (hígado 200, cerebro 240, corazón y riñón 440, músculo esquelético 13, tejido adiposo 4,5, resto 12 kcal/kg/día). Estudios posteriores las confirman en adultos no obesos y las matizan en obesidad y mayores de 50 años.
- Hall KD et al. *Lancet* 2011;378:826-837. La regla estática de 3.500 kcal por libra (≈7.700 kcal/kg) ignora adaptaciones dinámicas; la respuesta del peso es lenta (semivida ≈1 año).
- Fothergill E et al. *Obesity* 2016;24:1612-1619. Adaptación metabólica de −499 ± 207 kcal/día a los 6 años en 14 concursantes de un programa extremo.
- Pontzer H et al. *Science* 2021;373:808-812. Gasto ajustado a masa libre de grasa estable de los 20 a los 60 años y descenso después.
- Sender R, Fuchs S, Milo R. *PLoS Biol* 2016. ≈3,8·10¹³ bacterias y ≈3,0·10¹³ células humanas en un varón de referencia de 70 kg (ratio ≈1,3, ≈25 % de incertidumbre).
- Westerterp KR. *Nutr Metab* 2004;1:5. Efecto térmico de una dieta mixta de 5 a 15 % del gasto diario; sus determinantes son el contenido energético y las fracciones de proteína y alcohol. Orden de oxidación posprandial: alcohol, proteína, hidratos, grasa.
- EFSA (2012). Ingesta de referencia de proteína para adultos: 0,83 g por kg y día.
- Mifflin MD et al. (1990). Varones: 10·peso(kg) + 6,25·talla(cm) − 5·edad + 5; mujeres, igual con −161. Roza AM, Shizgal HM (1984), Harris-Benedict revisada: varones 88,362 + 13,397·peso + 4,799·talla − 5,677·edad; mujeres 447,593 + 9,247·peso + 3,098·talla − 4,330·edad.
- FAO/OMS/UNU (2004), *Human Energy Requirements*. Nivel de actividad física (PAL): sedentario o ligero 1,40-1,69; activo o moderadamente activo 1,70-1,99; vigoroso 2,00-2,39 (valores ≥2,40 son difíciles de mantener).
- EFSA, valores de referencia (2017), en una tabla de un manual (fuente secundaria): hierro 11 mg varones y 16 mg mujeres premenopáusicas; calcio 950 mg; yodo 150 µg. **Parcial: confirmar en el EFSA DRV Finder.**

## Correcciones al Módulo 1 tras verificar

Glucógeno hepático ≈100-120 g; glucógeno muscular, las fuentes dan 300-400 g y discrepan; agua unida al glucógeno 2-4 g por g (3 g es lo más citado, en fuentes de divulgación); efecto térmico de una dieta mixta 5-15 % del gasto diario, y los porcentajes por macronutriente de manual (proteína 20-30 %, hidratos 5-10 %, grasa 0-3 %) **no se confirmaron**.

## Hallazgos de auditoría de NutriFit

Resumidos en el [Módulo 16](modulo-16-auditoria-nutrifit.md). Se comprobaron ejecutando el código; **no se ha modificado nada**.
