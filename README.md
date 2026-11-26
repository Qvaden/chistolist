# ЧистоЛист — Локальная очистка таблиц и защита PDF без облака

Полностью бесплатный и клиентский (Zero-Server) веб-сервис без регистрации и лимитов: все вычисления, очистка Excel/CSV, необратимое замазывание PDF, водяные знаки, склейка страниц, а также удаление EXIF/GPS с фото и сборка сканов в PDF происходят в памяти браузера пользователя.

## Как развернуть бесплатно (0 ₽)

### Вариант 1: Cloudflare Pages (рекомендуется)
1. Залейте папку проекта в репозиторий на GitHub.
2. Зайдите в **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Настройки сборки:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Нажмите **Save and Deploy** — вы получите бесплатный HTTPS-домен вида `*.pages.dev`.

### Вариант 2: Vercel
1. Подключите GitHub-репозиторий на [vercel.com](https://vercel.com).
2. Vercel автоматически определит Vite (`npm run build` → `dist`).

## Локальный запуск
```bash
npm install
npm run dev
```
