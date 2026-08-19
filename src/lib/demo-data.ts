import { UserProfile, ClientData, DietPlan, WeightEntry, DailyCheckin, ProgressPhotoSession, FollowedPlan, MealLog, Appointment } from '../types'
import { DietTemplateRow, RecipeRow, InvoiceRow, CustomSurveyRow, SurveyResponseRow, BloodMarkerRow } from './supabase-types'
import { periodKeyFor } from './surveyPeriod'

export const DEMO_NUTRICIONISTA_ID = 'demo-nutri-001'

export const DEMO_NUTRICIONISTA_PROFILE: UserProfile = {
  uid: DEMO_NUTRICIONISTA_ID,
  email: 'demo@nutrifit.app',
  displayName: 'Alex Nutricionista',
  role: 'trainer',
  approved: true,
  createdAt: Date.now(),
  customAnamnesisQuestions: [
    { id: 'demo-q1', label: '¿Sigues alguna dieta religiosa o cultural (halal, kosher, vegana estricta...)?', type: 'yesno', required: false },
    { id: 'demo-q2', label: '¿Cómo valorarías tu nivel de estrés habitual?', type: 'scale', required: false },
    { id: 'demo-q3', label: '¿Cuál es tu comida favorita del día?', type: 'choice', options: ['Desayuno', 'Comida', 'Cena'], required: false },
  ],
  logoUrl: null,
  accentColor: null,
  customDomain: null,
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalISODate(d)
}

// Placeholder de foto de progreso (SVG a color, sin depender de un bucket real).
function placeholderPhoto(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#fff" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// ── Clientes ────────────────────────────────────────────────

export const DEMO_CLIENTS: ClientData[] = [
  {
    id: 'demo-client-001',
    nutricionistaId: DEMO_NUTRICIONISTA_ID,
    token: 'demo-token-maria',
    authUserId: null,
    name: 'María', surname: 'Torres',
    phone: '600111222', email: 'maria@demo.nutrifit.app',
    birthDate: '1990-04-12', gender: 'Mujer', heightCm: 165,
    goal: 'perder_peso',
    allergies: 'Intolerancia a la lactosa',
    notes: 'Prefiere comidas sencillas de preparar entre semana, cocina los domingos para toda la semana.',
    monthlyPrice: 45, goalWeightKg: 62, customMessages: {}, tags: ['Pérdida de grasa - Nivel 1'],
    createdAt: Date.now() - 60 * 86400000,
  },
  {
    id: 'demo-client-002',
    nutricionistaId: DEMO_NUTRICIONISTA_ID,
    token: 'demo-token-carlos',
    authUserId: null,
    name: 'Carlos', surname: 'Ruiz',
    phone: '600333444', email: 'carlos@demo.nutrifit.app',
    birthDate: '1995-09-03', gender: 'Hombre', heightCm: 180,
    goal: 'ganar_masa',
    allergies: '',
    notes: 'Entrena 5 días/semana, necesita opciones altas en proteína para llevar al gimnasio.',
    monthlyPrice: 60, goalWeightKg: 78, customMessages: {}, tags: ['Ganancia muscular', 'Deportista'],
    createdAt: Date.now() - 90 * 86400000,
  },
  {
    id: 'demo-client-003',
    nutricionistaId: DEMO_NUTRICIONISTA_ID,
    token: 'demo-token-laura',
    authUserId: null,
    name: 'Laura', surname: 'Gómez',
    phone: '600555666', email: 'laura@demo.nutrifit.app',
    birthDate: '1988-01-20', gender: 'Mujer', heightCm: 170,
    goal: 'salud',
    allergies: 'Alergia a los frutos secos',
    notes: 'Lleva 10 días sin registrar check-in — pendiente de contactar.',
    monthlyPrice: 40, goalWeightKg: null, customMessages: {}, tags: ['Pérdida de grasa - Nivel 1', 'Riesgo de abandono'],
    createdAt: Date.now() - 45 * 86400000,
  },
]

// ── Planes de dieta ─────────────────────────────────────────

export const DEMO_DIET_PLANS: Record<string, DietPlan> = {
  'demo-client-001': {
    id: 'demo-plan-maria', clientId: 'demo-client-001', nutricionistaId: DEMO_NUTRICIONISTA_ID,
    name: 'Plan de dieta', kcalTarget: 1600, proteinG: 130, carbsG: 150, fatG: 45, fiberG: 28,
    advice: 'Prioriza la proteína en cada comida y bebe al menos 2L de agua al día. Vamos muy bien con la pérdida de peso, ¡sigue así!',
    isActive: true,
    meals: [
      { id: 'm1', name: 'Desayuno', time: '08:00', kcalTarget: 350, items: [
        { id: 'i1', foodName: 'Yogur natural sin lactosa', quantity: '150', unit: 'g', kcal: 90, proteinG: 8, carbsG: 10, fatG: 2 },
        { id: 'i2', foodName: 'Avena', quantity: '40', unit: 'g', kcal: 150, proteinG: 5, carbsG: 27, fatG: 3 },
        { id: 'i3', foodName: 'Arándanos', quantity: '50', unit: 'g', kcal: 30, proteinG: 0, carbsG: 7, fatG: 0 },
      ]},
      { id: 'm2', name: 'Comida', time: '14:00', kcalTarget: 550, items: [
        { id: 'i4', foodName: 'Pechuga de pollo', quantity: '150', unit: 'g', kcal: 230, proteinG: 45, carbsG: 0, fatG: 5 },
        { id: 'i5', foodName: 'Arroz integral', quantity: '60', unit: 'g', kcal: 210, proteinG: 5, carbsG: 44, fatG: 2 },
        { id: 'i6', foodName: 'Verdura al vapor', quantity: '200', unit: 'g', kcal: 60, proteinG: 3, carbsG: 12, fatG: 0 },
      ]},
      { id: 'm3', name: 'Merienda', time: '17:30', kcalTarget: 150, items: [
        { id: 'i7', foodName: 'Manzana', quantity: '1', unit: 'ud', kcal: 80, proteinG: 0, carbsG: 21, fatG: 0 },
        { id: 'i8', foodName: 'Almendras', quantity: '15', unit: 'g', kcal: 90, proteinG: 3, carbsG: 2, fatG: 8 },
      ]},
      { id: 'm4', name: 'Cena', time: '21:00', kcalTarget: 550, items: [
        { id: 'i9', foodName: 'Salmón', quantity: '150', unit: 'g', kcal: 280, proteinG: 35, carbsG: 0, fatG: 15 },
        { id: 'i10', foodName: 'Boniato asado', quantity: '150', unit: 'g', kcal: 130, proteinG: 2, carbsG: 30, fatG: 0 },
        { id: 'i11', foodName: 'Ensalada verde', quantity: '100', unit: 'g', kcal: 20, proteinG: 1, carbsG: 3, fatG: 0 },
      ]},
    ],
    supplements: [
      { id: 's1', name: 'Multivitamínico', dose: '1 cápsula', timing: 'Con el desayuno', visibleToClient: true },
    ],
    createdAt: Date.now() - 40 * 86400000, updatedAt: Date.now() - 2 * 86400000,
  },
  'demo-client-002': {
    id: 'demo-plan-carlos', clientId: 'demo-client-002', nutricionistaId: DEMO_NUTRICIONISTA_ID,
    name: 'Plan de dieta', kcalTarget: 2800, proteinG: 180, carbsG: 320, fatG: 80, fiberG: 35,
    advice: 'Superávit calórico progresivo. Añade la merienda post-entreno los días que vayas al gimnasio, no te la saltes.',
    isActive: true,
    meals: [
      { id: 'm1', name: 'Desayuno', time: '07:30', kcalTarget: 600, items: [
        { id: 'i1', foodName: 'Huevos revueltos', quantity: '3', unit: 'ud', kcal: 220, proteinG: 18, carbsG: 2, fatG: 15 },
        { id: 'i2', foodName: 'Pan integral', quantity: '80', unit: 'g', kcal: 200, proteinG: 8, carbsG: 38, fatG: 2 },
        { id: 'i3', foodName: 'Aguacate', quantity: '50', unit: 'g', kcal: 80, proteinG: 1, carbsG: 4, fatG: 7 },
      ]},
      { id: 'm2', name: 'Comida', time: '13:30', kcalTarget: 800, items: [
        { id: 'i4', foodName: 'Ternera magra', quantity: '200', unit: 'g', kcal: 380, proteinG: 50, carbsG: 0, fatG: 18 },
        { id: 'i5', foodName: 'Pasta integral', quantity: '100', unit: 'g', kcal: 350, proteinG: 13, carbsG: 68, fatG: 2 },
      ]},
      { id: 'm3', name: 'Post-entreno', time: '18:00', kcalTarget: 400, items: [
        { id: 'i6', foodName: 'Batido de proteína', quantity: '1', unit: 'scoop', kcal: 120, proteinG: 24, carbsG: 3, fatG: 1 },
        { id: 'i7', foodName: 'Plátano', quantity: '1', unit: 'ud', kcal: 100, proteinG: 1, carbsG: 27, fatG: 0 },
      ]},
      { id: 'm4', name: 'Cena', time: '21:30', kcalTarget: 700, items: [
        { id: 'i8', foodName: 'Merluza', quantity: '200', unit: 'g', kcal: 200, proteinG: 40, carbsG: 0, fatG: 4 },
        { id: 'i9', foodName: 'Patata cocida', quantity: '250', unit: 'g', kcal: 220, proteinG: 5, carbsG: 50, fatG: 0 },
      ]},
    ],
    supplements: [
      { id: 's1', name: 'Proteína whey', dose: '1 scoop', timing: 'Post-entreno', visibleToClient: true },
      { id: 's2', name: 'Creatina', dose: '5g', timing: 'Cualquier momento del día', visibleToClient: true },
    ],
    createdAt: Date.now() - 75 * 86400000, updatedAt: Date.now() - 5 * 86400000,
  },
  'demo-client-003': {
    id: 'demo-plan-laura', clientId: 'demo-client-003', nutricionistaId: DEMO_NUTRICIONISTA_ID,
    name: 'Plan de dieta', kcalTarget: 1900, proteinG: 100, carbsG: 200, fatG: 60, fiberG: 25,
    advice: 'Llevamos unos días sin noticias — escríbeme si algo del plan no te está encajando, lo ajustamos juntas.',
    isActive: true,
    meals: [
      { id: 'm1', name: 'Desayuno', time: '08:30', kcalTarget: 400, items: [
        { id: 'i1', foodName: 'Tostadas integrales', quantity: '2', unit: 'ud', kcal: 180, proteinG: 6, carbsG: 32, fatG: 2 },
        { id: 'i2', foodName: 'Tomate y aceite de oliva', quantity: '1', unit: 'ración', kcal: 100, proteinG: 1, carbsG: 5, fatG: 9 },
      ]},
      { id: 'm2', name: 'Comida', time: '14:30', kcalTarget: 700, items: [
        { id: 'i3', foodName: 'Lentejas estofadas', quantity: '300', unit: 'g', kcal: 350, proteinG: 20, carbsG: 55, fatG: 5 },
        { id: 'i4', foodName: 'Pan', quantity: '40', unit: 'g', kcal: 100, proteinG: 3, carbsG: 20, fatG: 1 },
      ]},
      { id: 'm3', name: 'Cena', time: '21:00', kcalTarget: 600, items: [
        { id: 'i5', foodName: 'Tortilla francesa', quantity: '2', unit: 'huevos', kcal: 180, proteinG: 14, carbsG: 1, fatG: 13 },
        { id: 'i6', foodName: 'Espárragos trigueros', quantity: '150', unit: 'g', kcal: 40, proteinG: 4, carbsG: 5, fatG: 0 },
      ]},
    ],
    supplements: [
      { id: 's1', name: 'Omega-3', dose: '1 cápsula', timing: 'Con la comida', visibleToClient: false },
    ],
    createdAt: Date.now() - 30 * 86400000, updatedAt: Date.now() - 10 * 86400000,
  },
}

// ── Peso corporal ───────────────────────────────────────────

// Cada array de "días atrás" va de más antiguo a más reciente, emparejado por
// índice con el array de pesos en el mismo orden — así el peso más reciente
// (índice más alto) es el último en el tiempo, sin necesidad de invertir nada.
export const DEMO_WEIGHTS: Record<string, WeightEntry[]> = {
  'demo-client-001': [42, 35, 28, 21, 14, 7, 2].map((d, i) => ({
    id: `w-maria-${i}`, clientId: 'demo-client-001', date: daysAgo(d), note: '',
    weightKg: [68, 67.2, 66.6, 65.8, 65.1, 64.5, 64][i],
  })),
  'demo-client-002': [56, 49, 42, 35, 28, 21, 14, 7].map((d, i) => ({
    id: `w-carlos-${i}`, clientId: 'demo-client-002', date: daysAgo(d), note: '',
    weightKg: [70, 70.6, 71.3, 72, 72.5, 73.1, 73.6, 74][i],
  })),
  'demo-client-003': [30, 20, 10].map((d, i) => ({
    id: `w-laura-${i}`, clientId: 'demo-client-003', date: daysAgo(d), note: '',
    weightKg: [75.4, 75.1, 75.2][i],
  })),
}

// ── Check-ins diarios ───────────────────────────────────────

function buildCheckins(clientId: string, pattern: FollowedPlan[], startDaysAgo: number): DailyCheckin[] {
  return pattern.map((followedPlan, i) => {
    const d = startDaysAgo - i
    return {
      id: `c-${clientId}-${i}`, clientId, date: daysAgo(d), followedPlan,
      hunger: 2 + (i % 3), energy: 3 + (i % 2), mood: 3 + ((i + 1) % 2),
      waterL: 1.5 + (i % 4) * 0.3, notes: '',
    }
  })
}

export const DEMO_CHECKINS: Record<string, DailyCheckin[]> = {
  // María: constante, buena racha, adherencia alta. Diario digestivo sin nada reseñable.
  'demo-client-001': buildCheckins('demo-client-001',
    ['si', 'si', 'si', 'parcial', 'si', 'si', 'si', 'si', 'parcial', 'si', 'si', 'si'], 11)
    .map((c, i, arr) => i === arr.length - 1 ? { ...c, bristolScale: 4, bloating: 0, abdominalPain: 0 } : c),
  // Carlos: adherencia media, algún día suelto. Diario digestivo con hinchazón/molestias
  // moderadas los últimos días — el tipo de patrón que el nutricionista quiere ver a tiempo.
  'demo-client-002': buildCheckins('demo-client-002',
    ['si', 'parcial', 'si', 'no', 'si', 'parcial', 'si', 'si', 'no', 'parcial', 'si', 'si', 'si', 'parcial'], 13)
    .map((c, i, arr) => i === arr.length - 1 ? { ...c, bristolScale: 6, bloating: 2, abdominalPain: 1 } : c),
  // Laura: sin check-ins recientes — cliente en riesgo.
  'demo-client-003': buildCheckins('demo-client-003', ['parcial', 'no', 'si'], 10),
}

// ── Plantillas y recetario (demo, solo lectura/local) ──────

export const DEMO_DIET_TEMPLATES: DietTemplateRow[] = [
  {
    id: 'demo-tpl-001', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Pérdida de peso 1600 kcal',
    plan: {
      kcalTarget: 1600, proteinG: 130, carbsG: 150, fatG: 45,
      advice: 'Prioriza la proteína en cada comida y bebe al menos 2L de agua al día.',
      meals: [
        { name: 'Desayuno', time: '08:00', kcalTarget: 350, items: [
          { id: 'dt1i1', foodName: 'Yogur natural', quantity: '150', unit: 'g', kcal: '90', proteinG: '8', carbsG: '10', fatG: '2' },
          { id: 'dt1i2', foodName: 'Avena', quantity: '40', unit: 'g', kcal: '150', proteinG: '5', carbsG: '27', fatG: '3' },
        ]},
        { name: 'Comida', time: '14:00', kcalTarget: 550, items: [
          { id: 'dt1i3', foodName: 'Pechuga de pollo', quantity: '150', unit: 'g', kcal: '230', proteinG: '45', carbsG: '0', fatG: '5' },
          { id: 'dt1i4', foodName: 'Arroz integral', quantity: '60', unit: 'g', kcal: '210', proteinG: '5', carbsG: '44', fatG: '2' },
        ]},
        { name: 'Cena', time: '21:00', kcalTarget: 550, items: [
          { id: 'dt1i5', foodName: 'Salmón', quantity: '150', unit: 'g', kcal: '280', proteinG: '35', carbsG: '0', fatG: '15' },
          { id: 'dt1i6', foodName: 'Boniato asado', quantity: '150', unit: 'g', kcal: '130', proteinG: '2', carbsG: '30', fatG: '0' },
        ]},
      ],
      supplements: [{ name: 'Multivitamínico', dose: '1 cápsula', timing: 'Con el desayuno', visibleToClient: true }],
    },
  },
  {
    id: 'demo-tpl-002', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Volumen 2800 kcal',
    plan: {
      kcalTarget: 2800, proteinG: 180, carbsG: 320, fatG: 80,
      advice: 'Superávit calórico progresivo. No te saltes la merienda post-entreno.',
      meals: [
        { name: 'Desayuno', time: '07:30', kcalTarget: 600, items: [
          { id: 'dt2i1', foodName: 'Huevos revueltos', quantity: '3', unit: 'ud', kcal: '220', proteinG: '18', carbsG: '2', fatG: '15' },
          { id: 'dt2i2', foodName: 'Pan integral', quantity: '80', unit: 'g', kcal: '200', proteinG: '8', carbsG: '38', fatG: '2' },
        ]},
        { name: 'Post-entreno', time: '18:00', kcalTarget: 400, items: [
          { id: 'dt2i3', foodName: 'Batido de proteína', quantity: '1', unit: 'scoop', kcal: '120', proteinG: '24', carbsG: '3', fatG: '1' },
          { id: 'dt2i4', foodName: 'Plátano', quantity: '1', unit: 'ud', kcal: '100', proteinG: '1', carbsG: '27', fatG: '0' },
        ]},
      ],
      supplements: [
        { name: 'Proteína whey', dose: '1 scoop', timing: 'Post-entreno', visibleToClient: true },
        { name: 'Creatina', dose: '5g', timing: 'Cualquier momento', visibleToClient: true },
      ],
    },
  },
]

export const DEMO_RECIPES: RecipeRow[] = [
  {
    id: 'demo-recipe-system-001', nutricionista_id: null, name: 'Bowl de avena con plátano y almendras', created_at: '',
    photo_url: placeholderPhoto('Bowl avena', '#c98a2b'), steps: null,
    items: [
      { id: 'pr1-1', foodName: 'Avena', quantity: '50', unit: 'g', kcal: '195', proteinG: '8.5', carbsG: '33', fatG: '3.5', fiberG: '5.1', sugarG: '0.5', sodiumMg: '1', saturatedFatG: '0.7', calciumMg: '27', ironMg: '2.2', zincMg: '2' },
      { id: 'pr1-2', foodName: 'Plátano', quantity: '100', unit: 'g', kcal: '89', proteinG: '1.1', carbsG: '23', fatG: '0.3', fiberG: '2.6', sugarG: '12.2', sodiumMg: '1', saturatedFatG: '0.1', calciumMg: '5', ironMg: '0.3', zincMg: '0.2' },
      { id: 'pr1-3', foodName: 'Almendras', quantity: '15', unit: 'g', kcal: '87', proteinG: '3.2', carbsG: '3.3', fatG: '7.5', fiberG: '1.9', sugarG: '0.7', sodiumMg: '0.2', saturatedFatG: '0.6', calciumMg: '40', ironMg: '0.6', zincMg: '0.5' },
      { id: 'pr1-4', foodName: 'Yogur griego', quantity: '150', unit: 'g', kcal: '146', proteinG: '13.5', carbsG: '6', fatG: '7.5', fiberG: '0', sugarG: '6', sodiumMg: '54', saturatedFatG: '4.8', calciumMg: '165', ironMg: '0.2', zincMg: '0.8' },
    ],
  },
  {
    id: 'demo-recipe-system-002', nutricionista_id: null, name: 'Pollo con arroz integral y brócoli', created_at: '',
    photo_url: placeholderPhoto('Pollo arroz', '#4a7a3d'), steps: null,
    items: [
      { id: 'pr2-1', foodName: 'Pechuga de pollo', quantity: '150', unit: 'g', kcal: '248', proteinG: '46.5', carbsG: '0', fatG: '5.4', fiberG: '0', sugarG: '0', sodiumMg: '111', saturatedFatG: '1.5', calciumMg: '9', ironMg: '0.6', zincMg: '1.1' },
      { id: 'pr2-2', foodName: 'Arroz integral (cocido)', quantity: '150', unit: 'g', kcal: '167', proteinG: '3.9', carbsG: '34.5', fatG: '1.4', fiberG: '2.7', sugarG: '0.3', sodiumMg: '3', saturatedFatG: '0.3', calciumMg: '6', ironMg: '0.6', zincMg: '0.9' },
      { id: 'pr2-3', foodName: 'Brócoli', quantity: '150', unit: 'g', kcal: '51', proteinG: '4.2', carbsG: '10.5', fatG: '0.6', fiberG: '3.9', sugarG: '2.6', sodiumMg: '50', saturatedFatG: '0.2', calciumMg: '71', ironMg: '1.1', zincMg: '0.6' },
      { id: 'pr2-4', foodName: 'Aceite de oliva', quantity: '10', unit: 'g', kcal: '88', proteinG: '0', carbsG: '0', fatG: '10', fiberG: '0', sugarG: '0', sodiumMg: '0', saturatedFatG: '1.4', calciumMg: '0.1', ironMg: '0.1', zincMg: '0' },
    ],
  },
  {
    id: 'demo-recipe-system-003', nutricionista_id: null, name: 'Boloñesa de pasta integral con carne', created_at: '',
    photo_url: placeholderPhoto('Boloñesa', '#b5573d'),
    steps: '1. Pica la cebolla y sofríela en el aceite de oliva a fuego medio hasta que esté transparente.\n2. Añade la ternera picada y dora bien, deshaciendo los grumos.\n3. Incorpora el tomate triturado, sazona y cuece 15-20 min a fuego bajo.\n4. Mientras, cuece la pasta integral según el envase.\n5. Mezcla la pasta con la salsa y sirve.',
    items: [
      { id: 'pr3-1', foodName: 'Pasta integral (cocida)', quantity: '200', unit: 'g', kcal: '248', proteinG: '10.6', carbsG: '50', fatG: '2.2', fiberG: '9', sugarG: '1.4', sodiumMg: '6', saturatedFatG: '0.4', calciumMg: '26', ironMg: '2.6', zincMg: '2' },
      { id: 'pr3-2', foodName: 'Ternera magra (picada)', quantity: '150', unit: 'g', kcal: '258', proteinG: '40.5', carbsG: '0', fatG: '10.5', fiberG: '0', sugarG: '0', sodiumMg: '98', saturatedFatG: '4.5', calciumMg: '12', ironMg: '3.2', zincMg: '6' },
      { id: 'pr3-3', foodName: 'Tomate (triturado)', quantity: '200', unit: 'g', kcal: '36', proteinG: '1.8', carbsG: '7.8', fatG: '0.4', fiberG: '2.4', sugarG: '5.2', sodiumMg: '10', saturatedFatG: '0', calciumMg: '20', ironMg: '0.6', zincMg: '0.4' },
      { id: 'pr3-4', foodName: 'Cebolla', quantity: '50', unit: 'g', kcal: '20', proteinG: '0.6', carbsG: '4.7', fatG: '0.1', fiberG: '0.9', sugarG: '2.1', sodiumMg: '2', saturatedFatG: '0', calciumMg: '12', ironMg: '0.1', zincMg: '0.1' },
      { id: 'pr3-5', foodName: 'Aceite de oliva', quantity: '10', unit: 'g', kcal: '88', proteinG: '0', carbsG: '0', fatG: '10', fiberG: '0', sugarG: '0', sodiumMg: '0', saturatedFatG: '1.4', calciumMg: '0.1', ironMg: '0.1', zincMg: '0' },
    ],
  },
  {
    id: 'demo-recipe-system-004', nutricionista_id: null, name: 'Boloñesa de pasta integral con tofu (plant-based)', created_at: '',
    photo_url: placeholderPhoto('Boloñesa tofu', '#7a8a3d'), steps: null,
    items: [
      { id: 'pr4-1', foodName: 'Pasta integral (cocida)', quantity: '200', unit: 'g', kcal: '248', proteinG: '10.6', carbsG: '50', fatG: '2.2', fiberG: '9', sugarG: '1.4', sodiumMg: '6', saturatedFatG: '0.4', calciumMg: '26', ironMg: '2.6', zincMg: '2' },
      { id: 'pr4-2', foodName: 'Tofu (desmenuzado)', quantity: '200', unit: 'g', kcal: '152', proteinG: '16', carbsG: '3.8', fatG: '9.6', fiberG: '0.6', sugarG: '1.2', sodiumMg: '14', saturatedFatG: '1.4', calciumMg: '700', ironMg: '10.8', zincMg: '1.6' },
      { id: 'pr4-3', foodName: 'Tomate (triturado)', quantity: '200', unit: 'g', kcal: '36', proteinG: '1.8', carbsG: '7.8', fatG: '0.4', fiberG: '2.4', sugarG: '5.2', sodiumMg: '10', saturatedFatG: '0', calciumMg: '20', ironMg: '0.6', zincMg: '0.4' },
      { id: 'pr4-4', foodName: 'Cebolla', quantity: '50', unit: 'g', kcal: '20', proteinG: '0.6', carbsG: '4.7', fatG: '0.1', fiberG: '0.9', sugarG: '2.1', sodiumMg: '2', saturatedFatG: '0', calciumMg: '12', ironMg: '0.1', zincMg: '0.1' },
      { id: 'pr4-5', foodName: 'Aceite de oliva', quantity: '10', unit: 'g', kcal: '88', proteinG: '0', carbsG: '0', fatG: '10', fiberG: '0', sugarG: '0', sodiumMg: '0', saturatedFatG: '1.4', calciumMg: '0.1', ironMg: '0.1', zincMg: '0' },
    ],
  },
  {
    id: 'demo-recipe-system-005', nutricionista_id: null, name: 'Ensalada de garbanzos con aguacate', created_at: '',
    photo_url: placeholderPhoto('Ens. garbanzos', '#6b8f3f'), steps: null,
    items: [
      { id: 'pr5-1', foodName: 'Garbanzos (cocidos)', quantity: '150', unit: 'g', kcal: '246', proteinG: '13.5', carbsG: '40.5', fatG: '3.9', fiberG: '11.4', sugarG: '7.2', sodiumMg: '11', saturatedFatG: '0.5', calciumMg: '74', ironMg: '4.4', zincMg: '2.3' },
      { id: 'pr5-2', foodName: 'Espinacas', quantity: '50', unit: 'g', kcal: '12', proteinG: '1.5', carbsG: '1.8', fatG: '0.2', fiberG: '1.1', sugarG: '0.2', sodiumMg: '40', saturatedFatG: '0.1', calciumMg: '50', ironMg: '1.4', zincMg: '0.3' },
      { id: 'pr5-3', foodName: 'Zanahoria', quantity: '80', unit: 'g', kcal: '33', proteinG: '0.7', carbsG: '8', fatG: '0.2', fiberG: '2.2', sugarG: '3.8', sodiumMg: '55', saturatedFatG: '0.1', calciumMg: '26', ironMg: '0.2', zincMg: '0.2' },
      { id: 'pr5-4', foodName: 'Aguacate', quantity: '50', unit: 'g', kcal: '80', proteinG: '1', carbsG: '4.3', fatG: '7.5', fiberG: '3.4', sugarG: '0.4', sodiumMg: '4', saturatedFatG: '1.1', calciumMg: '6', ironMg: '0.3', zincMg: '0.3' },
      { id: 'pr5-5', foodName: 'Aceite de oliva', quantity: '10', unit: 'g', kcal: '88', proteinG: '0', carbsG: '0', fatG: '10', fiberG: '0', sugarG: '0', sodiumMg: '0', saturatedFatG: '1.4', calciumMg: '0.1', ironMg: '0.1', zincMg: '0' },
    ],
  },
  {
    id: 'demo-recipe-001', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Bowl de avena con fruta', created_at: '', photo_url: null,
    steps: '1. Pon la avena en un bol con el yogur natural.\n2. Añade los arándanos por encima.\n3. Termina con un chorrito de miel.',
    items: [
      { id: 'dr1i1', foodName: 'Avena', quantity: '40', unit: 'g', kcal: '150', proteinG: '5', carbsG: '27', fatG: '3' },
      { id: 'dr1i2', foodName: 'Yogur natural', quantity: '150', unit: 'g', kcal: '90', proteinG: '8', carbsG: '10', fatG: '2' },
      { id: 'dr1i3', foodName: 'Arándanos', quantity: '50', unit: 'g', kcal: '30', proteinG: '0', carbsG: '7', fatG: '0' },
      { id: 'dr1i4', foodName: 'Miel', quantity: '10', unit: 'g', kcal: '30', proteinG: '0', carbsG: '8', fatG: '0' },
    ],
  },
  {
    id: 'demo-recipe-002', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Pollo con arroz y verduras', created_at: '',
    photo_url: placeholderPhoto('Pollo arroz', '#3f6d8f'), steps: null,
    items: [
      { id: 'dr2i1', foodName: 'Pechuga de pollo', quantity: '150', unit: 'g', kcal: '230', proteinG: '45', carbsG: '0', fatG: '5' },
      { id: 'dr2i2', foodName: 'Arroz integral', quantity: '60', unit: 'g', kcal: '210', proteinG: '5', carbsG: '44', fatG: '2' },
      { id: 'dr2i3', foodName: 'Verdura al vapor', quantity: '200', unit: 'g', kcal: '60', proteinG: '3', carbsG: '12', fatG: '0' },
    ],
  },
]

// ── Fotos de progreso ───────────────────────────────────────

export const DEMO_PHOTOS: Record<string, ProgressPhotoSession[]> = {
  'demo-client-001': [],
  'demo-client-002': [{
    id: 'ph-carlos-1', clientId: 'demo-client-002', date: daysAgo(14),
    frontUrl: placeholderPhoto('Frontal', '#3f7d4f'),
    sideUrl: placeholderPhoto('Perfil', '#8fae6c'),
    backUrl: placeholderPhoto('Espalda', '#1a6038'),
    note: 'Semana 8 del plan',
  }],
  'demo-client-003': [],
}

// ── Diario de comidas ───────────────────────────────────────

function mealPlaceholder(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="15" fill="#fff" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

export const DEMO_MEAL_LOGS: Record<string, MealLog[]> = {
  'demo-client-001': [
    { id: 'ml-maria-1', clientId: 'demo-client-001', date: daysAgo(0), mealName: 'Desayuno', note: 'Con arándanos de más, se me fue la mano 😄',
      photoUrl: mealPlaceholder('Desayuno', '#3f7d4f'), createdAt: Date.now() - 3 * 3600000 },
    { id: 'ml-maria-2', clientId: 'demo-client-001', date: daysAgo(1), mealName: 'Comida', note: '',
      photoUrl: mealPlaceholder('Comida', '#8fae6c'), createdAt: Date.now() - 27 * 3600000 },
  ],
  'demo-client-002': [
    { id: 'ml-carlos-1', clientId: 'demo-client-002', date: daysAgo(0), mealName: 'Post-entreno', note: 'Batido + plátano justo al salir del gym',
      photoUrl: mealPlaceholder('Post-entreno', '#1a6038'), createdAt: Date.now() - 5 * 3600000 },
  ],
  'demo-client-003': [],
}

// ── Citas ───────────────────────────────────────────────────

function daysFromNow(n: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, minute, 0, 0)
  return d
}

export const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-demo-1', nutricionistaId: DEMO_NUTRICIONISTA_ID, clientId: 'demo-client-001',
    title: 'Consulta de seguimiento', startAt: daysFromNow(0, 10).toISOString(), endAt: daysFromNow(0, 10, 30).toISOString(),
    status: 'confirmada', notes: '', recurring: null, videoLink: 'https://meet.google.com/demo-consulta',
  },
  {
    id: 'apt-demo-2', nutricionistaId: DEMO_NUTRICIONISTA_ID, clientId: 'demo-client-002',
    title: 'Cita solicitada por Carlos', startAt: daysFromNow(2, 18).toISOString(), endAt: daysFromNow(2, 18, 30).toISOString(),
    status: 'pendiente', notes: '', recurring: null, videoLink: null,
  },
  {
    id: 'apt-demo-3', nutricionistaId: DEMO_NUTRICIONISTA_ID, clientId: 'demo-client-003',
    title: 'Primera consulta', startAt: daysFromNow(-1, 11).toISOString(), endAt: daysFromNow(-1, 11, 45).toISOString(),
    status: 'completada', notes: '', recurring: null, videoLink: null,
  },
]

// ── Cuestionario de salud ───────────────────────────────────

export const DEMO_ANAMNESIS: Record<string, Record<string, string>> = {
  'demo-client-001': {
    motivo: 'Perder peso de forma sostenible antes de la boda de mi hermana en junio.',
    condiciones: 'Ninguna diagnosticada.',
    medicacion: 'Ninguna.',
    actividad: 'Ligera (1-3 días/semana)',
    sueno: '7',
    agua: '1.5',
    dietas_previas: 'Probé keto un par de meses, perdí peso pero lo recuperé al dejarlo.',
    habitos: 'Alguna copa de vino el fin de semana.',
    'demo-q1': 'no', 'demo-q2': '4', 'demo-q3': 'Comida',
  },
  'demo-client-002': {
    motivo: 'Ganar masa muscular de forma limpia, sin pasarme de grasa.',
    actividad: 'Alta (6-7 días/semana)',
    sueno: '8',
    agua: '3',
  },
}

// ── Facturación ─────────────────────────────────────────────

function periodMonthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const DEMO_INVOICES: Record<string, InvoiceRow[]> = {
  'demo-client-001': [
    { id: 'inv-maria-1', nutricionista_id: DEMO_NUTRICIONISTA_ID, client_id: 'demo-client-001', period: periodMonthsAgo(0), amount: 45, status: 'pendiente', created_at: new Date().toISOString() },
    { id: 'inv-maria-2', nutricionista_id: DEMO_NUTRICIONISTA_ID, client_id: 'demo-client-001', period: periodMonthsAgo(1), amount: 45, status: 'pagado', created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  ],
  'demo-client-002': [
    { id: 'inv-carlos-1', nutricionista_id: DEMO_NUTRICIONISTA_ID, client_id: 'demo-client-002', period: periodMonthsAgo(0), amount: 60, status: 'pagado', created_at: new Date().toISOString() },
  ],
  'demo-client-003': [],
}

// ── Encuestas recurrentes ───────────────────────────────────

function weeksAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return d
}

export const DEMO_CUSTOM_SURVEYS: CustomSurveyRow[] = [
  {
    id: 'demo-survey-weekly', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Seguimiento semanal',
    frequency: 'weekly', active: true, created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    questions: [
      { id: 'sw-q1', label: '¿Cómo te has sentido esta semana en general?', type: 'text' },
      { id: 'sw-q2', label: '¿Ha habido algún obstáculo con el plan?', type: 'text' },
      { id: 'sw-q3', label: 'Energía media esta semana', type: 'scale', required: true },
      { id: 'sw-q4', label: '¿Has seguido el plan de comidas esta semana?', type: 'yesno', required: true },
    ],
  },
  {
    id: 'demo-survey-monthly', nutricionista_id: DEMO_NUTRICIONISTA_ID, name: 'Revisión mensual',
    frequency: 'monthly', active: true, created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    questions: [
      { id: 'sm-q1', label: '¿Cómo valoras tu progreso este mes?', type: 'scale', required: true },
      { id: 'sm-q2', label: 'Cuéntanos por qué', type: 'text' },
      { id: 'sm-q3', label: '¿Qué quieres priorizar el próximo mes?', type: 'choice', options: ['Alimentación', 'Entrenamiento', 'Descanso', 'Constancia'] },
    ],
  },
]

export const DEMO_SURVEY_RESPONSES: Record<string, SurveyResponseRow[]> = {
  'demo-client-001': [
    {
      id: 'demo-sr-1', survey_id: 'demo-survey-weekly', client_id: 'demo-client-001',
      period_key: periodKeyFor('weekly', weeksAgo(1)), submitted_at: weeksAgo(1).toISOString(),
      answers: {
        'sw-q1': 'Bien, con más energía que la semana pasada.', 'sw-q2': 'Una cena familiar el sábado, pero por lo demás bien.',
        'sw-q3': '7', 'sw-q4': 'si',
      },
    },
    {
      id: 'demo-sr-2', survey_id: 'demo-survey-weekly', client_id: 'demo-client-001',
      period_key: periodKeyFor('weekly', weeksAgo(2)), submitted_at: weeksAgo(2).toISOString(),
      answers: { 'sw-q1': 'Algo cansada, semana de mucho trabajo.', 'sw-q2': 'Ninguno relevante.', 'sw-q3': '5', 'sw-q4': 'si' },
    },
    {
      id: 'demo-sr-3', survey_id: 'demo-survey-monthly', client_id: 'demo-client-001',
      period_key: periodMonthsAgo(1), submitted_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      answers: { 'sm-q1': '8', 'sm-q2': 'Muy contenta con la bajada de peso.', 'sm-q3': 'Alimentación' },
    },
  ],
  'demo-client-002': [
    {
      id: 'demo-sr-4', survey_id: 'demo-survey-weekly', client_id: 'demo-client-002',
      period_key: periodKeyFor('weekly', weeksAgo(1)), submitted_at: weeksAgo(1).toISOString(),
      answers: { 'sw-q1': 'Muy bien, entrenando fuerte.', 'sw-q2': 'Ninguno.', 'sw-q3': '9', 'sw-q4': 'si' },
    },
  ],
  'demo-client-003': [],
}

// ── Analíticas de sangre ─────────────────────────────────────

export const DEMO_BLOOD_MARKERS: Record<string, BloodMarkerRow[]> = {
  'demo-client-001': [
    { id: 'demo-bm-1', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'glucosa', value: 92, created_at: '' },
    { id: 'demo-bm-2', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'colesterol_total', value: 215, created_at: '' },
    { id: 'demo-bm-3', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'ldl', value: 128, created_at: '' },
    { id: 'demo-bm-4', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'hdl', value: 52, created_at: '' },
    { id: 'demo-bm-5', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'trigliceridos', value: 98, created_at: '' },
    { id: 'demo-bm-6', client_id: 'demo-client-001', date: daysAgo(20), marker_key: 'vitamina_d', value: 18, created_at: '' },
  ],
  'demo-client-002': [
    { id: 'demo-bm-7', client_id: 'demo-client-002', date: daysAgo(35), marker_key: 'got_ast', value: 68, created_at: '' },
    { id: 'demo-bm-8', client_id: 'demo-client-002', date: daysAgo(35), marker_key: 'gpt_alt', value: 74, created_at: '' },
    { id: 'demo-bm-9', client_id: 'demo-client-002', date: daysAgo(35), marker_key: 'glucosa', value: 88, created_at: '' },
  ],
  'demo-client-003': [
    { id: 'demo-bm-10', client_id: 'demo-client-003', date: daysAgo(10), marker_key: 'hierro', value: 48, created_at: '' },
    { id: 'demo-bm-11', client_id: 'demo-client-003', date: daysAgo(10), marker_key: 'vitamina_d', value: 22, created_at: '' },
    { id: 'demo-bm-12', client_id: 'demo-client-003', date: daysAgo(10), marker_key: 'glucosa', value: 85, created_at: '' },
    { id: 'demo-bm-13', client_id: 'demo-client-003', date: daysAgo(10), marker_key: 'colesterol_total', value: 178, created_at: '' },
  ],
}
