/**
 * Создание первого пользователя KSE с ролью admin.
 * Запуск: node scripts/create-kse-admin.js <login> <password> "<Имя>" "<Фамилия>" <код_фирмы>
 * Пример: node scripts/create-kse-admin.js admin myPassword "Иван" "Иванов" FIRM01
 */
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pgKsePool from "../src/config/dbKse.js";
import { createUser, findByLogin } from "../src/repositories/kseUsersRepository.js";

dotenv.config();

const args = process.argv.slice(2);
const [login, password, firstName, lastName, firmCode] = args;

if (!login || !password || !firstName || !lastName || !firmCode) {
  console.error("Использование: node scripts/create-kse-admin.js <login> <password> \"<Имя>\" \"<Фамилия>\" <код_фирмы>");
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
    role: "admin",
    password_hash
  });

  console.log("Пользователь KSE (admin) создан:");
  console.log(JSON.stringify({ id: user.id, login: user.login, first_name: user.first_name, last_name: user.last_name, firm_code: user.firm_code, role: user.role }, null, 2));
}

main()
  .then(() => pgKsePool.end())
  .catch((err) => {
    console.error(err);
    pgKsePool.end().finally(() => process.exit(1));
  });
