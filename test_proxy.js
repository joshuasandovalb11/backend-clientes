const url = "http://toolsdemexico.net:3001/api/general/clientes/app-search?id=82";

async function test() {
  console.log(`Realizando petición a: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status}`);
      return;
    }
    const data = await response.json();
    console.log("Status:", response.status);
    
    const stringifiedData = JSON.stringify(data);
    if (response.status === 200 && stringifiedData.includes("CENTRO DE PINTURAS COMEX")) {
      console.log("✅ CONEXIÓN EXITOSA");
    } else {
      console.log("⚠️ Petición exitosa, pero el JSON no contiene 'CENTRO DE PINTURAS COMEX'");
      console.log(stringifiedData.substring(0, 300));
    }
  } catch (error) {
    console.error("❌ Fetch Error:", error);
  }
}

test();
