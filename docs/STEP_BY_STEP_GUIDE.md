# 📋 Пошаговый план настройки сервера для вывода звёзд

## 🎯 Цель
Настроить сервер, который будет принимать запросы от кликера и зачислять звёзды в Telegram боте.

---

## 📝 Шаг 1: Создание базового сервера

### 1.1 Создайте новую папку для сервера
```bash
mkdir telegram-bot-server
cd telegram-bot-server
```

### 1.2 Инициализируйте Node.js проект
```bash
npm init -y
```

### 1.3 Установите необходимые зависимости
```bash
npm install express cors dotenv
npm install --save-dev nodemon
```

### 1.4 Создайте файл `.env` для конфигурации
```env
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
PORT=8080
NODE_ENV=development
```

### 1.5 Создайте файл `server.js`
```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: [
    'https://telegram.org',
    'https://web.telegram.org',
    'https://your-domain.com' // Замените на ваш домен
  ],
  credentials: true
}));
app.use(express.json());

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.json({ message: 'Сервер работает!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
```

---

## 📝 Шаг 2: Создание API endpoint для вывода

### 2.1 Добавьте в `server.js` функцию для работы с Telegram
```javascript
// Функция для отправки сообщений через Telegram Bot API
async function sendTelegramMessage(userId, message) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: userId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const result = await response.json();
    console.log('Telegram API ответ:', result);
    return result;
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error);
    throw error;
  }
}
```

### 2.2 Добавьте endpoint для вывода звёзд
```javascript
// Endpoint для вывода звёзд
app.post('/api/withdraw', async (req, res) => {
  try {
    console.log('📨 Получен запрос на вывод:', req.body);
    
    const { 
      amount, 
      user_id, 
      username, 
      first_name, 
      last_name,
      initData 
    } = req.body;
    
    // Валидация данных
    if (!amount || !user_id) {
      return res.status(400).json({ 
        error: 'Недостаточно данных',
        details: 'Отсутствуют amount или user_id'
      });
    }
    
    // Конвертация в звёзды бота (200 игровых звёзд = 1 звезда бота)
    const botStars = Math.floor(amount / 200);
    
    if (botStars < 1) {
      return res.status(400).json({ 
        error: 'Недостаточная сумма',
        details: 'Минимум 200 игровых звёзд для вывода'
      });
    }
    
    // Отправляем уведомление пользователю
    const message = `⭐ <b>Зачислено звёзд!</b>\n\n` +
                   `💰 Сумма: ${amount} игровых звёзд\n` +
                   `⭐ Звёзд в боте: ${botStars}\n` +
                   `👤 Пользователь: ${first_name || 'Неизвестно'}\n` +
                   `🕐 Время: ${new Date().toLocaleString('ru-RU')}`;
    
    const telegramResult = await sendTelegramMessage(user_id, message);
    
    // Логируем успешную операцию
    console.log('✅ Звёзды зачислены:', {
      user_id,
      username,
      amount,
      botStars,
      timestamp: new Date().toISOString()
    });
    
    // Возвращаем успешный ответ
    res.json({
      success: true,
      message: `Зачислено ${botStars} звёзд в боте`,
      data: {
        user_id,
        amount,
        botStars,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка при выводе звёзд:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      details: error.message
    });
  }
});
```

---

## 📝 Шаг 3: Настройка интеграции с Telegram

### 3.1 Получите токен бота
1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный токен

### 3.2 Обновите файл `.env`
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
PORT=8080
NODE_ENV=development
```

### 3.3 Добавьте обработку ошибок Telegram API
```javascript
// Добавьте в server.js после функции sendTelegramMessage
async function validateTelegramToken() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN не настроен в .env файле');
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Неверный токен бота: ${result.description}`);
    }
    
    console.log('✅ Токен бота валиден:', result.result.username);
    return result.result;
  } catch (error) {
    console.error('❌ Ошибка валидации токена:', error);
    throw error;
  }
}
```

---

## 📝 Шаг 4: Настройка CORS для Telegram WebApp

### 4.1 Обновите настройки CORS в `server.js`
```javascript
// Замените существующую настройку CORS на эту:
app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы от Telegram и вашего домена
    const allowedOrigins = [
      'https://telegram.org',
      'https://web.telegram.org',
      'https://your-domain.com', // Замените на ваш домен
      'https://your-app.vercel.app', // Если используете Vercel
      'https://your-app.netlify.app' // Если используете Netlify
    ];
    
    // Разрешаем запросы без origin (например, мобильные приложения)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 Заблокирован origin:', origin);
      callback(new Error('Не разрешено CORS политикой'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

---

## 📝 Шаг 5: Обновление конфигурации клиента

### 5.1 Обновите `docs/api_config.js`
```javascript
// docs/api_config.js
// Замените на ваш реальный URL сервера
const API_URL = "http://localhost:8080/api/withdraw"; // Для локальной разработки

// Для продакшена используйте:
// const API_URL = "https://your-domain.com/api/withdraw";
// const API_URL = "https://your-app.herokuapp.com/api/withdraw";
// const API_URL = "https://your-app.vercel.app/api/withdraw";
```

---

## 📝 Шаг 6: Тестирование

### 6.1 Запустите сервер
```bash
# В папке telegram-bot-server
node server.js
```

### 6.2 Проверьте работу сервера
Откройте в браузере: `http://localhost:8080`
Должно появиться: `{"message":"Сервер работает!"}`

### 6.3 Протестируйте API endpoint
```bash
curl -X POST http://localhost:8080/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 200,
    "user_id": 123456789,
    "username": "testuser",
    "first_name": "Тест",
    "initData": "test"
  }'
```

### 6.4 Проверьте в Telegram
1. Откройте ваше приложение в Telegram
2. Попробуйте вывести звёзды
3. Проверьте консоль браузера на ошибки
4. Убедитесь, что сообщение пришло в бот

---

## 🚀 Деплой на продакшен

### Вариант 1: Heroku
```bash
# Установите Heroku CLI
npm install -g heroku

# Создайте приложение
heroku create your-app-name

# Добавьте переменные окружения
heroku config:set BOT_TOKEN=your_bot_token

# Деплой
git push heroku main
```

### Вариант 2: Vercel
```bash
# Установите Vercel CLI
npm install -g vercel

# Деплой
vercel --prod
```

### Вариант 3: Railway
```bash
# Установите Railway CLI
npm install -g @railway/cli

# Деплой
railway login
railway init
railway up
```

---

## 🔧 Отладка проблем

### Проблема: CORS ошибки
**Решение:** Проверьте настройки CORS и добавьте ваш домен в allowedOrigins

### Проблема: 404 ошибка
**Решение:** Убедитесь, что URL в api_config.js правильный

### Проблема: Telegram API не отвечает
**Решение:** Проверьте токен бота и интернет соединение

### Проблема: Звёзды не зачисляются
**Решение:** Проверьте логи сервера и убедитесь, что бот может отправлять сообщения пользователю

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте консоль браузера (F12)
2. Проверьте логи сервера
3. Убедитесь, что все URL правильные
4. Проверьте, что токен бота валиден
