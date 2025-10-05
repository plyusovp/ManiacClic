const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
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
app.use(express.json());

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

// Валидация токена бота
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

// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.json({ 
    message: 'Сервер работает!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

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

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Ошибка сервера:', error);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: error.message
  });
});

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  // Проверяем токен бота при запуске
  try {
    await validateTelegramToken();
  } catch (error) {
    console.error('⚠️ Предупреждение: Проблема с токеном бота:', error.message);
  }
});
