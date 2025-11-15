# Public (carpeta `public`)

Este documento describe los archivos estáticos incluidos en la carpeta `public` del proyecto: la demo HTML, los estilos CSS, el script de validación ortográfica, la librería Typo.js y los diccionarios Hunspell usados (AFF/DIC). Contiene una explicación detallada de cada archivo y ejemplos de uso y configuración.

## Estructura relevante

- `index.html` - Página de demostración del validador ortográfico.
- `css/styles.css` - Estilos usados por la demo (componentes, paneles y menú de sugerencias).
- `js/orthography.js` - Módulo principal que expone `createOrthographyChecker` y la clase `OrthographyChecker`. Se inicializa automáticamente para elementos con atributos data-orthography.
- `vendor/typo.min.js` - Biblioteca Typo.js (Hunspell) minificada; se carga dinámicamente por `orthography.js`.
- `dict/es_ES.aff`, `dict/es_ES.dic` - Archivos de diccionario Hunspell (reglas AFF y lista de palabras DIC) para Spanish (es_ES).

---

## `index.html` - Demo y configuración por atributos

Propósito:
- Página de ejemplo que muestra el editor contenteditable enlazado al validador ortográfico.

Estructura y elementos clave:
- `<div id="demo-editor" data-orthography-editor ... contenteditable="true">` - elemento editable que el módulo detecta y transforma.
- Atributos data usados por `orthography.js`:
  - `data-field-name` - nombre del campo oculto que sincroniza el valor del editor para envío en formularios.
  - `data-orthography-editor` - marca al elemento como editor que debe ser inicializado.
  - `data-orthography-panel` - selector del contenedor (panel) que muestra contadores y primer resultado.
  - `data-orthography-button` - selector del botón que dispara verificación manual (si se provee, la inicialización se retrasa hasta el primer clic).
  - `data-orthography-counter` - selector de elemento donde se muestra el conteo de errores.
  - `data-orthography-first` - selector de elemento donde se muestra la primera sugerencia.
  - `data-orthography-custom` - lista de palabras permitidas adicionales (CSV simple o JSON con arreglo de strings).
  - `data-orthography-custom-global` - si está presente, las palabras personalizadas se registran globalmente.

Comportamiento de la demo:
- Si se especifica `data-orthography-button`, la inicialización del diccionario se retrasa hasta que el usuario haga clic en el botón (evita cargar el diccionario automáticamente).
- Si no existe botón, la inicialización es inmediata y el validador puede ejecutar comprobaciones en tiempo real.

Ejemplo rápido (manual):

1. Abrir `public/index.html` en un navegador moderno (recomendado Chrome/Edge/Firefox que soporten módulos ES).
2. Escribir texto en el editor. El botón "Verificar ahora" carga el diccionario y ejecuta la comprobación.

---

## `css/styles.css` - Estilos y clases importantes

Variables y paleta:
- Variables CSS en `:root` para colores y tipografía (fácil personalización): `--color-bg`, `--color-panel`, `--color-accent`, `--color-error`, etc.

Clases y selectores relevantes:
- `.demo-card` - contenedor principal de la demo.
- `#demo-editor` - estilos del área editable (padding, borde, focus states).
- `.orthography-error` - clase que se aplica a palabras detectadas como erróneas; visualmente usa subrayado ondulado (`text-decoration-style: wavy`) y color de error.
- `.orthography-suggestions-menu` - menú contextual posicionado absolutmente para mostrar sugerencias y la acción "Ignorar".

Comportamiento visual:
- El editor mantiene el texto en su forma original, pero internamente `orthography.js` reemplaza el contenido por nodos de texto y `span.orthography-error` para las palabras con error; al reemplazar, el estilo y la selección se conservan mediante mecanismos de offset.

---

## `js/orthography.js` - Módulo principal (explicación técnica)

Resumen:
- Implementa un validador ortográfico cliente usando Typo.js + diccionarios Hunspell. Exporta la función asíncrona `createOrthographyChecker(options)` y la clase `OrthographyChecker`.
- Detecta automáticamente elementos marcados con `data-orthography-editor` en `DOMContentLoaded`.

API pública (exportada):
- `createOrthographyChecker(options)` - crea y retorna una instancia lista (await checker.ready). Opciones relevantes:
  - `editor` (Elemento o selector) - elemento contenteditable o textarea/input a sincronizar.
  - `panel` (Elemento o selector) - contenedor con panel de estado (opcional).
  - `button` (Elemento o selector) - botón que dispara la verificación (opcional; si existe, la inicialización espera al primer clic).
  - `hiddenInput` (Elemento o selector) - textarea/hidden input donde se sincroniza el texto para envío en formularios.
  - `counterElement` (Elemento o selector) - elemento que mostrará el número de errores.
  - `firstSuggestionElement` (Elemento o selector) - elemento que mostrará la primera sugerencia.
  - `autoCheck` (boolean) - si `true`, ejecuta comprobaciones automáticamente durante la edición (por defecto `true` cuando no hay `button`).
  - `maxSuggestions` (number) - máximo de sugerencias por palabra.
  - `customWords` (string[]) - lista de términos adicionales que deben considerarse correctos para la instancia.
  - `registerCustomWordsGlobally` (boolean) - si se usa junto con `customWords`, añade esos términos al registro global compartido.

Principales métodos de la instancia `OrthographyChecker`:
- `runSpellcheck({ force = false })` - ejecuta la comprobación y actualiza el DOM del editor con `span.orthography-error` y sugerencias.
- `setText(text)` - reemplaza el contenido del editor y sincroniza el hidden input.
- `getPlainText()` - obtiene el texto plano actual del editor.
- `destroy()` - desmonta eventos y remueve menús.
- `addCustomWords(words, { registerGlobally })` - incorpora nuevas palabras permitidas en la instancia; opcionalmente las registra de forma global.

Funciones utilitarias exportadas:
- `registerCustomWords(words)` - registra palabras en el listado global permitido (afecta a todas las instancias futuras y existentes).
- `getCustomWords()` - devuelve un arreglo con los términos actualmente registrados a nivel global.

Detalles internos importantes:
- Carga dinámica de Typo.js: `loadTypoScript()` crea un elemento `<script>` apuntando a `vendor/typo.min.js`.
- Carga asíncrona de diccionario: `loadDictionary()` hace fetch de `dict/es_ES.aff` y `dict/es_ES.dic` y crea la instancia Typo.
- Tokenización: usa una expresión regular Unicode para separar palabras y texto; conserva puntuación y espacios como nodos `text` para mantener formato original.
- Normalización: `normalizeWord()` limpia caracteres no letra/acentos y normaliza apóstrofes; `isLikelyWord()` descarta tokens cortos o no palabras.
- Sugerencias: usa `typo.suggest(word, max)` para obtener opciones; respeta mayúsculas del token original.
- Menu contextual: al hacer clic sobre una palabra marcada, `showMenu` posiciona un menú con opciones de reemplazo y "Ignorar".

Ejemplo de uso programático (módulo ES en página):

```javascript
import { createOrthographyChecker } from './js/orthography.js';

const editor = document.querySelector('#demo-editor');
const btn = document.querySelector('#spellcheck-now');

btn.addEventListener('click', async () => {
  // Crear/inicializar checker bajo demanda (no inicializa hasta este click cuando se configura así)
  const checker = await createOrthographyChecker({ editor, button: btn, autoCheck: false });
  // Forzar verificación
  await checker.runSpellcheck({ force: true });
  console.log('Errores detectados:', checker.errors);
});
```

Notas de integración:
- `orthography.js` exporta la clase `OrthographyChecker` que puedes instanciar directamente si prefieres controlar el lifecycle. Usar `createOrthographyChecker` es más sencillo porque espera a que el diccionario esté cargado.
- La instancia expone `addCustomWords` para añadir nuevas palabras en tiempo de ejecución (con opción de registrarlas globalmente).

### Palabras personalizadas y acentos comunes

- El módulo inicializa un pequeño listado de palabras técnicas usadas en PAI (ej. "planeación", "serialización", "sensibilización") para evitar falsos positivos, especialmente con tildes propias del español latinoamericano.
- Puedes añadir más términos antes de cargar el script creando `window.__ORTHOGRAPHY_CUSTOM_WORDS = ['mi término', 'Planeación estratégica']` o, una vez cargado, usando `window.Orthography.addCustomWords(['mi término'])`.
- Desde módulos ES es posible importar `registerCustomWords`/`getCustomWords` para gestionar el listado desde tu código (`import { registerCustomWords } from '../public/js/orthography.js';`).
- Los atributos `data-orthography-custom` y `data-orthography-custom-global` permiten configurar palabras aceptadas directamente en el HTML.
- Las sugerencias se enriquecen con las palabras personalizadas, de modo que al escribir "planeacion" se ofrecerá "planeación" como primera opción.

---

## `vendor/typo.min.js` - Typo.js

Descripción:
- Typo.js es una implementación JavaScript de Hunspell que permite cargar archivos `.aff` y `.dic` y ofrecer funciones como `check(word)` y `suggest(word)`.

Uso dentro del proyecto:
- `orthography.js` carga `typo.min.js` dinámicamente y crea una instancia Typo con `new Typo('es_ES', affData, dicData, { platform: 'any' })`.
- Una vez instanciado, la API usada principalmente es:
  - `typo.check(word)` - boolean (palabra válida o no).
  - `typo.suggest(word, max)` - array de sugerencias.

---

## `dict/es_ES.aff` y `dict/es_ES.dic` - diccionarios Hunspell

Descripción:
- `es_ES.aff` contiene reglas y flags (morfología, sufijos, prefijos, compuestos) usadas por Hunspell.
- `es_ES.dic` contiene las palabras y códigos que, combinadas con `aff`, determinan la validez y generan sugerencias.

Recomendaciones técnicas de uso (referencia dentro del README):
- Ambos archivos se cargan por `orthography.js` con `fetch`. Para funcionar correctamente al abrir localmente debe usarse un servidor HTTP (los navegadores restringen fetch de archivos `file://`).

Ejemplo rápido para servir la carpeta `public` localmente (PowerShell):

```powershell
# Usando Python 3 (disponible en muchas máquinas):
python -m http.server 8000
# Luego abrir en el navegador:
# http://localhost:8000/index.html
```

---

## Consideraciones y casos límite (técnicos)

- Carga de diccionario: la primera carga descarga dos archivos de texto potencialmente grandes; recomendar controlar esta carga bajo demanda (ej. botón) si se quiere ahorrar ancho de banda y memoria.
- Compatibilidad: `orthography.js` emplea módulos ES (type="module" en `index.html`) y APIs modernas (Unicode regex, fetch, import.meta.url). Navegadores muy antiguos pueden no soportarlo.
- Selección y caret: el módulo preserva la posición del cursor mediante cálculo de offsets en caracteres; puede haber ligeros desfases si el DOM del editor tiene nodos complejos.
- Idioma: el proyecto incluye `es_ES` - para otros dialectos habría que añadir sus archivos AFF/DIC y puntualmente adaptar la inicialización.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.

