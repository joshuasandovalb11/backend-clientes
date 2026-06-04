const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

const BASE_URL = process.env.SQL_API_URL || "http://toolsdemexico.net:3001/api";
const SQL_API_URL = BASE_URL;

module.exports = async (req, res) => {
  await new Promise((resolve, reject) => {
    corsHandler(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve();
    });
  });

  const vend = req.query.vend;

  if (!vend) {
    return res
      .status(400)
      .json({ message: 'El parámetro "vend" es requerido.' });
  }

  console.log(`[Proxy Vercel] Búsqueda de clientes para el vendedor: ${vend}`);

  try {
    const response = await fetch(
      `${SQL_API_URL}/supervisor/clientes/vendedor/${encodeURIComponent(vend)}`,
    );

    if (!response.ok) {
      throw new Error(`Error del servidor SQL: ${response.status}`);
    }

    const clientes = await response.json();

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(clientes);
  } catch (error) {
    console.error("❌ Error en el proxy de clientes-vendedor:", error);
    return res.status(500).json({ message: "Error interno de conexión." });
  }
};
