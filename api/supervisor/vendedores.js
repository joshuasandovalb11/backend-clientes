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

  console.log(`[Proxy Vercel] Petición para obtener lista de vendedores`);

  try {
    const response = await fetch(`${SQL_API_URL}/supervisor/vendedores`);

    if (!response.ok) {
      throw new Error(`Error del servidor SQL: ${response.status}`);
    }

    const vendedores = await response.json();

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=120");
    return res.status(200).json(vendedores);
  } catch (error) {
    console.error("❌ Error en el proxy de vendedores:", error);
    return res.status(500).json({ message: "Error interno de conexión." });
  }
};
