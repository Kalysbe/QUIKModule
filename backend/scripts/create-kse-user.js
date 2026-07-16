/**
 * Создание пользователя KSE.
 * Запуск: node scripts/create-kse-user.js <login> <password> "<Имя>" "<Фамилия>" <код_фирмы> <role>
 * Пример: node scripts/create-kse-user.js minfin Minfin2026! "Министерство" "Финансов" MINFIN minfin
 */
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pgKsePool from "../src/config/dbKse.js";
import { createUser, findByLogin } from "../src/repositories/kseUsersRepository.js";

dotenv.config();

const ROLES = ["admin", "operator", "minfin"];
const args = process.argv.slice(2);
const [login, password, firstName, lastName, firmCode, role = "operator"] = args;

if (!login || !password || !firstName || !lastName || !firmCode) {
  console.error(
    'Использование: node scripts/create-kse-user.js <login> <password> "<Имя>" "<Фамилия>" <код_фирмы> [role]',
  );
  process.exit(1);
}

if (!ROLES.includes(role)) {
  console.error(`Роль должна быть одной из: ${ROLES.join(", ")}`);
  process.exit(1);
}

const BCRYPT_ROUNDS = 10;

async function main() {
  const existing = await findByLogin(login);
  if (existing) {
    console.error(`Пользователь с логином "${login}" уже существует.`);
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await createUser({
    login,
    first_name: firstName,
    last_name: lastName,
    firm_code: firmCode,
    role,
    password_hash,
  });

  console.log(`Пользователь KSE (${role}) создан:`);
  console.log(
    JSON.stringify(
      {
        id: user.id,
        login: user.login,
        first_name: user.first_name,
        last_name: user.last_name,
        firm_code: user.firm_code,
        role: user.role,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => pgKsePool.end())
  .catch((err) => {
    console.error(err);
    pgKsePool.end().finally(() => process.exit(1));
  });
