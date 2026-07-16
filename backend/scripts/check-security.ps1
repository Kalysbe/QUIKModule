# PowerShell скрипт для проверки настроек безопасности
# Проверяет, что приложение настроено правильно

Write-Host "Проверка настроек безопасности QUIK Module..." -ForegroundColor Green
Write-Host ""

$errors = @()
$warnings = @()

# Проверка 1: Сервер не слушает на 0.0.0.0
Write-Host "1. Проверка привязки сервера..." -ForegroundColor Yellow
$port = $env:PORT
if (-not $port) {
    $port = 5000
}

$listening = netstat -an | Select-String ":$port" | Select-String "LISTENING"
$listeningOnAll = $listening | Select-String "0.0.0.0:$port"

if ($listeningOnAll) {
    $errors += "СЕРЬЕЗНО: Сервер слушает на 0.0.0.0:$port - это небезопасно!"
    Write-Host "  [ОШИБКА] Сервер слушает на 0.0.0.0" -ForegroundColor Red
} else {
    Write-Host "  [OK] Сервер не слушает на 0.0.0.0" -ForegroundColor Green
}

# Проверка 2: Firewall правила
Write-Host "`n2. Проверка правил Firewall..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "QUIK Module - Local Network Only" -ErrorAction SilentlyContinue

if (-not $firewallRule) {
    $warnings += "Правило Firewall для локальной сети не найдено"
    Write-Host "  [ПРЕДУПРЕЖДЕНИЕ] Правило Firewall не настроено" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Правило Firewall настроено" -ForegroundColor Green
}

# Проверка 3: Переменные окружения
Write-Host "`n3. Проверка переменных окружения..." -ForegroundColor Yellow

if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    
    if ($envContent -match "SERVER_HOST\s*=\s*0\.0\.0\.0") {
        $errors += "СЕРЬЕЗНО: SERVER_HOST установлен в 0.0.0.0 - это небезопасно!"
        Write-Host "  [ОШИБКА] SERVER_HOST = 0.0.0.0" -ForegroundColor Red
    } elseif ($envContent -match "SERVER_HOST\s*=") {
        Write-Host "  [OK] SERVER_HOST настроен" -ForegroundColor Green
    } else {
        $warnings += "SERVER_HOST не указан, будет использован 127.0.0.1"
        Write-Host "  [OK] SERVER_HOST будет использован по умолчанию (127.0.0.1)" -ForegroundColor Green
    }
    
    if ($envContent -match "ALLOWED_NETWORKS\s*=") {
        Write-Host "  [OK] ALLOWED_NETWORKS настроен" -ForegroundColor Green
    } else {
        $warnings += "ALLOWED_NETWORKS не указан, будут использованы стандартные диапазоны"
        Write-Host "  [OK] ALLOWED_NETWORKS будет использован по умолчанию" -ForegroundColor Green
    }
} else {
    $warnings += "Файл .env не найден"
    Write-Host "  [ПРЕДУПРЕЖДЕНИЕ] Файл .env не найден" -ForegroundColor Yellow
}

# Проверка 4: PM2 статус
Write-Host "`n4. Проверка статуса PM2..." -ForegroundColor Yellow
$pm2Status = pm2 jlist 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($pm2Status) {
    $quikModule = $pm2Status | Where-Object { $_.name -eq "quikmodule" }
    if ($quikModule) {
        if ($quikModule.pm2_env.status -eq "online") {
            Write-Host "  [OK] Приложение запущено через PM2" -ForegroundColor Green
        } else {
            $warnings += "Приложение не запущено через PM2"
            Write-Host "  [ПРЕДУПРЕЖДЕНИЕ] Приложение не запущено" -ForegroundColor Yellow
        }
    } else {
        $warnings += "Приложение не найдено в PM2"
        Write-Host "  [ПРЕДУПРЕЖДЕНИЕ] Приложение не найдено в PM2" -ForegroundColor Yellow
    }
} else {
    $warnings += "PM2 не установлен или не запущен"
    Write-Host "  [ПРЕДУПРЕЖДЕНИЕ] PM2 не установлен или не запущен" -ForegroundColor Yellow
}

# Итоги
Write-Host "`n" + "="*50 -ForegroundColor Cyan
if ($errors.Count -gt 0) {
    Write-Host "`nОБНАРУЖЕНЫ КРИТИЧЕСКИЕ ОШИБКИ:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host "`nИсправьте ошибки перед использованием приложения!" -ForegroundColor Red
    exit 1
} elseif ($warnings.Count -gt 0) {
    Write-Host "`nОбнаружены предупреждения:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
    Write-Host "`nПроверка завершена с предупреждениями." -ForegroundColor Yellow
} else {
    Write-Host "`nВсе проверки пройдены успешно!" -ForegroundColor Green
}

