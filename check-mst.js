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

async function getMasters() {
    try {
        let pool = await sql.connect(config);
        
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_NAME LIKE 'mst01%'");
        let tables = result.recordset.map(r => r.TABLE_NAME);
        
        console.log("Tablas mst01 encontradas:");
        tables.forEach(t => console.log(t));

        sql.close();
    } catch (err) {
        console.error("SQL Error:", err.message);
    }
}

getMasters();
