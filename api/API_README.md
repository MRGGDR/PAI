# API (carpeta `api`)

Este documento describe la función serverless ubicada en la carpeta `api` del proyecto PAI.

## Propósito

La carpeta `api` contiene una función CommonJS diseñada para ejecutarse como función serverless (por ejemplo, en Vercel). Su propósito es actuar como proxy central para las peticiones del frontend:

- Acepta peticiones HTTP desde el navegador (añade cabeceras CORS apropiadas).
- Valida y normaliza el cuerpo de la petición.
- Reenvía (proxy) el payload al backend real configurado (por defecto, un Apps Script) y devuelve la respuesta al cliente.

## Archivo principal

- `index.js`: función serverless. Comportamiento clave:
  - Añade cabeceras CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET,POST,OPTIONS`, `Access-Control-Allow-Headers: Content-Type,Authorization`.
  - Responde `OPTIONS` con 204 para preflight CORS.
  - Lee el body: intenta `req.body` (si el runtime lo parseó) o lee el body crudo con `getRawBody`.
  - Valida que el payload sea un objeto y contenga la propiedad `path` (requisito mínimo para enrutar en el Apps Script destino).
  - Determina target: usa `process.env.APPS_SCRIPT_URL` si está configurada; si no, usa `defaultUrl` embebida en el código.
  - Reenvía la petición al target con `fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`.
  - Intenta parsear la respuesta del target como JSON; si falla, devuelve un wrapper JSON con `success`, `status` y `body` (texto bruto).

## Contrato (mini-contrato) - entradas/salidas, errores

- Inputs esperados:
  - Método HTTP: `POST` (se admite `OPTIONS` para CORS preflight).
  - Encabezados: idealmente `Content-Type: application/json`. Puede incluir `Authorization` si se añade validación.
  - Body (JSON) con al menos la propiedad `path` (string). Ejemplo mínimo:

```json
{
  "path": "some/endpoint"
}
```

- Salidas:
  - Si el target devuelve JSON válido: se reenvía ese JSON con el mismo `status` (o 200 por defecto si no se obtiene del target).
  - Si el target devuelve texto no JSON: la función responde con JSON de diagnóstico:

```json
{
  "success": true,
  "status": 200,
  "body": "...texto devuelto por el target..."
}
```

- Errores comunes:
  - 400: cuerpo inválido o falta `path`.
  - 500: error interno, falta de `APPS_SCRIPT_URL` configurada y no hay `defaultUrl`, o excepción durante fetch.

## Uso desde el frontend

- El frontend nunca debe llamar directamente al Apps Script. Todas las peticiones deben pasar por `/api` usando `callBackend(path, payload)` del archivo `src/services/apiService.js`.

## Variables de entorno

- `APPS_SCRIPT_URL`: URL completa del Apps Script (u otro servicio HTTP) que procesa las peticiones. Si no está definida, `index.js` usa un `defaultUrl` embebido. En producción configure `APPS_SCRIPT_URL` en el entorno de despliegue (Vercel, Netlify, etc.).

## Ejemplos de payloads y uso

1) Llamada simple (curl):

```bash
curl -X POST "https://TU-DOMINIO/api" \
  -H "Content-Type: application/json" \
  -d '{"path":"activities/list","payload":{"page":1}}'
```

2) Ejemplo en PowerShell (Invoke-RestMethod):

```powershell
$body = @{ path = 'activities/list'; payload = @{ page = 1 } } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://TU-DOMINIO/api' -Method Post -Body $body -ContentType 'application/json'
```

3) Fetch en el navegador / frontend:

```javascript
const res = await fetch('/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'activities/list', payload: { page: 1 } })
});
const data = await res.json();
// manejar data
```

4) Node (node-fetch o global fetch en Node 18+):

```javascript
import fetch from 'node-fetch'; // si usas node <18

const response = await fetch('https://TU-DOMINIO/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'activities/list', payload: { page: 1 } })
});
const result = await response.json();
```

## Respuestas esperadas y manejo de errores

- Respuesta 200 con JSON: contenido forwarded desde el Apps Script.
- Respuesta 4xx/5xx: la función reenvía el código de estado del target cuando es posible; en errores del propio proxy, devolverá 500 con `{ success: false, error: 'mensaje' }`.

Ejemplo de error del proxy:

```json
{
  "success": false,
  "error": "APPS_SCRIPT_URL not configured in environment"
}
```

## Seguridad y recomendaciones operativas (resumen técnico)

- Autenticación: actualmente la función no obliga un token; si la API va a ser pública, añadir validación (ej. `Authorization` con JWT o token compartido) en `index.js` antes de reenviar.
- Rate limiting: el proxy no aplica límites; si el target es sensible, considere throttling o protección en la capa de despliegue.
- Validación adicional: la función sólo comprueba `path` por ahora. Se recomienda validar la estructura de `payload` según cada `path` si se desea mayor robustez.
- Logging: el archivo hace `console.error` en errores; integre con el sistema de logs del proveedor para diagnósticos (Sentry/Logflare/Stackdriver) si es necesario.

## Pruebas locales y despliegue

- Para desarrollo local con Vercel:

```powershell
npx vercel dev
# o si tiene vercel instalado globalmente
vercel dev
```

- Asegúrese de definir `APPS_SCRIPT_URL` en las variables de entorno locales cuando pruebe para evitar usar el `defaultUrl` dentro del código (que es de ejemplo).

## Estructura de la carpeta `api`

- `index.js`: función principal (ver arriba).
- (otros archivos no presentes por defecto): mantener la carpeta pequeña; si añadimos middlewares o tests, documentar cada archivo aquí.

## Casos límite y consideraciones técnicas

- Payload vacío o no JSON: la función devuelve 400 con mensaje que indique la falta de `path` o body inválido.
- Respuesta del target muy grande: la función la retorna tal cual; si se espera tráfico con payloads muy grandes, revise límites del runtime serverless (tiempo máximo, memoria y tamaño de respuesta).
- Latencia del target: la función `await fetch` bloqueará la respuesta hasta que el target conteste; considere timeouts o fallback si el target puede ser lento.

---

## Créditos

Este documento fue creado por Manolo Rey Garcia.

