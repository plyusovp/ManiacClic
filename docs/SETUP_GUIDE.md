# Руководство по настройке вывода звёзд

## ⚠️ ВНИМАНИЕ: Устаревшая документация

Этот файл содержит устаревшую информацию. Для новой интеграции с HMAC-SHA256 подписями используйте:

**📖 [WITHDRAWAL_INTEGRATION_GUIDE.md](./WITHDRAWAL_INTEGRATION_GUIDE.md)**

## Проблема
При попытке вывести звёзды в боте показывается сообщение "всё успешно переслано", но звёзды не зачисляются в боте.

## Решение

### 1. Настройка API URL

Откройте файл `docs/api_config.js` и замените URL на ваш реальный адрес сервера:

```javascript
// Замените на ваш реальный URL сервера
const API_URL = "https://your-bot-server.com/api/withdraw";

// Или используйте один из вариантов ниже:
// const API_URL = "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage";
// const API_URL = "http://localhost:8080/create_withdrawal";
// const API_URL = "https://your-domain.com/api/withdraw";
```

### 2. Настройка сервера

Ваш сервер должен принимать POST запросы на endpoint `/api/withdraw` (или другой, указанный в API_URL) со следующими данными:

```json
{
  "amount": 200,
  "app_transaction_id": "tx_1234567890",
  "initData": "user=%7B%22id%22%3A123456789%2C...",
  "user_id": 123456789,
  "username": "username",
  "first_name": "Имя",
  "last_name": "Фамилия"
}
```

### 3. Пример серверного кода (Node.js/Express)

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/withdraw', async (req, res) => {
  try {
    const { amount, user_id, initData } = req.body;
    
    // Валидация данных
    if (!amount || !user_id) {
      return res.status(400).json({ error: 'Недостаточно данных' });
    }
    
    // Здесь должна быть логика зачисления звёзд в боте
    // Например, отправка сообщения пользователю через Telegram Bot API
    
    const botStars = amount / 200; // Конвертация в звёзды бота
    
    // Отправка уведомления пользователю
    await sendTelegramMessage(user_id, `⭐ Вам зачислено ${botStars} звёзд!`);
    
    res.json({ 
      success: true, 
      message: `Зачислено ${botStars} звёзд`,
      stars: botStars 
    });
    
  } catch (error) {
    console.error('Ошибка вывода:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

async function sendTelegramMessage(userId, message) {
  const BOT_TOKEN = 'YOUR_BOT_TOKEN';
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: userId,
      text: message
    })
  });
}

app.listen(8080, () => {
  console.log('Сервер запущен на порту 8080');
});
```

### 4. Настройка CORS

Убедитесь, что ваш сервер поддерживает CORS для запросов с веб-приложения:

```javascript
const cors = require('cors');
app.use(cors({
  origin: ['https://your-webapp-domain.com', 'https://telegram.org'],
  credentials: true
}));
```

### 5. Отладка

1. Откройте консоль браузера (F12)
2. Попробуйте вывести звёзды
3. Проверьте логи в консоли - там будут подробные сообщения об ошибках
4. Убедитесь, что:
   - URL в `api_config.js` правильный
   - Сервер запущен и доступен
   - CORS настроен корректно
   - API endpoint принимает POST запросы

### 6. Проверка работы

После настройки сервера:
1. Откройте приложение в Telegram
2. Попробуйте вывести звёзды
3. Проверьте консоль на наличие ошибок
4. Убедитесь, что сервер получает запросы
5. Проверьте, что звёзды зачисляются в боте

## Возможные проблемы

1. **Неправильный URL** - проверьте `api_config.js`
2. **Сервер недоступен** - убедитесь, что сервер запущен
3. **CORS ошибки** - настройте CORS на сервере
4. **Неправильный формат данных** - проверьте структуру запроса
5. **Проблемы с Telegram API** - убедитесь, что токен бота правильный

## Дополнительные настройки

Для продакшена рекомендуется:
- Использовать HTTPS
- Добавить аутентификацию
- Логировать все операции
- Добавить валидацию данных
- Настроить rate limiting
