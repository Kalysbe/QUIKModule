# PowerShell скрипт для установки приложения как Windows Service через NSSM
# Альтернативный метод для Windows
# Запускать от имени администратора

Write-Host "Установка QUIK Module как Windows Service через NSSM..." -ForegroundColor Green

# Проверяем наличие NSSM
$nssmPath = "C:\nssm\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "NSSM не найден. Установка NSSM..." -ForegroundColor Yellow
    Write-Host "Скачайте NSSM с https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Распакуйте в C:\nssm\" -ForegroundColor Yellow
    Write-Host "Или укажите путь к nssm.exe в скрипте" -ForegroundColor Yellow
    exit 1
}

# Получаем путь к Node.js
$nodePath = (Get-Command node).Source
$nodeDir = Split-Path $nodePath

# Получаем путь к проекту
$projectPath = $PSScriptRoot + "\.."
$projectPath = (Resolve-Path $projectPath).Path

# Имя службы
$serviceName = "QUIKModule"

# Проверяем, существует ли уже служба
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Служба $serviceName уже существует. Удаляем..." -ForegroundColor Yellow
    & $nssmPath stop $serviceName
    & $nssmPath remove $serviceName confirm
}

# Устанавливаем службу
Write-Host "Установка службы $serviceName..." -ForegroundColor Yellow

# Путь к скрипту запуска
$startScript = Join-Path $projectPath "src\server.js"

# Установка службы
& $nssmPath install $serviceName $nodePath "$startScript"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка установки службы!" -ForegroundColor Red
    exit 1
}

# Настройка рабочей директории
& $nssmPath set $serviceName AppDirectory $projectPath

# Настройка переменных окружения
$envFile = Join-Path $projectPath ".env"
if (Test-Path $envFile) {
    Write-Host "Настройка переменных окружения из .env..." -ForegroundColor Yellow
    # NSSM может загружать переменные из файла, но проще установить через AppEnvironment
    # Для простоты используем .env через dotenv в коде
}

# Настройка автозапуска
& $nssmPath set $serviceName Start SERVICE_AUTO_START

# Настройка описания
& $nssmPath set $serviceName Description "QUIK Module - Windows Service для локальной сети организации"

# Настройка вывода
$logDir = Join-Path $projectPath "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

& $nssmPath set $serviceName AppStdout (Join-Path $logDir "nssm-stdout.log")
& $nssmPath set $serviceName AppStderr (Join-Path $logDir "nssm-stderr.log")

# Запуск службы
Write-Host "Запуск службы..." -ForegroundColor Yellow
& $nssmPath start $serviceName

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Служба установлена и запущена успешно!" -ForegroundColor Green
    Write-Host "Имя службы: $serviceName" -ForegroundColor Cyan
    Write-Host "Управление службой:" -ForegroundColor Cyan
    Write-Host "  Запуск:   net start $serviceName" -ForegroundColor White
    Write-Host "  Остановка: net stop $serviceName" -ForegroundColor White
    Write-Host "  Или через: services.msc" -ForegroundColor White
} else {
    Write-Host "`n⚠️ Служба установлена, но не запущена" -ForegroundColor Yellow
    Write-Host "Попробуйте запустить вручную: net start $serviceName" -ForegroundColor Yellow
}

