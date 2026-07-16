import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const config = {
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server: process.env.MSSQL_HOST,
  database: process.env.MSSQL_DB,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

/**
 * Получает подключенный pool MSSQL
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getMssqlPool() {
  await poolConnect;
  return pool;
}

export { sql, poolConnect, pool };
