# ManiacClic - Telegram WebApp Game

Игра-кликер для Telegram с интеграцией API бота для вывода звёзд.

## 🚀 Быстрый старт

### 1. Установка и запуск сервера

```bash
cd docs
npm install
cp env.example .env
npm start
```

### 2. Проверка работы

Откройте в браузере: http://localhost:8080/api/health

### 3. Тестирование в Telegram

1. Откройте приложение в Telegram WebApp
2. Перейдите в раздел "Вывод"
3. Выберите сумму и подтвердите вывод
4. Проверьте уведомление в боте

## 📁 Структура проекта

```
ManiacClic/
├── docs/
│   ├── index.html              # Основной HTML файл
│   ├── main.js                 # Логика приложения и API интеграция
│   ├── style.css               # Стили
│   ├── api_config.js           # Конфигурация API
│   ├── server-withdrawal-example.js  # Сервер для обработки выводов
│   ├── package.json            # Зависимости Node.js
│   ├── env.example             # Пример переменных окружения
│   ├── .env                    # Переменные окружения (создается автоматически)
│   └── WITHDRAWAL_INTEGRATION_GUIDE.md  # Подробная документация
├── README.md                   # Этот файл
└── GITHUB_SETUP.md             # Инструкции по настройке GitHub
```

## 🔧 Настройка

### Переменные окружения

Файл `.env` уже настроен с вашими данными:

```env
BOT_TOKEN=8062263060:AAF4RbvNQuAn6Zx-IHv3kNf615iuwnttKC0
SECRET_KEY=maniac-stars-secret-key-2024
PORT=8080
```

### API Endpoints

- `GET /api/health` - Проверка статуса сервера
- `GET /api/info` - Информация о сервере
- `POST /api/withdrawal/create` - Создание заявки на вывод

## 🎮 Игровые функции

- **Кликер** - кликайте по звезде для заработка
- **Энергия** - ограничивает количество кликов
- **Краш** - игра на множители
- **Вывод** - интеграция с Telegram ботом

## 🔒 Безопасность

- HMAC-SHA256 подписи для всех запросов
- Валидация данных на сервере
- Уникальные ID транзакций
- Проверка подписей с защитой от timing атак

## 📊 Мониторинг

### Логи сервера

Сервер выводит подробные логи всех операций:

```
🚀 Сервер запущен на порту 8080
📊 API доступно по адресу: http://localhost:8080/api
🔑 Секретный ключ настроен: true
🤖 Токен бота настроен: true
```

### Проверка статуса

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/info
```

## 🚀 Развертывание в продакшене

### Heroku

```bash
heroku create your-app-name
heroku config:set BOT_TOKEN=your_bot_token
heroku config:set SECRET_KEY=your_secret_key
git push heroku main
```

### Railway

```bash
railway login
railway init
# Настройте переменные в панели Railway
railway up
```

### Vercel

```bash
npm i -g vercel
vercel --prod
```

## 📱 Интеграция с Telegram

### WebApp

Приложение работает как Telegram WebApp и получает данные пользователя через `window.Telegram.WebApp`.

### Bot API

Сервер отправляет уведомления пользователям через Telegram Bot API.

### Формат уведомления

```
🎉 Заявка на вывод создана!

💰 Сумма: 200 ⭐
📊 Звёзд в боте: 1
🆔 ID транзакции: tx_1234567890_abc123
⏰ Время: 2024-01-15T10:30:00.000Z

Заявка отправлена на рассмотрение администратору.
```

## 🛠️ Разработка

### Структура API

```javascript
// Создание заявки на вывод
const response = await fetch('/api/withdrawal/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        user_id: 123456789,
        amount: 200,
        app_transaction_id: 'tx_1234567890_abc123',
        signature: 'hmac_signature_here'
    })
});
```

### Генерация подписи

```javascript
const signature = await crypto.subtle.sign('HMAC', key, messageData);
```

## 📖 Документация

- [WITHDRAWAL_INTEGRATION_GUIDE.md](docs/WITHDRAWAL_INTEGRATION_GUIDE.md) - Подробное руководство по интеграции
- [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) - Устаревшее руководство (ссылается на новое)

## 🐛 Отладка

### Консоль браузера

Откройте F12 → Console для просмотра логов клиента.

### Логи сервера

Все операции логируются в терминал сервера.

### Проверка переменных

```bash
curl http://localhost:8080/api/info
```

## 📄 Лицензия

MIT License

## 🤝 Поддержка

При возникновении проблем:

1. Проверьте логи сервера
2. Проверьте консоль браузера
3. Убедитесь в правильности переменных окружения
4. Проверьте доступность API эндпоинтов

---

**Статус:** ✅ Готово к использованию
**Сервер:** 🟢 Запущен на http://localhost:8080
**GitHub:** 🔗 https://github.com/plyusovp/ManiacClic