/**
 * Выполняет sql/create_firm_status.sql против БД KSE из .env (без psql).
 * Запуск: node scripts/run-firm-status-sql.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

function splitStatements(sql) {
  const noComments = sql.replace(/--[^\r\n]*/g, "");
  return noComments
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

async function main() {
  const sqlPath = path.join(root, "sql", "create_firm_status.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const stmts = splitStatements(sql);

  const client = new pg.Client({
    host: process.env.KSE_DB_HOST,
    port: Number(process.env.KSE_DB_PORT || 5432),
    user: process.env.KSE_DB_USER,
    password: process.env.KSE_DB_PASSWORD,
    database: process.env.KSE_DB_NAME,
  });

  await client.connect();
  try {
    for (let i = 0; i < stmts.length; i += 1) {
      await client.query(`${stmts[i]};`);
    }
    console.log(`OK: выполнено ${stmts.length} операторов из ${path.basename(sqlPath)}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
