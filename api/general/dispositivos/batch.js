export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

const BASE_URL = process.env.SQL_API_URL || "http://toolsdemexico.net:3001/api";

export default async function handler(req, res) {
  // 1. Solo permitimos el método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Validación Estructural Manual (Early Return / Cero Dependencias)
  const body = req.body;
  if (!body || typeof body !== 'object') {
    console.warn(`[Proxy Batch] Rechazado (400): Payload sin objeto JSON.`);
    return res.status(400).json({ message: 'Payload inválido: Se esperaba un objeto JSON' });
  }

  const { deviceId, date, columns, events } = body;

  // Validación de campos requeridos y sus tipos básicos
  if (!deviceId || typeof deviceId !== 'string') {
    console.warn(`[Proxy Batch] Rechazado (400): Falta deviceId válido.`);
    return res.status(400).json({ message: 'Payload inválido: Falta deviceId o no es texto' });
  }

  if (!date || typeof date !== 'string') {
    console.warn(`[Proxy Batch] Rechazado (400) [Dispositivo: ${deviceId}]: Falta date válido.`);
    return res.status(400).json({ message: 'Payload inválido: Falta date o no es texto' });
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    console.warn(`[Proxy Batch] Rechazado (400) [Dispositivo: ${deviceId}]: Columns no es un array válido.`);
    return res.status(400).json({ message: 'Payload inválido: columns debe ser un array no vacío' });
  }

  if (!Array.isArray(events)) {
    console.warn(`[Proxy Batch] Rechazado (400) [Dispositivo: ${deviceId}]: Events no es un array.`);
    return res.status(400).json({ message: 'Payload inválido: events debe ser un array' });
  }

  // Límite de seguridad adicional por si acaso (ej. 5000 puntos máximos por request)
  if (events.length > 5000) {
    console.warn(`[Proxy Batch] Rechazado (400) [Dispositivo: ${deviceId}]: Demasiados eventos (${events.length}).`);
    return res.status(400).json({ message: 'Payload inválido: events excede el límite permitido por request' });
  }

  console.info(`[Proxy Batch] Payload validado para dispositivo [${deviceId}] de fecha [${date}]. Total puntos: ${events.length}. Redirigiendo a PM2...`);

  // 3. Preparación del Proxy hacia PM2 con AbortController
  const targetUrl = `${BASE_URL}/visualizador/rutas/moviles/batch`;
  const controller = new AbortController();
  const timeoutMs = 8500; // 8.5s para cortar antes de los 10s de Vercel

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // 4. Manejo de Respuesta Exitosa o Errores controlados por el PM2
    const contentType = response.headers.get("content-type");
    res.status(response.status);

    if (response.ok) {
      console.info(`[Proxy Batch] Éxito (200) [Dispositivo: ${deviceId}]: Los datos fueron guardados correctamente por PM2.`);
    } else {
      console.warn(`[Proxy Batch] PM2 respondió con error [Dispositivo: ${deviceId}]: Status HTTP ${response.status}`);
    }

    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }

  } catch (error) {
    clearTimeout(timeoutId);

    // 5. Casos de Borde: Fallas de Red y Timeouts
    console.error(`[Proxy Batch] Error de Red/Timeout [Dispositivo: ${deviceId || 'Desconocido'}]:`, error.name, error.message);

    if (error.name === 'AbortError') {
      // El PM2 tardó demasiado en responder, abortamos para proteger Vercel
      console.error(`[Proxy Batch] Abortando por límite de tiempo de Vercel.`);
      return res.status(504).json({ message: 'Gateway Timeout: El servidor interno tardó demasiado' });
    }

    // Cualquier otro error de red (ECONNREFUSED, PM2 apagado)
    console.error(`[Proxy Batch] PM2 parece estar apagado o inaccesible.`);
    return res.status(503).json({ message: 'Service Unavailable: No se pudo contactar al servidor interno' });
  }
}
