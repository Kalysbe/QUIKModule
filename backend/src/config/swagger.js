// src/config/swagger.js
import swaggerJsdoc from "swagger-jsdoc";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Порядок и описание тегов (backend сокращён до API модуля аукциона)
const TAGS_ORDER = [
  { name: "QUIK - Auctions", description: "Аукционы. Источник: БД QUIK" },
  { name: "QUIK - Orders", description: "Заявки. Источник: БД QUIK" },
  { name: "QUIK - Params", description: "Параметры (динамические). Источник: БД QUIK" },
  // --- KSE API (БД фондовой биржи quik_kse) ---
  { name: "KSE - Auth", description: "Авторизация (JWT) модуля аукциона. Источник: БД KSE" },
  // Служебные (без привязки к одной БД)
  { name: "Health", description: "Проверка работоспособности сервера" },
];

// Теги, которые не показывать в Swagger UI (совпадает с x-hidden в роутах; definition.tags перезаписывает JSDoc, поэтому дублируем здесь)
const HIDDEN_TAG_NAMES = new Set([
  "QUIK - Auctions",
]);

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "QUIK Module API",
      version: "1.0.0",
      description:
        "API модуля аукциона: **QUIK API** (БД ARQA/QUIK — аукционы, заявки, параметры) и **KSE API** (БД quik_kse — авторизация).",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://${process.env.SERVER_HOST || "127.0.0.1"}:${process.env.PORT || 5000}`,
        description: "Server",
      },
    ],
    tags: TAGS_ORDER,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT для KSE API (получить через POST /api/kse/auth/login)",
        },
      },
    },
  },
  apis: [
    join(__dirname, "../routes/*.js").replace(/\\/g, "/"),
    join(__dirname, "../controllers/*.js").replace(/\\/g, "/"),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

// Скрываем операции с флагом x-hidden: true или с тегом из HIDDEN_TAG_NAMES (definition.tags перезаписывает JSDoc, поэтому явный список)
if (swaggerSpec && swaggerSpec.paths) {
  const hiddenTagsFromSpec = new Set(
    Array.isArray(swaggerSpec.tags)
      ? swaggerSpec.tags
          .filter((tag) => tag && tag["x-hidden"] === true)
          .map((tag) => tag.name)
          .filter(Boolean)
      : []
  );
  const hiddenTags = new Set([...HIDDEN_TAG_NAMES, ...hiddenTagsFromSpec]);

  for (const [pathKey, methods] of Object.entries(swaggerSpec.paths)) {
    for (const [methodKey, operation] of Object.entries(methods || {})) {
      const opTags = Array.isArray(operation?.tags) ? operation.tags : [];
      const hasHiddenTag = opTags.some((tag) => hiddenTags.has(tag));

      if (operation && (operation["x-hidden"] === true || hasHiddenTag)) {
        delete swaggerSpec.paths[pathKey][methodKey];
      }
    }

    if (Object.keys(swaggerSpec.paths[pathKey]).length === 0) {
      delete swaggerSpec.paths[pathKey];
    }
  }
}

// Сохраняем порядок тегов: только теги из TAGS_ORDER, которые реально используются в paths
if (swaggerSpec && swaggerSpec.paths) {
  const usedTagNames = new Set();
  for (const methods of Object.values(swaggerSpec.paths)) {
    for (const op of Object.values(methods || {})) {
      if (Array.isArray(op?.tags)) op.tags.forEach((t) => usedTagNames.add(t));
    }
  }
  swaggerSpec.tags = TAGS_ORDER.filter((t) => usedTagNames.has(t.name)).filter((tag) => tag["x-hidden"] !== true);
  // Добавляем теги из операций, которых нет в TAGS_ORDER (на случай старых названий до миграции)
  for (const name of usedTagNames) {
    if (!swaggerSpec.tags.some((t) => t.name === name)) {
      swaggerSpec.tags.push({ name, description: name });
    }
  }
}

// Проверка, что схема сгенерирована
if (!swaggerSpec || !swaggerSpec.paths || Object.keys(swaggerSpec.paths).length === 0) {
  console.warn("⚠️  Swagger схема пуста или не найдены endpoints. Проверьте JSDoc комментарии в роутах.");
} else {
  console.log(`✅ Swagger схема загружена: найдено ${Object.keys(swaggerSpec.paths).length} endpoints`);
}

export default swaggerSpec;

