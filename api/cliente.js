// api/cliente.js (VERSIÓN MEJORADA Y CORREGIDA)
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// --- FUNCIÓN REUTILIZABLE PARA BUSCAR EN UN ARCHIVO CSV ---
// Esta función devuelve una "Promesa", que nos permite manejar operaciones asíncronas.
const buscarEnArchivo = (filePath, clienteId) => {
  return new Promise((resolve, reject) => {
    let clienteEncontrado = null;
    const stream = fs
      .createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Aseguramos que la columna CLAVE exista y comparamos
        if (data.CLAVE && data.CLAVE === clienteId) {
          // Aseguramos que la columna GPS exista
          if (data.GPS && data.GPS.includes(",")) {
            const [latitud, longitud] = data.GPS.replace(/"/g, "").split(",");
            clienteEncontrado = {
              id: data.CLAVE,
              nombre: data.RAZON,
              latitud: parseFloat(latitud),
              longitud: parseFloat(longitud),
            };
            stream.destroy(); // Detenemos la lectura al encontrarlo
          }
        }
      })
      .on("close", () => {
        // Si se encontró, resolvemos la promesa con los datos. Si no, con null.
        resolve(clienteEncontrado);
      })
      .on("error", (error) => {
        // Si el archivo no existe o hay otro error, rechazamos la promesa.
        console.error(`Error leyendo el archivo ${filePath}:`, error);
        reject(error);
      });
  });
};

// --- FUNCIÓN PRINCIPAL QUE EJECUTA VERCEL ---
module.exports = async (req, res) => {
  const clienteId = req.query.id;

  if (!clienteId) {
    return res
      .status(400)
      .json({ error: 'El parámetro "id" del cliente es requerido.' });
  }

  // Lista de los archivos de clientes que queremos revisar, en orden.
  const archivos = [
    path.resolve(__dirname, "cabanillas.xlsx - CLIENTES.csv"),
    path.resolve(__dirname, "clientes.xlsx - CLIENTES.csv"),
  ];

  try {
    // 1. Intentamos buscar en el primer archivo.
    let cliente = await buscarEnArchivo(archivos[0], clienteId);

    // 2. Si no se encontró en el primero (cliente es null), intentamos en el segundo.
    if (!cliente) {
      console.log(
        `Cliente ${clienteId} no encontrado en el primer archivo, intentando en el segundo...`
      );
      cliente = await buscarEnArchivo(archivos[1], clienteId);
    }

    // 3. Después de buscar en todos los archivos, verificamos si lo encontramos.
    if (cliente) {
      console.log(`Cliente encontrado: ${cliente.nombre}`);
      return res.status(200).json(cliente);
    } else {
      console.log(
        `Cliente con ID ${clienteId} no fue encontrado en ninguna fuente de datos.`
      );
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
  } catch (error) {
    // Si ocurre un error grave (ej. no se pueden leer los archivos), devolvemos un error 500.
    console.error("Error en el servidor al procesar la búsqueda:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
