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
        
        let result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
        let tables = result.recordset.map(r => r.TABLE_NAME);
        
        let interesting = tables.filter(t => {
            let lt = t.toLowerCase();
            return lt.includes('art') || lt.includes('prod') || lt.includes('vend') || lt.includes('pers') || lt.includes('emp') || lt.includes('cli') || lt.includes('mae_');
        });
        
        console.log("Tablas encontradas:", interesting.length);
        interesting.forEach(t => console.log(t));

        sql.close();
    } catch (err) {
        console.error("SQL Error:", err.message);
    }
}

getMasters();
