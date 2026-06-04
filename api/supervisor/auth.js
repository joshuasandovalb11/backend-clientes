export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const BASE_URL = process.env.SQL_API_URL || "http://toolsdemexico.net:3001/api";
  const SQL_API_URL = BASE_URL;
  const path = req.url.split("/api/auth")[1] || "";
  const targetUrl = `${SQL_API_URL}/supervisor/auth${path}`;

  try {
    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (["POST", "PUT", "DELETE"].includes(req.method)) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error en el puente de Auth:", error.message);
    return res
      .status(500)
      .json({ error: "No se pudo conectar con el servidor local" });
  }
}
