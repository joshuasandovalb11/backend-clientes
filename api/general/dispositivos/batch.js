const BASE_URL = process.env.SQL_API_URL || "http://toolsdemexico.net:3001/api";

module.exports = async (req, res) => {
  try {
    const targetUrl = `${BASE_URL}/visualizador/rutas/moviles/batch`;

    console.log(`[Proxy Batch] Redirigiendo petición a: ${targetUrl}`);

    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization && { authorization: req.headers.authorization })
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      options.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const contentType = response.headers.get("content-type");

    res.status(response.status);

    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    console.error("[Proxy Batch] Error:", error);
    res.status(500).json({ message: "Error en el proxy de Vercel" });
  }
};
