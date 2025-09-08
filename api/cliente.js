// api/cliente.js
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Esta es la función principal que Vercel ejecutará
module.exports = (req, res) => {
  // 1. Obtenemos el número de cliente de la URL (ej: /api/cliente?id=6062)
  const clienteId = req.query.id;

  if (!clienteId) {
    return res
      .status(400)
      .json({ error: 'El parámetro "id" del cliente es requerido.' });
  }

  const resultados = [];
  let clienteEncontrado = null;

  // 2. Definimos la ruta al archivo CSV.
  // path.resolve se asegura de que la ruta sea correcta en el entorno de Vercel.
  const csvPath = path.resolve(
    __dirname,
    "GPS Cabanillas.xlsx - CLIENTES.xlsx"
  );

  // 3. Leemos el archivo CSV línea por línea (streaming) para ser eficientes.
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on("data", (data) => {
      // Por cada fila del CSV, verificamos si la 'CLAVE' coincide
      if (data.CLAVE === clienteId) {
        // ¡Lo encontramos! Guardamos los datos y paramos la lectura.
        const [latitud, longitud] = data.GPS.replace(/"/g, "").split(",");

        clienteEncontrado = {
          id: data.CLAVE,
          nombre: data.RAZON,
          latitud: parseFloat(latitud),
          longitud: parseFloat(longitud),
        };

        // Destruimos el stream para no seguir leyendo el archivo innecesariamente
        this.destroy();
      }
    })
    .on("end", () => {
      // 4. Cuando la lectura termina, respondemos al cliente.
      if (clienteEncontrado) {
        // Si lo encontramos, enviamos sus datos con un código 200 (OK)
        console.log(`Cliente encontrado: ${clienteEncontrado.nombre}`);
        res.status(200).json(clienteEncontrado);
      } else {
        // Si no, enviamos un error 404 (Not Found)
        console.log(`Cliente con ID ${clienteId} no fue encontrado.`);
        res.status(404).json({ message: "Cliente no encontrado" });
      }
    })
    .on("error", (error) => {
      // 5. Si hay un error leyendo el archivo.
      console.error("Error al procesar el archivo CSV:", error);
      res
        .status(500)
        .json({ error: "Error interno del servidor al leer los datos." });
    });
};
