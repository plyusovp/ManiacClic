# Руководство по интеграции вывода звёзд

## Обзор

Это руководство описывает, как настроить интеграцию кликера с API Telegram бота для вывода "звёзд". Система использует HMAC-SHA256 подписи для обеспечения безопасности запросов.

## Архитектура

```
[Telegram WebApp] → [API Request with HMAC] → [Bot Server] → [Telegram Bot API]
```

## Настройка сервера

### 1. Установка зависимостей

```bash
cd docs
npm install
```

### 2. Настройка переменных окружения

Скопируйте файл `env.example` в `.env` и заполните:

```bash
cp env.example .env
```

Отредактируйте `.env`:

```env
# Токен вашего бота от @BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Секретный ключ для подписи (сгенерируйте случайную строку)
SECRET_KEY=your-very-secure-secret-key-here

# Порт сервера
PORT=8080
```

### 3. Обновление секретного ключа в клиенте

Откройте `main.js` и найдите функцию `getSecretKey()`. Замените значение на тот же ключ, что в `.env`:

```javascript
function getSecretKey() {
    return 'your-very-secure-secret-key-here'; // Должен совпадать с SECRET_KEY в .env
}
```

### 4. Настройка URL API

Откройте `api_config.js` и обновите URL:

```javascript
// Для локальной разработки
const API_URL = "http://localhost:8080/api/withdrawal/create";

// Для продакшена
// const API_URL = "https://your-domain.com/api/withdrawal/create";
```

### 5. Запуск сервера

```bash
npm start
```

Для разработки с автоперезагрузкой:

```bash
npm run dev
```

## Процесс вывода

### 1. Пользователь нажимает "Вывод"

- Приложение получает `user_id` из Telegram WebApp
- Пользователь выбирает сумму для вывода
- Приложение рассчитывает комиссию

### 2. Создание запроса

- Генерируется уникальный `app_transaction_id`
- Создается HMAC-SHA256 подпись: `signature = HMAC(user_id + amount + app_transaction_id)`
- Отправляется POST запрос на `/api/withdrawal/create`

### 3. Обработка на сервере

- Сервер проверяет подпись
- Валидирует данные
- Создает заявку на вывод
- Отправляет уведомление пользователю в Telegram

### 4. Ответ клиенту

- При успехе: баланс списывается, показывается уведомление
- При ошибке: показывается сообщение об ошибке

## Формат запроса

```json
{
  "user_id": 123456789,
  "amount": 200,
  "app_transaction_id": "tx_1234567890_abc123",
  "signature": "a1b2c3d4e5f6..."
}
```

## Формат ответа

### Успешный ответ

```json
{
  "success": true,
  "message": "Заявка на вывод успешно создана",
  "data": {
    "transaction_id": "tx_1234567890_abc123",
    "amount": 200,
    "bot_stars": 1,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Ответ с ошибкой

```json
{
  "success": false,
  "error": "Недостаточно данных для создания заявки"
}
```

## Безопасность

### HMAC подпись

Подпись создается по формуле:
```
signature = HMAC-SHA256(user_id + "_" + amount + "_" + app_transaction_id, SECRET_KEY)
```

### Проверка на сервере

Сервер проверяет подпись с помощью `crypto.timingSafeEqual()` для предотвращения timing атак.

### Валидация данных

- `user_id` должен быть числом
- `amount` должен быть кратным 200 и не менее 200
- `app_transaction_id` должен быть уникальным
- `signature` должна быть корректной

## Тестирование

### 1. Проверка здоровья сервера

```bash
curl http://localhost:8080/api/health
```

### 2. Информация о сервере

```bash
curl http://localhost:8080/api/info
```

### 3. Тестовый запрос на вывод

```bash
curl -X POST http://localhost:8080/api/withdrawal/create \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123456789,
    "amount": 200,
    "app_transaction_id": "tx_test_123",
    "signature": "test_signature"
  }'
```

## Развертывание в продакшене

### 1. Heroku

```bash
# Установите Heroku CLI
heroku create your-app-name

# Настройте переменные окружения
heroku config:set BOT_TOKEN=your_bot_token
heroku config:set SECRET_KEY=your_secret_key

# Обновите API_URL в api_config.js
const API_URL = "https://your-app-name.herokuapp.com/api/withdrawal/create";

# Деплой
git push heroku main
```

### 2. Railway

```bash
# Установите Railway CLI
railway login

# Создайте проект
railway init

# Настройте переменные окружения в панели Railway
# BOT_TOKEN, SECRET_KEY

# Обновите API_URL
const API_URL = "https://your-app.railway.app/api/withdrawal/create";

# Деплой
railway up
```

### 3. Vercel

```bash
# Установите Vercel CLI
npm i -g vercel

# Настройте vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "server-withdrawal-example.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server-withdrawal-example.js"
    }
  ]
}

# Деплой
vercel --prod
```

## Мониторинг и логирование

### Логи сервера

Сервер логирует все важные события:

- Получение запросов на вывод
- Проверка подписей
- Отправка уведомлений
- Ошибки

### Мониторинг в продакшене

Рекомендуется настроить:

- Мониторинг доступности API
- Алерты на ошибки
- Логирование всех операций
- Метрики производительности

## Возможные проблемы

### 1. Ошибка CORS

Убедитесь, что CORS настроен правильно в сервере:

```javascript
app.use(cors({
    origin: ['https://telegram.org', 'https://your-domain.com'],
    credentials: true
}));
```

### 2. Неверная подпись

Проверьте, что секретный ключ одинаковый в клиенте и на сервере.

### 3. Бот не отвечает

Проверьте токен бота и доступность Telegram API.

### 4. Ошибки в консоли

Откройте консоль браузера (F12) для отладки клиентского кода.

## Дополнительные возможности

### База данных

Для сохранения заявок добавьте интеграцию с базой данных:

```javascript
// Пример с MongoDB
const { MongoClient } = require('mongodb');

async function saveWithdrawalRequest(data) {
    const client = new MongoClient(process.env.DATABASE_URL);
    await client.connect();
    
    const db = client.db('maniac_stars');
    const collection = db.collection('withdrawals');
    
    await collection.insertOne({
        ...data,
        status: 'pending',
        created_at: new Date()
    });
    
    await client.close();
}
```

### Админ панель

Создайте веб-интерфейс для управления заявками на вывод.

### Уведомления администратора

Добавьте уведомления администратора о новых заявках.

## Поддержка

При возникновении проблем:

1. Проверьте логи сервера
2. Проверьте консоль браузера
3. Убедитесь в правильности настройки переменных окружения
4. Проверьте доступность API эндпоинтов
