# PowerShell скрипт для установки приложения как Windows Service
# Запускать от имени администратора

Write-Host "Установка QUIK Module как Windows Service..." -ForegroundColor Green

# Проверяем наличие PM2
Write-Host "Проверка установки PM2..." -ForegroundColor Yellow
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue

if (-not $pm2Installed) {
    Write-Host "PM2 не установлен. Устанавливаем..." -ForegroundColor Yellow
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка установки PM2!" -ForegroundColor Red
        exit 1
    }
}

# Устанавливаем зависимости проекта
Write-Host "Установка зависимостей проекта..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка установки зависимостей!" -ForegroundColor Red
    exit 1
}

# Проверяем наличие .env файла
if (-not (Test-Path ".env")) {
    Write-Host "ВНИМАНИЕ: Файл .env не найден!" -ForegroundColor Yellow
    Write-Host "Создайте файл .env на основе .env.example" -ForegroundColor Yellow
    Write-Host "Продолжить установку? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "y") {
        exit 1
    }
}

# Останавливаем существующий процесс (если есть)
Write-Host "Остановка существующих процессов PM2..." -ForegroundColor Yellow
pm2 delete quikmodule -s 2>$null

# Запускаем приложение через PM2
Write-Host "Запуск приложения через PM2..." -ForegroundColor Yellow
npm run pm2:start
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка запуска приложения!" -ForegroundColor Red
    exit 1
}

# Сохраняем конфигурацию PM2
Write-Host "Сохранение конфигурации PM2..." -ForegroundColor Yellow
pm2 save
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка сохранения конфигурации!" -ForegroundColor Red
    exit 1
}

# Устанавливаем PM2 как Windows Service
Write-Host "Установка PM2 как Windows Service..." -ForegroundColor Yellow
Write-Host "Для Windows используем pm2-windows-startup..." -ForegroundColor Cyan

# Проверяем наличие pm2-windows-startup
$pm2WindowsStartup = Get-Command pm2-windows-startup -ErrorAction SilentlyContinue

if (-not $pm2WindowsStartup) {
    Write-Host "Установка pm2-windows-startup..." -ForegroundColor Yellow
    npm install -g pm2-windows-startup
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Ошибка установки pm2-windows-startup!" -ForegroundColor Red
        Write-Host "Попробуйте установить вручную: npm install -g pm2-windows-startup" -ForegroundColor Yellow
        exit 1
    }
}

# Устанавливаем автозапуск
Write-Host "Настройка автозапуска PM2..." -ForegroundColor Yellow
pm2-windows-startup install

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Установка завершена успешно!" -ForegroundColor Green
    Write-Host "PM2 будет автоматически запускаться при загрузке Windows" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️ Предупреждение: Не удалось установить автозапуск" -ForegroundColor Yellow
    Write-Host "PM2 запущен, но автозапуск не настроен" -ForegroundColor Yellow
    Write-Host "Вы можете настроить автозапуск вручную через планировщик задач Windows" -ForegroundColor Yellow
}

Write-Host "`nПроверьте статус: pm2 status" -ForegroundColor Cyan
Write-Host "Просмотр логов: npm run pm2:logs" -ForegroundColor Cyan
Write-Host "`nПримечание: Приложение уже запущено через PM2 и будет работать до перезагрузки." -ForegroundColor Cyan
Write-Host "После перезагрузки Windows PM2 запустится автоматически (если установлен pm2-windows-startup)." -ForegroundColor Cyan

