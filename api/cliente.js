const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

const SQL_API_URL = process.env.SQL_API_URL || "http://192.168.1.147:3001/api";

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
    const response = await fetch(
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

    if (sucursalesConGPS.length === 0) {
      return res.status(200).json({
        id: infoGeneralCliente.id,
        nombre: infoGeneralCliente.nombre,
        vendedorNombre: infoGeneralCliente.vendedorNombre,
        vendedorTelefono: infoGeneralCliente.vendedorTelefono,
        sinGPS: true,
      });
    }

    if (sucursalesConGPS.length === 1) {
      return res.status(200).json(sucursalesConGPS[0]);
    }

    return res.status(200).json({
      id: infoGeneralCliente.id,
      nombre: infoGeneralCliente.nombre,
      vendedorNombre: infoGeneralCliente.vendedorNombre,
      vendedorTelefono: infoGeneralCliente.vendedorTelefono,
      multipleSucursales: true,
      sucursales: sucursalesConGPS,
    });
  } catch (error) {
    console.error("Error en el proxy:", error);
    return res.status(500).json({ message: "Error interno de conexión." });
  }
};
