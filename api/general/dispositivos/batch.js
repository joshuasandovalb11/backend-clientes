const URL_BACKEND = process.env.URL_BACKEND || "http://localhost:3001";

module.exports = async (req, res) => {
  try {
    const targetUrl = `${URL_BACKEND}/api/visualizador/rutas/moviles/batch`;

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
