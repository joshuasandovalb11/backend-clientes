// api/cliente.js (CÓDIGO FINAL CORREGIDO)
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const buscarEnArchivo = (filePath, clienteId) => {
  return new Promise((resolve, reject) => {
    // Verificamos primero si el archivo existe antes de intentar leerlo
    if (!fs.existsSync(filePath)) {
      console.warn(
        `Advertencia: El archivo ${path.basename(
          filePath
        )} no fue encontrado. Omitiendo.`
      );
      return resolve(null); // Resolvemos con null si el archivo no existe
    }

    let clienteEncontrado = null;
    const stream = fs
      .createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        if (data.CLAVE && data.CLAVE === clienteId) {
          if (data.GPS && data.GPS.includes(",")) {
            const [latitud, longitud] = data.GPS.replace(/"/g, "").split(",");
            clienteEncontrado = {
              id: data.CLAVE,
              nombre: data.RAZON,
              latitud: parseFloat(latitud),
              longitud: parseFloat(longitud),
            };
            stream.destroy();
          }
        }
      })
      .on("close", () => {
        resolve(clienteEncontrado);
      })
      .on("error", (error) => {
        // Este error solo debería ocurrir si hay un problema de lectura, no si no existe
        reject(error);
      });
  });
};

module.exports = async (req, res) => {
  const clienteId = req.query.id;

  if (!clienteId) {
    return res
      .status(400)
      .json({ error: 'El parámetro "id" del cliente es requerido.' });
  }

  // --- CORRECCIÓN IMPORTANTE: Usamos los nuevos nombres de archivo simplificados ---
  const archivos = [
    path.resolve(__dirname, "cabanillas.csv"),
    path.resolve(__dirname, "clientes.csv"),
  ];

  try {
    let cliente = null;
    for (const archivo of archivos) {
      cliente = await buscarEnArchivo(archivo, clienteId);
      if (cliente) {
        break; // Si encontramos al cliente, salimos del bucle
      }
    }

    if (cliente) {
      console.log(`Cliente encontrado: ${cliente.nombre}`);
      return res.status(200).json(cliente);
    } else {
      console.log(
        `Cliente con ID ${clienteId} no fue encontrado en ninguna fuente.`
      );
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
  } catch (error) {
    console.error("Error en el servidor al procesar la búsqueda:", error);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
