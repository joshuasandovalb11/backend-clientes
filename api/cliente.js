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
      return resolve([]);
    }

    const sucursalesEncontradas = [];
    const stream = fs
      .createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Verificamos si el campo del cliente coincide (puede ser CLAVE o #Cliente)
        const claveCliente = data.CLAVE || data["#Cliente"];

        if (claveCliente && claveCliente.trim() === clienteId.trim()) {
          let latitud = null;
          let longitud = null;

          // Verificamos si la columna GPS existe y tiene texto
          if (data.GPS && typeof data.GPS === "string" && data.GPS.length > 5) {
            // Limpiamos la cadena de caracteres (quitamos comillas dobles)
            const gpsString = data.GPS.replace(/"/g, "").trim();

            // Caso 1: ¿Las coordenadas están separadas por coma?
            if (gpsString.includes(",")) {
              [latitud, longitud] = gpsString.split(",");
            }
            // Caso 2: ¿Están separadas por ampersand (&)?
            else if (gpsString.includes("&")) {
              [latitud, longitud] = gpsString.split("&");
            }
          }

          // Obtenemos el nombre del cliente (puede ser RAZON o "Nombre del Cliente")
          const nombreCliente =
            data.RAZON || data["Nombre del Cliente"] || "Cliente sin nombre";

          // Obtenemos información de la sucursal
          const numeroSucursal = data["#Suc"] || "0";
          const nombreSucursal = data.Sucursal || "";

          // Si tiene GPS válido, agregamos la sucursal
          if (latitud && longitud) {
            sucursalesEncontradas.push({
              id: claveCliente.trim(),
              nombre: nombreCliente.trim(),
              latitud: parseFloat(latitud),
              longitud: parseFloat(longitud),
              numeroSucursal: numeroSucursal.trim(),
              nombreSucursal: nombreSucursal.trim(),
            });
          }
          // Si no tiene GPS pero es una sucursal válida (con nombre), la agregamos sin coordenadas
          else if (nombreSucursal && nombreSucursal.trim() !== "") {
            sucursalesEncontradas.push({
              id: claveCliente.trim(),
              nombre: nombreCliente.trim(),
              latitud: null,
              longitud: null,
              numeroSucursal: numeroSucursal.trim(),
              nombreSucursal: nombreSucursal.trim(),
              sinGPS: true,
            });
          }
          // Si no tiene sucursal (numeroSucursal = 0) pero tiene GPS, es ubicación única
          else if (latitud && longitud) {
            sucursalesEncontradas.push({
              id: claveCliente.trim(),
              nombre: nombreCliente.trim(),
              latitud: parseFloat(latitud),
              longitud: parseFloat(longitud),
              numeroSucursal: "0",
              nombreSucursal: "",
            });
          }
        }
      })
      .on("close", () => {
        resolve(sucursalesEncontradas);
      })
      .on("error", (error) => {
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

  const archivos = [path.resolve(__dirname, "clientes.csv")];

  try {
    let todasLasSucursales = [];

    // Buscamos en todos los archivos
    for (const archivo of archivos) {
      const sucursales = await buscarEnArchivo(archivo, clienteId);
      todasLasSucursales = todasLasSucursales.concat(sucursales);
    }

    if (todasLasSucursales.length > 0) {
      // Filtramos solo las sucursales con GPS válido
      const sucursalesConGPS = todasLasSucursales.filter((s) => !s.sinGPS);

      if (sucursalesConGPS.length === 0) {
        return res.status(404).json({
          message:
            "Cliente encontrado pero ninguna sucursal tiene coordenadas GPS válidas.",
        });
      }

      console.log(
        `Cliente ${clienteId} encontrado con ${sucursalesConGPS.length} sucursal(es)`
      );

      // Si solo hay una sucursal con GPS, devolvemos el formato antiguo para retrocompatibilidad
      if (sucursalesConGPS.length === 1) {
        return res.status(200).json(sucursalesConGPS[0]);
      }

      // Si hay múltiples sucursales, devolvemos un array
      return res.status(200).json({
        id: clienteId,
        nombre: sucursalesConGPS[0].nombre,
        multipleSucursales: true,
        sucursales: sucursalesConGPS,
      });
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
