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
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const claveCliente = data.CLAVE || data["#Cliente"];

        if (claveCliente && claveCliente.trim() === clienteId.trim()) {
          let latitud = null;
          let longitud = null;

          if (data.GPS && typeof data.GPS === "string" && data.GPS.length > 5) {
            const gpsString = data.GPS.replace(/"/g, "").trim();
            if (gpsString.includes(",")) {
              [latitud, longitud] = gpsString.split(",");
            } else if (gpsString.includes("&")) {
              [latitud, longitud] = gpsString.split("&");
            }
          }

          const nombreCliente =
            data.RAZON || data["Nombre del Cliente"] || "Cliente sin nombre";
          const numeroSucursal = data["#Suc"] || "0";
          const nombreSucursal = data.Sucursal || "";
          const telefono = data.Telefono || null;

          sucursalesEncontradas.push({
            id: claveCliente.trim(),
            nombre: nombreCliente.trim(),
            latitud: latitud ? parseFloat(latitud) : null,
            longitud: longitud ? parseFloat(longitud) : null,
            telefono: telefono ? telefono.trim() : null,
            numeroSucursal: numeroSucursal.trim(),
            nombreSucursal: nombreSucursal.trim(),
          });
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const clienteId = req.query.id;

  if (!clienteId) {
    return res
      .status(400)
      .json({ message: 'El parámetro "id" del cliente es requerido.' });
  }

  try {
    const todasLasSucursales = await buscarEnArchivo(
      path.resolve(__dirname, "clientes.csv"),
      clienteId
    );

    if (todasLasSucursales.length === 0) {
      // **CASO 1: El cliente realmente no existe**
      console.log(`Cliente con ID ${clienteId} no fue encontrado.`);
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // El cliente existe, ahora analizamos sus sucursales
    const sucursalesConGPS = todasLasSucursales.filter(
      (s) => s.latitud && s.longitud
    );
    const infoCliente = todasLasSucursales[0]; // Información general del cliente

    if (sucursalesConGPS.length === 0) {
      // **CASO 2: Cliente existe, pero SIN sucursales con GPS.**
      // Devolvemos una respuesta exitosa (200) solo con los datos básicos.
      console.log(
        `Cliente ${clienteId} encontrado pero sin sucursales con GPS.`
      );
      return res.status(200).json({
        id: infoCliente.id,
        nombre: infoCliente.nombre,
        telefono: infoCliente.telefono,
      });
    }

    if (sucursalesConGPS.length === 1) {
      // **CASO 3: Cliente con UNA sucursal con GPS.**
      console.log(`Cliente ${clienteId} encontrado con 1 sucursal con GPS.`);
      return res.status(200).json(sucursalesConGPS[0]);
    }

    // **CASO 4: Cliente con MÚLTIPLES sucursales con GPS.**
    console.log(
      `Cliente ${clienteId} encontrado con ${sucursalesConGPS.length} sucursales con GPS.`
    );
    return res.status(200).json({
      id: infoCliente.id,
      nombre: infoCliente.nombre,
      telefono: infoCliente.telefono,
      multipleSucursales: true,
      sucursales: sucursalesConGPS,
    });
  } catch (error) {
    console.error("Error en el servidor al procesar la búsqueda:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};
