# Руководство по добавлению новых endpoints в Swagger

Этот проект использует Swagger для автоматической генерации API документации. Все новые endpoints автоматически добавляются в Swagger при добавлении JSDoc комментариев.

## Доступ к Swagger UI

После запуска сервера, Swagger UI доступен по адресу:
- `http://localhost:5000/api-docs` (или ваш SERVER_HOST:PORT)
- JSON схема доступна по адресу: `http://localhost:5000/api-docs.json`

## Как добавить новый endpoint в Swagger

### 1. Создайте роут в файле `src/routes/yourRoutes.js`

```javascript
import express from "express";
import { yourController } from "../controllers/yourController.js";

const router = express.Router();

/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Краткое описание endpoint
 *     tags: [YourTag]
 *     description: Подробное описание того, что делает endpoint
 *     parameters:
 *       - in: query
 *         name: paramName
 *         schema:
 *           type: string
 *         description: Описание параметра
 *         required: false
 *     responses:
 *       200:
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 field1:
 *                   type: string
 *                 field2:
 *                   type: number
 *       400:
 *         description: Ошибка валидации
 *       500:
 *         description: Ошибка сервера
 */
router.get("/", yourController);

export default router;
```

### 2. Зарегистрируйте роут в `src/app.js`

```javascript
import yourRoutes from "./routes/yourRoutes.js";

// В секции маршрутов:
app.use("/api/your-endpoint", yourRoutes);
```

### 3. Swagger автоматически подхватит ваш endpoint!

Swagger сканирует все файлы в `src/routes/*.js` и `src/controllers/*.js` и автоматически добавляет endpoints с JSDoc комментариями.

## Примеры JSDoc комментариев

### GET запрос с query параметрами

```javascript
/**
 * @swagger
 * /api/example:
 *   get:
 *     summary: Получить данные
 *     tags: [Example]
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: Успешно
 */
```

### POST запрос с body

```javascript
/**
 * @swagger
 * /api/example:
 *   post:
 *     summary: Создать запись
 *     tags: [Example]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               value:
 *                 type: number
 *     responses:
 *       201:
 *         description: Создано
 */
```

### PUT/PATCH запрос

```javascript
/**
 * @swagger
 * /api/example/{id}:
 *   put:
 *     summary: Обновить запись
 *     tags: [Example]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Обновлено
 */
```

### DELETE запрос

```javascript
/**
 * @swagger
 * /api/example/{id}:
 *   delete:
 *     summary: Удалить запись
 *     tags: [Example]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Удалено
 *       404:
 *         description: Не найдено
 */
```

## Теги (Tags)

Используйте теги для группировки endpoints:
- `[Instruments]` - для endpoints инструментов
- `[Firms]` - для endpoints фирм
- `[DepoLimits]` - для депозитарных лимитов
- `[MoneyLimits]` - для денежных лимитов
- `[Trdaccs]` - для торговых счетов
- `[Health]` - для health check

## Типы данных в схемах

- `string` - строка
- `number` - число
- `integer` - целое число
- `boolean` - булево значение
- `array` - массив
- `object` - объект
- `date-time` - дата и время (format: date-time)

## Важные замечания

1. **Всегда добавляйте JSDoc комментарии** к новым endpoints
2. **Используйте теги** для группировки
3. **Описывайте все параметры** (query, path, body)
4. **Указывайте возможные ответы** (200, 400, 404, 500 и т.д.)
5. **Добавляйте примеры** для сложных схем

## Проверка

После добавления нового endpoint:
1. Перезапустите сервер
2. Откройте `http://localhost:5000/api-docs`
3. Убедитесь, что ваш endpoint появился в документации
4. Протестируйте endpoint через Swagger UI

