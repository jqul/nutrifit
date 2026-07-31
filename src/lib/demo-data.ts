import { UserProfile, ClientData, DietPlan, WeightEntry, DailyCheckin, ProgressPhotoSession, FollowedPlan } from '../types'

export const DEMO_NUTRICIONISTA_ID = 'demo-nutri-001'

export const DEMO_NUTRICIONISTA_PROFILE: UserProfile = {
  uid: DEMO_NUTRICIONISTA_ID,
  email: 'demo@nutrifit.app',
  displayName: 'Alex Nutricionista',
  role: 'trainer',
  approved: true,
  createdAt: Date.now(),
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
    monthlyPrice: 45, customMessages: {},
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
    monthlyPrice: 60, customMessages: {},
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
    monthlyPrice: 40, customMessages: {},
    createdAt: Date.now() - 45 * 86400000,
  },
]

// ── Planes de dieta ─────────────────────────────────────────

export const DEMO_DIET_PLANS: Record<string, DietPlan> = {
  'demo-client-001': {
    id: 'demo-plan-maria', clientId: 'demo-client-001', nutricionistaId: DEMO_NUTRICIONISTA_ID,
    name: 'Plan de dieta', kcalTarget: 1600, proteinG: 130, carbsG: 150, fatG: 45,
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
    name: 'Plan de dieta', kcalTarget: 2800, proteinG: 180, carbsG: 320, fatG: 80,
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
    name: 'Plan de dieta', kcalTarget: 1900, proteinG: 100, carbsG: 200, fatG: 60,
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
  // María: constante, buena racha, adherencia alta.
  'demo-client-001': buildCheckins('demo-client-001',
    ['si', 'si', 'si', 'parcial', 'si', 'si', 'si', 'si', 'parcial', 'si', 'si', 'si'], 11),
  // Carlos: adherencia media, algún día suelto.
  'demo-client-002': buildCheckins('demo-client-002',
    ['si', 'parcial', 'si', 'no', 'si', 'parcial', 'si', 'si', 'no', 'parcial', 'si', 'si', 'si', 'parcial'], 13),
  // Laura: sin check-ins recientes — cliente en riesgo.
  'demo-client-003': buildCheckins('demo-client-003', ['parcial', 'no', 'si'], 10),
}

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
