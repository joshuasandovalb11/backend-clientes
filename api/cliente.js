const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const cargarVendedores = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`Advertencia: El archivo de vendedores no fue encontrado.`);
      return resolve(new Map());
    }
    const vendedores = new Map();
    fs.createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on("data", (row) => {
        const codigo = row["2"];
        const nombre = row["3"];
        const telefonoRaw = row["4"];
        if (codigo && nombre && telefonoRaw) {
          const telefonoLimpio = telefonoRaw.replace(/\D/g, "");
          vendedores.set(codigo.trim(), {
            nombre: nombre.trim(),
            telefono: telefonoLimpio,
          });
        }
      })
      .on("end", () => resolve(vendedores))
      .on("error", reject);
  });
};

// Cargamos los vendedores una sola vez y guardamos la promesa.
const vendedoresMapPromise = cargarVendedores(
  path.resolve(__dirname, "vendedores.csv")
);

const buscarClienteConVendedor = (clienteId, vendedoresMap) => {
  const filePath = path.resolve(__dirname, "clientes.csv");
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    const sucursalesEncontradas = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const claveCliente = data["#Cliente"];
        if (claveCliente && claveCliente.trim() === clienteId.trim()) {
          const codigoVendedor = data.Vend ? data.Vend.trim() : null;
          const vendedorInfo = vendedoresMap.get(codigoVendedor) || {
            nombre: "No asignado",
            telefono: null,
          };
          let latitud = null;
          let longitud = null;
          if (data.GPS && data.GPS.length > 5) {
            const gpsString = data.GPS.replace(/"/g, "").trim();
            [latitud, longitud] = gpsString.split(",");
          }
          sucursalesEncontradas.push({
            id: claveCliente.trim(),
            nombre: (data["Nombre del Cliente"] || "N/A").trim(),
            latitud: latitud ? parseFloat(latitud) : null,
            longitud: longitud ? parseFloat(longitud) : null,
            numeroSucursal: (data["#Suc"] || "0").trim(),
            nombreSucursal: (data.Sucursal || "").trim(),
            vendedorNombre: vendedorInfo.nombre,
            vendedorTelefono: vendedorInfo.telefono,
          });
        }
      })
      .on("end", () => resolve(sucursalesEncontradas))
      .on("error", reject);
  });
};

// Esta es la función principal que Vercel ejecuta en cada llamada
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const clienteId = req.query.id;
  if (!clienteId) {
    return res.status(400).json({ message: 'El parámetro "id" es requerido.' });
  }

  try {
    // Esperamos a que la promesa de los vendedores se resuelva
    const vendedoresMap = await vendedoresMapPromise;
    const todasLasSucursales = await buscarClienteConVendedor(
      clienteId,
      vendedoresMap
    );

    if (todasLasSucursales.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const infoGeneralCliente = todasLasSucursales[0];
    const sucursalesConGPS = todasLasSucursales.filter(
      (s) => s.latitud && s.longitud
    );

    if (sucursalesConGPS.length === 0) {
      return res.status(200).json({
        id: infoGeneralCliente.id,
        nombre: infoGeneralCliente.nombre,
        vendedorNombre: infoGeneralCliente.vendedorNombre,
        vendedorTelefono: infoGeneralCliente.vendedorTelefono,
      });
    }

    if (sucursalesConGPS.length === 1) {
      return res.status(200).json(sucursalesConGPS[0]);
    }

    return res.status(200).json({
      id: infoGeneralCliente.id,
      nombre: infoGeneralCliente.nombre,
      vendedorNombre: infoGeneralCliente.vendedorNombre,
      vendedorTelefono: infoGeneralCliente.vendedorTelefono,
      multipleSucursales: true,
      sucursales: sucursalesConGPS,
    });
  } catch (error) {
    console.error("Error en el servidor:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};
