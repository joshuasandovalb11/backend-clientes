const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

const SQL_API_URL = process.env.SQL_API_URL || "http://localhost:3001/api";

/**
 * Función auxiliar para reintentar peticiones en caso de fallos de red.
 * Si falla la conexión, espera unos milisegundos y prueba de nuevo.
 */
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (response.status >= 500) {
      throw new Error(`Server Error: ${response.status}`);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(
        `[Proxy] Intento fallido (${err.name}: ${err.message}). Reintentando en ${backoff}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

module.exports = async (req, res) => {
  await new Promise((resolve, reject) => {
    corsHandler(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve();
    });
  });

  const clienteId = req.query.id;

  if (!clienteId) {
    return res.status(400).json({ message: 'El parámetro "id" es requerido.' });
  }

  console.log(`[Proxy Vercel] Búsqueda ID: #${clienteId} -> SQL Server`);

  try {
    const response = await fetchWithRetry(
      `${SQL_API_URL}/clientes/app-search?id=${clienteId}`
    );

    if (!response.ok) {
      throw new Error(`Error del servidor SQL: ${response.status}`);
    }

    const todasLasSucursales = await response.json();

    if (todasLasSucursales.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const infoGeneralCliente = todasLasSucursales[0];

    const sucursalesConGPS = todasLasSucursales.filter(
      (s) =>
        s.latitud !== null &&
        s.longitud !== null &&
        s.latitud !== 0 &&
        s.longitud !== 0
    );

    // CASO 1: Sin GPS -> Devolver contacto del vendedor
    if (sucursalesConGPS.length === 0) {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return res.status(200).json({
        id: infoGeneralCliente.id,
        nombre: infoGeneralCliente.nombre,
        vendedorNombre: infoGeneralCliente.vendedorNombre,
        vendedorTelefono: infoGeneralCliente.vendedorTelefono,
        sinGPS: true,
      });
    }

    // CASO 2: Una sucursal con GPS
    if (sucursalesConGPS.length === 1) {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
      return res.status(200).json(sucursalesConGPS[0]);
    }

    // CASO 3: Múltiples sucursales
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json({
      id: infoGeneralCliente.id,
      nombre: infoGeneralCliente.nombre,
      vendedorNombre: infoGeneralCliente.vendedorNombre,
      vendedorTelefono: infoGeneralCliente.vendedorTelefono,
      multipleSucursales: true,
      sucursales: sucursalesConGPS,
    });
  } catch (error) {
    console.error("❌ Error CRÍTICO en el proxy:", error);

    if (
      error.code === "ECONNREFUSED" ||
      error.message.includes("ECONNREFUSED")
    ) {
      return res.status(503).json({
        message:
          "El servidor de la empresa está ocupado. Por favor intenta de nuevo en unos segundos.",
      });
    }

    return res.status(500).json({ message: "Error interno de conexión." });
  }
};
