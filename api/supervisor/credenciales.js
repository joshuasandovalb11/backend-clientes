const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
});

const SQL_API_URL = process.env.SQL_API_URL || "http://localhost:3001/api";

module.exports = async (req, res) => {
  await new Promise((resolve, reject) => {
    corsHandler(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve();
    });
  });

  const tipo = req.query.tipo;

  if (!tipo) {
    return res
      .status(400)
      .json({ message: 'El parámetro "tipo" es requerido.' });
  }

  console.log(`[Proxy Vercel] Solicitando credencial: ${tipo}`);

  try {
    const response = await fetch(
      `${SQL_API_URL}/supervisor/credenciales/${encodeURIComponent(tipo)}`,
    );

    if (!response.ok) {
      throw new Error(`Error del servidor SQL: ${response.status}`);
    }

    const data = await response.json();

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=15");
    return res.status(200).json(data);
  } catch (error) {
    console.error("❌ Error en el proxy de credenciales:", error);
    return res.status(500).json({ message: "Error interno de conexión." });
  }
};
