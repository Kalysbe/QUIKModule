import { CronJob } from "cron";
import { cleanupOldLogs } from "../repositories/apiLogsRepository.js";

// Запуск задачи раз в сутки в 03:00 по Asia/Bishkek
const job = new CronJob(
  "0 0 3 * * *",
  async () => {
    // Зарезервировано для логики работы с инструментами (ранее закомментировано)
    // Также выполняем регулярную очистку старых логов API (старше 12 месяцев)
    await cleanupOldLogs(12);
  },
  null,
  true,
  "Asia/Bishkek"
);


export default job;