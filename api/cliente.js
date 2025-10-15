const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Función para cargar los vendedores y sus teléfonos en un mapa para acceso rápido
const cargarVendedores = (filePath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`Advertencia: El archivo de vendedores no fue encontrado.`);
      return resolve(new Map());
    }

    const vendedores = new Map();

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        const codigo = data.Codigo ? data.Codigo.trim() : null;
        const telefono = data.Telefono ? data.Telefono.trim() : null;
        const nombre = data.Nombre ? data.Nombre.trim() : null;

        if (codigo && telefono && nombre) {
          vendedores.set(codigo, {
            nombre: nombre,
            telefono: telefono,
          });
        }
      })
      .on("end", () => {
        // console.log(`✓ Total de vendedores cargados: ${vendedores.size}`);
        resolve(vendedores);
      })
      .on("error", (err) => {
        console.error(`✗ Error al cargar vendedores: ${err.message}`);
        reject(err);
      });
  });
};

// Función para buscar al cliente y enriquecerlo con datos del vendedor
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

  console.log(`Búsqueda iniciada para el cliente ID: ${clienteId}`);

  try {
    const vendedoresMap = await cargarVendedores(
      path.resolve(__dirname, "vendedores.csv")
    );
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
      // Cliente existe, pero sin GPS. Devolver datos del vendedor.
      return res.status(200).json({
        id: infoGeneralCliente.id,
        nombre: infoGeneralCliente.nombre,
        vendedorNombre: infoGeneralCliente.vendedorNombre,
        vendedorTelefono: infoGeneralCliente.vendedorTelefono,
      });
    }

    if (sucursalesConGPS.length === 1) {
      // Cliente con una sola ubicación con GPS.
      return res.status(200).json(sucursalesConGPS[0]);
    }

    // Cliente con múltiples sucursales con GPS.
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
