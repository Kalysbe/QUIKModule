# Аукционы ГЦБ — Кыргызская фондовая биржа

Веб-приложение для просмотра аукционов государственных ценных бумаг на Кыргызской фондовой бирже.

> 🐳 Для запуска всего стека (backend + это приложение) через Docker см. [`../README.md`](../README.md).

## Стек

- Vite + React 19 + TypeScript
- React Router 7 (lazy routes, prefetch)
- Axios (централизованные запросы)
- Framer Motion (плавные переходы)
- CSS Modules + design tokens

## Запуск

```bash
npm install
npm run dev
```

Приложение откроется на [http://localhost:5173](http://localhost:5173).

API в режиме разработки проксируется на `http://192.168.20.96:5000` через `/api`.

## Сборка

```bash
npm run build
npm run preview
```

## Переменные окружения

| Файл | Переменная | Значение |
|------|------------|----------|
| `.env.development` | `VITE_API_URL` | `/api` |
| `.env.production` | `VITE_API_URL` | `http://192.168.20.96:5000/api` |

## API

- `GET /api/params/auction?limit=200&offset=0&today=false` — все аукционы
- `GET /api/params/auction?limit=200&offset=0&today=1` — только сегодня
- `GET /api/params/auction?auction_id={id}&limit=1&offset=0&today=false` — один аукцион

## Структура

- `src/lib/axios.ts` — единый HTTP-клиент
- `src/api/auctions.ts` — методы API (компоненты не вызывают axios напрямую)
- `src/pages/HomePage.tsx` — список с поиском, фильтрами, сортировкой и пагинацией
- `src/pages/AuctionDetailPage.tsx` — карточка аукциона
