const cors = require("cors");

const corsHandler = cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
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

  // ========================================================
  // Manejar GET (Consultar visitas normales o el historial)
  // ========================================================
  if (req.method === "GET") {
    const deviceId = req.query.deviceId;
    const historial = req.query.historial;

    if (!deviceId)
      return res
        .status(400)
        .json({ message: "El parámetro deviceId es requerido." });

    try {
      let url = `${SQL_API_URL}/supervisor/visitas/${encodeURIComponent(deviceId)}`;

      if (historial === "true") {
        url = `${SQL_API_URL}/supervisor/visitas/historial/${encodeURIComponent(deviceId)}`;
      }

      const response = await fetch(url);
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
  // Manejar POST (Botón Marcar/Desmarcar en la tarjeta)
  // ========================================================
  if (req.method === "POST") {
    try {
      const response = await fetch(`${SQL_API_URL}/supervisor/visitas/toggle`, {
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

  // ========================================================
  // Manejar DELETE (Resetear todas las visitas de un dispositivo)
  // ========================================================
  if (req.method === "DELETE") {
    const deviceId = req.query.deviceId;
    if (!deviceId)
      return res
        .status(400)
        .json({ message: "El parámetro deviceId es requerido." });

    try {
      const response = await fetch(
        `${SQL_API_URL}/supervisor/visitas/reset/${encodeURIComponent(deviceId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok)
        throw new Error(`Error del servidor SQL: ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error("❌ Error proxy DELETE visitas:", error);
      return res.status(500).json({ message: "Error interno de conexión." });
    }
  }

  return res.status(405).json({ message: "Método no permitido." });
};
