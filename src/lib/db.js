import sql from 'mssql';

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT) || 1433,
    pool: {
        max: 50,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
        readOnlyIntent: true 
    }
};

const pools = {};

// Obtiene una conexión para una empresa específica (BdNavaXX)
export const getConnection = async (databaseName = process.env.DB_NAME) => {
    try {
        if (pools[databaseName]) {
            // Verificar si el pool sigue conectado
            const pool = await pools[databaseName];
            if (pool.connected) return pool;
            delete pools[databaseName];
        }

        const configForDb = { ...sqlConfig, database: databaseName };
        console.log(`Attempting to connect to ${databaseName} at ${configForDb.server}:${configForDb.port}...`);
        
        const poolPromise = new sql.ConnectionPool(configForDb).connect();
        pools[databaseName] = poolPromise;
        const pool = await poolPromise;
        
        console.log(`CONNECTED: SQL Server ${databaseName} via ${configForDb.server}`);
        return pool;
    } catch (err) {
        console.error(`CONNECTION FAILED for ${databaseName} (${process.env.DB_SERVER}):`, err.message);
        delete pools[databaseName];
        throw err;
    }
};
