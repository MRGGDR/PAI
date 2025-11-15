export const DESCRIPCION_OPCIONES = {
  verbos: [
    { value: 'Formular', label: 'Formular' },
    { value: 'Entregar', label: 'Entregar' },
    { value: 'Realizar', label: 'Realizar' },
    { value: 'Generar', label: 'Generar' },
    { value: 'Producir', label: 'Producir' },
    { value: 'Elaborar', label: 'Elaborar' },
    { value: 'Publicar', label: 'Publicar' },
    { value: 'Implementar', label: 'Implementar' },
    { value: 'Construir', label: 'Construir' }
  ],
  objetos: [
    { value: 'planes institucionales de gestión del riesgo', label: 'Planes institucionales de gestión del riesgo' },
    { value: 'manuales operativos', label: 'Manuales operativos' },
    { value: 'sistemas de información georreferenciados', label: 'Sistemas de información georreferenciados' },
    { value: 'eventos de capacitación', label: 'Eventos de capacitación' },
    { value: 'obras de mitigación', label: 'Obras de mitigación' },
    { value: 'procesos de planificación', label: 'Procesos de planificación' },
    { value: 'estudios técnicos especializados', label: 'Estudios técnicos especializados' },
    { value: 'estrategias sectoriales', label: 'Estrategias sectoriales' },
    { value: 'programas comunitarios', label: 'Programas comunitarios' },
    { value: 'simulacros comunitarios de evacuación', label: 'Simulacros comunitarios de evacuación' },
    { value: 'campañas de sensibilización', label: 'Campañas de sensibilización' },
    { value: 'protocolos de respuesta', label: 'Protocolos de respuesta' },
    { value: 'equipos multipropósito', label: 'Equipos multipropósito' },
    { value: 'capacitaciones a funcionarios y líderes comunitarios', label: 'Capacitaciones a funcionarios y líderes comunitarios' }
  ],
  finalidades: [
    { value: 'para fortalecer la preparación ante emergencias', label: 'Para fortalecer la preparación ante emergencias' },
    { value: 'para promover la articulación interinstitucional', label: 'Para promover la articulación interinstitucional' },
    { value: 'para disminuir la vulnerabilidad de las comunidades', label: 'Para disminuir la vulnerabilidad de las comunidades' },
    { value: 'para atender oportunamente eventos de riesgo', label: 'Para atender oportunamente eventos de riesgo' },
    { value: 'con el objetivo de mejorar la capacidad de respuesta', label: 'Con el objetivo de mejorar la capacidad de respuesta' },
    { value: 'con el fin de garantizar la continuidad operativa', label: 'Con el fin de garantizar la continuidad operativa' },
    { value: 'orientado a prevenir desastres asociados a fenómenos naturales', label: 'Orientado a prevenir desastres asociados a fenómenos naturales' },
    { value: 'para apoyar la toma de decisiones basada en evidencia', label: 'Para apoyar la toma de decisiones basada en evidencia' }
  ],
  beneficiarios: [
    { value: 'en todo el territorio nacional', label: 'En todo el territorio nacional' },
    { value: 'en municipios priorizados', label: 'En municipios priorizados' },
    { value: 'en comunidades rurales', label: 'En comunidades rurales' },
    { value: 'en zonas de alta amenaza', label: 'En zonas de alta amenaza' },
    { value: 'en la región amazónica y andina', label: 'En la región amazónica y andina' },
    { value: 'a población en condiciones de vulnerabilidad', label: 'A población en condiciones de vulnerabilidad' },
    { value: 'a los Consejos Departamentales de Gestión del Riesgo', label: 'A los Consejos Departamentales de Gestión del Riesgo' },
    { value: 'a entidades del SNGRD', label: 'A entidades del SNGRD' }
  ],
  temporalidades: [
    { value: 'durante el primer semestre del año', label: 'Durante el primer semestre del año' },
    { value: 'durante el segundo semestre del año', label: 'Durante el segundo semestre del año' },
    { value: 'durante la vigencia presupuestal', label: 'Durante la vigencia presupuestal' },
    { value: 'durante la temporada de lluvias', label: 'Durante la temporada de lluvias' },
    { value: 'en el marco de la temporada de huracanes', label: 'En el marco de la temporada de huracanes' },
    { value: 'antes del segundo trimestre', label: 'Antes del segundo trimestre' },
    { value: 'durante el primer trimestre', label: 'Durante el primer trimestre' },
    { value: 'en el año fiscal en curso', label: 'En el año fiscal en curso' }
  ]
};

export const SUGERENCIAS_TILDES = {
  accion: 'acción',
  coordinacion: 'coordinación',
  evaluacion: 'evaluación',
  evacuacion: 'evacuación',
  formulacion: 'formulación',
  gestion: 'gestión',
  implementacion: 'implementación',
  integracion: 'integración',
  planificacion: 'planificación',
  planeacion: 'planeación',
  poblacion: 'población',
  preparacion: 'preparación',
  prevencion: 'prevención',
  proyeccion: 'proyección',
  sensibilizacion: 'sensibilización',
  sistematizacion: 'sistematización',
  tecnicos: 'técnicos',
  publicos: 'públicos',
  intervencion: 'intervención',
  informacion: 'información'
};

export const MENSAJE_GENERADOR_DEFAULT = 'Selecciona las opciones para generar una descripción estandarizada.';

export const BIMESTRES_CONFIG = [
  { index: 1, label: 'Enero-Febrero', periodo: 'Enero - Febrero', shortLabel: 'Bimestre 1', value: 'Enero-Febrero' },
  { index: 2, label: 'Marzo-Abril', periodo: 'Marzo - Abril', shortLabel: 'Bimestre 2', value: 'Marzo-Abril' },
  { index: 3, label: 'Mayo-Junio', periodo: 'Mayo - Junio', shortLabel: 'Bimestre 3', value: 'Mayo-Junio' },
  { index: 4, label: 'Julio-Agosto', periodo: 'Julio - Agosto', shortLabel: 'Bimestre 4', value: 'Julio-Agosto' },
  { index: 5, label: 'Septiembre-Octubre', periodo: 'Septiembre - Octubre', shortLabel: 'Bimestre 5', value: 'Septiembre-Octubre' },
  { index: 6, label: 'Noviembre-Diciembre', periodo: 'Noviembre - Diciembre', shortLabel: 'Bimestre 6', value: 'Noviembre-Diciembre' }
];

export const DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

export const DATE_MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

export const DATE_WEEKDAY_LABELS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

export const RIESGO_SEMAFORO_CONFIG = [
  {
    id: 'bajo',
    label: 'Bajo',
    min: 0,
    max: 25,
    defaultPercent: 10,
    description: 'Impacto bajo o controlado'
  },
  {
    id: 'moderado',
    label: 'Moderado',
    min: 26,
    max: 50,
    defaultPercent: 35,
    description: 'Requiere seguimiento periódico'
  },
  {
    id: 'alto',
    label: 'Alto',
    min: 51,
    max: 75,
    defaultPercent: 65,
    description: 'Riesgo significativo, plan de mitigación activo'
  },
  {
    id: 'critico',
    label: 'Crítico',
    min: 76,
    max: 100,
    defaultPercent: 90,
    description: 'Nivel crítico, acciones inmediatas'
  }
];
