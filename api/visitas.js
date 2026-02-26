const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
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

  // ========================================================
  // Manejar petición GET (Consultar historial al abrir app)
  // ========================================================
  if (req.method === "GET") {
    const deviceId = req.query.deviceId;

    if (!deviceId) {
      return res
        .status(400)
        .json({ message: "El parámetro deviceId es requerido." });
    }

    console.log(
      `[Proxy Vercel] Consultando visitas para DeviceID: ${deviceId}`,
    );

    try {
      const response = await fetch(
        `${SQL_API_URL}/visitas/${encodeURIComponent(deviceId)}`,
      );

      if (!response.ok)
        throw new Error(`Error del servidor SQL: ${response.status}`);

      const data = await response.json();

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(data);
    } catch (error) {
      console.error("❌ Error proxy GET visitas:", error);
      return res.status(500).json({ message: "Error interno de conexión." });
    }
  }

  // ========================================================
  // Manejar petición POST (Botón Marcar/Desmarcar)
  // ========================================================
  if (req.method === "POST") {
    console.log(`[Proxy Vercel] Petición para registrar/eliminar visita.`);

    try {
      const response = await fetch(`${SQL_API_URL}/visitas/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      if (!response.ok)
        throw new Error(`Error del servidor SQL: ${response.status}`);

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error("❌ Error proxy POST visitas:", error);
      return res.status(500).json({ message: "Error interno de conexión." });
    }
  }

  return res.status(405).json({ message: "Método no permitido." });
};
