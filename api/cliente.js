// api/cliente.js (VERSIÓN FINAL Y FLEXIBLE)
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const buscarEnArchivo = (filePath, clienteId) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(
        `Advertencia: El archivo ${path.basename(
          filePath
        )} no fue encontrado. Omitiendo.`
      );
      return resolve(null);
    }

    let clienteEncontrado = null;
    const stream = fs
      .createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Primero, nos aseguramos de que la fila tenga una CLAVE y coincida
        if (data.CLAVE && data.CLAVE === clienteId) {
          let latitud = null;
          let longitud = null;

          // --- LÓGICA INTELIGENTE PARA LEER GPS ---
          // Verificamos si la columna GPS existe y tiene texto
          if (data.GPS && typeof data.GPS === "string" && data.GPS.length > 5) {
            // Limpiamos la cadena de caracteres (quitamos comillas dobles)
            const gpsString = data.GPS.replace(/"/g, "");

            // Caso 1: ¿Las coordenadas están separadas por coma?
            if (gpsString.includes(",")) {
              [latitud, longitud] = gpsString.split(",");
            }
            // Caso 2: ¿Están separadas por ampersand (&)?
            else if (gpsString.includes("&")) {
              [latitud, longitud] = gpsString.split("&");
            }
          }

          // Si logramos extraer la latitud y longitud, construimos el objeto del cliente
          if (latitud && longitud) {
            clienteEncontrado = {
              id: data.CLAVE,
              nombre: data.RAZON,
              latitud: parseFloat(latitud),
              longitud: parseFloat(longitud),
            };
            // Detenemos la lectura del archivo porque ya encontramos lo que buscábamos
            stream.destroy();
          }
        }
      })
      .on("close", () => {
        resolve(clienteEncontrado);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

// --- FUNCIÓN PRINCIPAL (SIN CAMBIOS) ---
module.exports = async (req, res) => {
  const clienteId = req.query.id;

  if (!clienteId) {
    return res
      .status(400)
      .json({ error: 'El parámetro "id" del cliente es requerido.' });
  }

  const archivos = [
    path.resolve(__dirname, "cabanillas.csv"),
    path.resolve(__dirname, "clientes.csv"),
  ];

  try {
    let cliente = null;
    for (const archivo of archivos) {
      cliente = await buscarEnArchivo(archivo, clienteId);
      if (cliente) {
        break;
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
