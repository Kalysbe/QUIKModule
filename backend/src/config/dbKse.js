import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  host: process.env.KSE_DB_HOST,
  port: process.env.KSE_DB_PORT,
  user: process.env.KSE_DB_USER,
  password: process.env.KSE_DB_PASSWORD,
  database: process.env.KSE_DB_NAME,
});

export default pool;
