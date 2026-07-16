# Установка как Windows Service на Windows

## ⚠️ Важно: PM2 и Windows

Команда `pm2 startup` **не работает на Windows** напрямую. Для Windows есть несколько решений:

---

## Решение 1: pm2-windows-startup (РЕКОМЕНДУЕТСЯ)

Этот пакет создает задачу в планировщике задач Windows для автозапуска PM2.

### Установка

```powershell
# 1. Установите pm2-windows-startup глобально
npm install -g pm2-windows-startup

# 2. Запустите приложение через PM2
npm run pm2:start

# 3. Сохраните конфигурацию
pm2 save

# 4. Установите автозапуск
pm2-windows-startup install
```

### Управление

```powershell
# Удаление автозапуска
pm2-windows-startup uninstall

# Проверка статуса
pm2 status
```

### Автоматическая установка

Используйте обновленный скрипт:

```powershell
.\scripts\install-service.ps1
```

Скрипт автоматически установит `pm2-windows-startup` и настроит автозапуск.

---

## Решение 2: NSSM (Non-Sucking Service Manager)

NSSM создает полноценную Windows Service.

### Установка NSSM

1. Скачайте NSSM: https://nssm.cc/download
2. Распакуйте в `C:\nssm\`
3. Или используйте Chocolatey: `choco install nssm`

### Установка службы

```powershell
# Используйте готовый скрипт
.\scripts\install-service-nssm.ps1
```

Или вручную:

```powershell
# Получите путь к Node.js
$nodePath = (Get-Command node).Source
$projectPath = "C:\Users\Kalysbek IT\Desktop\QUIKModule"

# Установите службу
C:\nssm\nssm.exe install QUIKModule $nodePath "C:\Users\Kalysbek IT\Desktop\QUIKModule\src\server.js"

# Настройте рабочую директорию
C:\nssm\nssm.exe set QUIKModule AppDirectory "C:\Users\Kalysbek IT\Desktop\QUIKModule"

# Запустите службу
C:\nssm\nssm.exe start QUIKModule
```

### Управление службой NSSM

```powershell
# Запуск
net start QUIKModule
# или
C:\nssm\nssm.exe start QUIKModule

# Остановка
net stop QUIKModule
# или
C:\nssm\nssm.exe stop QUIKModule

# Удаление
C:\nssm\nssm.exe remove QUIKModule confirm

# Редактирование
C:\nssm\nssm.exe edit QUIKModule
```

---

## Решение 3: Планировщик задач Windows

Создайте задачу в планировщике задач для автозапуска PM2.

### Через PowerShell

```powershell
# Создайте задачу для автозапуска PM2
$action = New-ScheduledTaskAction -Execute "pm2" -Argument "resurrect" -WorkingDirectory "C:\Users\Kalysbek IT\Desktop\QUIKModule"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "QUIKModule PM2 AutoStart" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Автозапуск PM2 для QUIK Module"
```

### Через GUI

1. Откройте "Планировщик задач" (taskschd.msc)
2. Создайте новую задачу
3. Триггер: "При запуске компьютера"
4. Действие: Запустить программу
   - Программа: `pm2`
   - Аргументы: `resurrect`
   - Рабочая папка: путь к проекту

---

## Решение 4: PM2 без автозапуска

Если автозапуск не критичен, можно просто использовать PM2:

```powershell
# Запуск
npm run pm2:start
pm2 save

# Приложение будет работать до перезагрузки
# После перезагрузки нужно будет запустить вручную:
pm2 resurrect
```

---

## Сравнение решений

| Решение | Автозапуск | Простота | Рекомендация |
|---------|------------|----------|--------------|
| pm2-windows-startup | ✅ Да | ⭐⭐⭐⭐⭐ | ✅ Рекомендуется |
| NSSM | ✅ Да | ⭐⭐⭐ | Для полноценной службы |
| Планировщик задач | ✅ Да | ⭐⭐⭐⭐ | Альтернатива |
| PM2 без автозапуска | ❌ Нет | ⭐⭐⭐⭐⭐ | Для разработки |

---

## Рекомендуемый порядок действий

1. **Попробуйте pm2-windows-startup** (самый простой):
   ```powershell
   npm install -g pm2-windows-startup
   npm run pm2:start
   pm2 save
   pm2-windows-startup install
   ```

2. **Если не работает, используйте NSSM**:
   ```powershell
   .\scripts\install-service-nssm.ps1
   ```

3. **Проверьте работу**:
   ```powershell
   pm2 status
   curl http://localhost:5000/health
   ```

---

## Устранение неполадок

### Проблема: pm2-windows-startup не устанавливается

```powershell
# Убедитесь, что используете права администратора
# Попробуйте установить через npm с правами администратора
npm install -g pm2-windows-startup --force
```

### Проблема: Служба не запускается после перезагрузки

1. Проверьте логи:
   ```powershell
   Get-Content logs\error.log
   ```

2. Проверьте, что PM2 сохранен:
   ```powershell
   pm2 save
   ```

3. Проверьте задачу в планировщике:
   ```powershell
   Get-ScheduledTask | Where-Object {$_.TaskName -like "*PM2*"}
   ```

### Проблема: NSSM не находит Node.js

Убедитесь, что Node.js в PATH:
```powershell
$env:PATH -split ';' | Select-String "node"
```

Или укажите полный путь к node.exe в скрипте.

---

## Дополнительная информация

- [pm2-windows-startup на GitHub](https://github.com/jon-hall/pm2-windows-startup)
- [NSSM документация](https://nssm.cc/usage)
- [PM2 документация](https://pm2.keymetrics.io/docs/usage/startup/)

