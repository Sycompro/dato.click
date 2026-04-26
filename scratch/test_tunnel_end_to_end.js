const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '127.0.0.1',
    port: 1434, // El puerto del túnel de prueba
    database: 'master',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000
    }
};

async function testTunnel() {
    try {
        console.log("Probando conexión a través del túnel (127.0.0.1:1434)...");
        let pool = await sql.connect(config);
        console.log("¡ÉXITO! El túnel funciona perfectamente. Conectado a SQL Server.");
        await pool.close();
    } catch (err) {
        console.error("FALLO EN EL TÚNEL:", err.message);
    }
}

testTunnel();
