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
            return pools[databaseName];
        }

        const configForDb = { ...sqlConfig, database: databaseName };
        const poolPromise = new sql.ConnectionPool(configForDb).connect();
        
        pools[databaseName] = poolPromise;
        const pool = await poolPromise;
        console.log(`Connected to SQL Server: ${databaseName}`);
        
        return pool;
    } catch (err) {
        console.error(`Database connection failed for ${databaseName}:`, err);
        delete pools[databaseName];
        throw err;
    }
};
