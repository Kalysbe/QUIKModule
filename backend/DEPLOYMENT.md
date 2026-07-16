# Инструкция по развертыванию QUIK Module

## Подготовка к развертыванию

### 1. Требования к системе

- Windows Server 2016+ / Windows 10-11
- Node.js LTS (≥ 18.x)
- Права администратора для установки службы

### 2. Установка Node.js

1. Скачайте Node.js LTS с официального сайта: https://nodejs.org/
2. Установите с настройками по умолчанию
3. Проверьте установку:
   ```powershell
   node --version
   npm --version
   ```

### 3. Клонирование/копирование проекта

```powershell
# Если проект в Git
git clone <repository-url>
cd QUIKModule

# Или скопируйте файлы проекта в нужную директорию
```

## Установка и настройка

### Шаг 1: Установка зависимостей

```powershell
npm install
```

### Шаг 2: Настройка переменных окружения

1. Создайте файл `.env` в корне проекта
2. Скопируйте пример конфигурации (см. README.md)
3. Настройте следующие параметры:

```env
# КРИТИЧЕСКИ ВАЖНО: Используйте конкретный IP локальной сети
SERVER_HOST=192.168.1.10  # или 127.0.0.1
PORT=5000

# Разрешенные сети
ALLOWED_NETWORKS=192.168.0.0/16,10.0.0.0/8

# Настройки БД
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
```

### Шаг 3: Настройка Firewall

**ВАЖНО**: Выполните от имени администратора!

```powershell
# Автоматическая настройка через скрипт
.\scripts\setup-firewall.ps1

# Или вручную через PowerShell:
New-NetFirewallRule -DisplayName "QUIK Module - Local Network Only" `
    -Direction Inbound `
    -LocalPort 5000 `
    -Protocol TCP `
    -Action Allow `
    -RemoteAddress 192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.1
```

### Шаг 4: Установка PM2

```powershell
npm install -g pm2
```

### Шаг 5: Установка как Windows Service

**Вариант 1: Автоматическая установка (рекомендуется)**

```powershell
# Запустите скрипт от имени администратора
.\scripts\install-service.ps1
```

**Вариант 2: Ручная установка**

```powershell
# Запуск приложения
npm run pm2:start

# Сохранение конфигурации
pm2 save

# Установка как служба Windows
pm2 startup
# Следуйте инструкциям, которые выведет команда
```

## Проверка установки

### 1. Проверка безопасности

```powershell
# Запустите скрипт проверки
.\scripts\check-security.ps1
```

### 2. Проверка статуса службы

```powershell
# Статус PM2
pm2 status

# Логи
npm run pm2:logs

# Мониторинг
npm run pm2:monit
```

### 3. Проверка доступности

```powershell
# Health check
curl http://localhost:5000/health

# Или через браузер (если доступен)
# http://localhost:5000/health
```

### 4. Проверка сетевого подключения

```powershell
# Проверьте, что сервер не слушает на 0.0.0.0
netstat -an | findstr :5000

# Должно быть что-то вроде:
# TCP    192.168.1.10:5000    0.0.0.0:0              LISTENING
# НЕ должно быть:
# TCP    0.0.0.0:5000         0.0.0.0:0              LISTENING
```

## Управление службой

### Запуск/остановка

```powershell
# Запуск
npm run pm2:start

# Остановка
npm run pm2:stop

# Перезапуск
npm run pm2:restart

# Удаление из PM2
npm run pm2:delete
```

### Просмотр логов

```powershell
# Все логи PM2
npm run pm2:logs

# Логи приложения
Get-Content logs\combined.log -Tail 50

# Только ошибки
Get-Content logs\error.log -Tail 50
```

### Обновление приложения

```powershell
# 1. Остановите службу
npm run pm2:stop

# 2. Обновите код (git pull или копирование файлов)
git pull  # или скопируйте новые файлы

# 3. Установите новые зависимости (если есть)
npm install

# 4. Запустите службу
npm run pm2:start

# 5. Сохраните конфигурацию
pm2 save
```

## Устранение неполадок

### Проблема: Приложение не запускается

1. Проверьте логи:
   ```powershell
   npm run pm2:logs
   Get-Content logs\error.log
   ```

2. Проверьте переменные окружения:
   ```powershell
   # Убедитесь, что .env файл существует и правильно настроен
   Get-Content .env
   ```

3. Проверьте подключение к БД:
   ```powershell
   # Проверьте настройки БД в .env
   # Убедитесь, что БД доступна
   ```

### Проблема: Доступ запрещен (403)

1. Проверьте IP адрес клиента в логах:
   ```powershell
   Get-Content logs\combined.log | Select-String "Access denied"
   ```

2. Убедитесь, что IP входит в разрешенные сети:
   - Проверьте `ALLOWED_NETWORKS` в `.env`
   - Проверьте, что IP клиента входит в указанные диапазоны

3. Проверьте настройки Firewall:
   ```powershell
   Get-NetFirewallRule -DisplayName "QUIK Module*"
   ```

### Проблема: Служба не запускается автоматически

1. Проверьте установку PM2 startup:
   ```powershell
   pm2 startup
   ```

2. Убедитесь, что PM2 сохранен:
   ```powershell
   pm2 save
   ```

3. Проверьте службу Windows:
   ```powershell
   Get-Service | Where-Object {$_.DisplayName -like "*PM2*"}
   ```

### Проблема: Порт занят

1. Найдите процесс, использующий порт:
   ```powershell
   netstat -ano | findstr :5000
   ```

2. Остановите процесс или измените порт в `.env`

## Резервное копирование

### Что нужно резервировать:

1. Файл `.env` с настройками
2. Директория `logs/` (опционально)
3. Конфигурация PM2: `~/.pm2/dump.pm2`

### Восстановление:

1. Восстановите файлы проекта
2. Восстановите `.env`
3. Установите зависимости: `npm install`
4. Запустите службу: `npm run pm2:start`
5. Сохраните конфигурацию: `pm2 save`

## Безопасность

### Чек-лист безопасности:

- [ ] `SERVER_HOST` не установлен в `0.0.0.0`
- [ ] Firewall настроен для блокировки внешних подключений
- [ ] `ALLOWED_NETWORKS` настроен правильно
- [ ] Пароли БД хранятся в `.env` (не в коде)
- [ ] `.env` файл не попал в Git (проверьте `.gitignore`)
- [ ] Логи не содержат чувствительной информации
- [ ] Регулярно проверяйте логи на подозрительную активность

### Регулярные проверки:

```powershell
# Еженедельно запускайте проверку безопасности
.\scripts\check-security.ps1

# Проверяйте логи на подозрительную активность
Get-Content logs\combined.log | Select-String "403|FORBIDDEN|Access denied"
```

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `logs/error.log` и `logs/combined.log`
2. Запустите проверку безопасности: `.\scripts\check-security.ps1`
3. Проверьте документацию в `README.md`

