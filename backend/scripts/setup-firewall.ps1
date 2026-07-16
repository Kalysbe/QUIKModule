# PowerShell скрипт для настройки Windows Firewall
# Запускать от имени администратора

Write-Host "Настройка Windows Firewall для QUIK Module..." -ForegroundColor Green

# Получаем порт из переменных окружения или используем по умолчанию
$port = $env:PORT
if (-not $port) {
    $port = 5000
}

Write-Host "Настраиваем правила для порта $port..." -ForegroundColor Yellow

# Удаляем существующие правила (если есть)
Write-Host "Удаление существующих правил..." -ForegroundColor Yellow
Remove-NetFirewallRule -DisplayName "QUIK Module - Local Network Only" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "QUIK Module - Block External" -ErrorAction SilentlyContinue

# Разрешаем доступ только из локальной сети
Write-Host "Создание правила для локальной сети..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "QUIK Module - Local Network Only" `
    -Direction Inbound `
    -LocalPort $port `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1 `
    -Description "Разрешает доступ к QUIK Module только из локальной сети организации"

# Блокируем все остальные подключения (опционально, если нужно явно блокировать)
# New-NetFirewallRule -DisplayName "QUIK Module - Block External" `
#     -Direction Inbound `
#     -LocalPort $port `
#     -Protocol TCP `
#     -Action Block `
#     -RemoteAddress Any `
#     -Description "Блокирует внешние подключения к QUIK Module"

Write-Host "Настройка завершена!" -ForegroundColor Green
Write-Host "Проверьте правила в Брандмауэре Защитника Windows" -ForegroundColor Cyan

