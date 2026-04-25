const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    database: 'BdNava01',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function exploreAll() {
    try {
        let pool = await sql.connect(config);
        
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
        let tables = result.recordset.map(r => r.TABLE_NAME);
        
        // Filtrar algunashabituales de ventas, bienes, personal, sucursales
        let interesting = tables.filter(t => {
            let lt = t.toLowerCase();
            return lt.includes('venta') || lt.includes('factura') || lt.includes('bien') || lt.includes('item') || 
                   lt.includes('personal') || lt.includes('vendedor') || lt.includes('sucursal') || lt.includes('empresa');
        });
        
        console.log("Tablas interesantes encontradas:");
        interesting.forEach(t => console.log(t));

        sql.close();
    } catch (err) {
        console.error("SQL Error:", err.message);
    }
}

exploreAll();
