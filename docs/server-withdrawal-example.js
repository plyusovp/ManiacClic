// server-withdrawal-example.js
// Пример серверного кода для обработки запросов на вывод звёзд

// Загружаем переменные окружения из .env файла
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Секретный ключ для подписи (в продакшене должен храниться в переменных окружения)
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-here';

// Настройка CORS для работы с Telegram WebApp
app.use(cors({
    origin: ['https://telegram.org', 'http://localhost:*', 'https://localhost:*'],
    credentials: true
}));

app.use(express.json());

/**
 * Генерация HMAC-SHA256 подписи
 * @param {string} data - Данные для подписи
 * @param {string} secret - Секретный ключ
 * @returns {string} HMAC подпись в hex формате
 */
function generateHMACSignature(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Проверка подписи запроса
 * @param {string} user_id - ID пользователя
 * @param {number} amount - Сумма вывода
 * @param {string} app_transaction_id - ID транзакции
 * @param {string} signature - Подпись от клиента
 * @returns {boolean} Результат проверки
 */
function verifySignature(user_id, amount, app_transaction_id, signature) {
    const data = `${user_id}_${amount}_${app_transaction_id}`;
    const expectedSignature = generateHMACSignature(data, SECRET_KEY);
    
    console.log('Проверка подписи:');
    console.log('Данные:', data);
    console.log('Ожидаемая подпись:', expectedSignature);
    console.log('Полученная подпись:', signature);
    
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
    );
}

/**
 * Отправка сообщения пользователю через Telegram Bot API
 * @param {number} userId - ID пользователя
 * @param {string} message - Сообщение
 * @returns {Promise<boolean>} Результат отправки
 */
async function sendTelegramMessage(userId, message) {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.error('BOT_TOKEN не установлен');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        
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
        
        if (!response.ok) {
            const error = await response.text();
            console.error('Ошибка отправки сообщения в Telegram:', error);
            return false;
        }
        
        const result = await response.json();
        console.log('Сообщение отправлено:', result);
        return true;
        
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        return false;
    }
}

// Эндпоинт для создания заявки на вывод
app.post('/api/withdrawal/create', async (req, res) => {
    try {
        console.log('Получен запрос на вывод:', req.body);
        
        const { user_id, amount, app_transaction_id, signature } = req.body;
        
        // Валидация входных данных
        if (!user_id || !amount || !app_transaction_id || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Недостаточно данных для создания заявки'
            });
        }
        
        // Проверка суммы
        if (amount < 200 || amount % 200 !== 0) {
            return res.status(400).json({
                success: false,
                error: 'Сумма должна быть кратна 200 и не менее 200'
            });
        }
        
        // Проверка подписи
        if (!verifySignature(user_id, amount, app_transaction_id, signature)) {
            console.error('Неверная подпись для пользователя:', user_id);
            return res.status(401).json({
                success: false,
                error: 'Неверная подпись запроса'
            });
        }
        
        // Здесь должна быть логика проверки баланса пользователя
        // и создания заявки в базе данных
        // Для примера просто логируем данные
        
        const botStars = amount / 200;
        const timestamp = new Date().toISOString();
        
        console.log('Создание заявки на вывод:', {
            user_id,
            amount,
            app_transaction_id,
            botStars,
            timestamp
        });
        
        // Отправляем уведомление пользователю
        const message = `🎉 <b>Заявка на вывод создана!</b>\n\n` +
                       `💰 Сумма: ${amount} ⭐\n` +
                       `📊 Звёзд в боте: ${botStars}\n` +
                       `🆔 ID транзакции: ${app_transaction_id}\n` +
                       `⏰ Время: ${timestamp}\n\n` +
                       `Заявка отправлена на рассмотрение администратору.`;
        
        // Пытаемся отправить уведомление, но не блокируем успешный ответ
        const messageSent = await sendTelegramMessage(user_id, message);
        
        if (messageSent) {
            console.log('Заявка успешно создана и уведомление отправлено');
        } else {
            console.log('Заявка создана, но уведомление не отправлено (пользователь может не писать боту)');
        }
        
        // В реальном приложении здесь нужно сохранить заявку в базу данных
        console.log('Заявка на вывод создана:', {
            user_id,
            amount,
            app_transaction_id,
            botStars,
            timestamp
        });
        
        res.json({
            success: true,
            message: 'Заявка на вывод успешно создана',
            data: {
                transaction_id: app_transaction_id,
                amount: amount,
                bot_stars: botStars,
                timestamp: timestamp
            }
        });
        
    } catch (error) {
        console.error('Ошибка при создании заявки на вывод:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

// Эндпоинт для проверки статуса сервера
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Эндпоинт для получения информации о сервере
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Maniac Stars Bot API',
        version: '1.0.0',
        endpoints: [
            'POST /api/withdrawal/create - Создание заявки на вывод',
            'GET /api/health - Проверка статуса',
            'GET /api/info - Информация о сервере'
        ],
        secret_key_configured: !!SECRET_KEY && SECRET_KEY !== 'your-secret-key-here',
        bot_token_configured: !!process.env.BOT_TOKEN
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api`);
    console.log(`🔑 Секретный ключ настроен: ${!!SECRET_KEY && SECRET_KEY !== 'your-secret-key-here'}`);
    console.log(`🤖 Токен бота настроен: ${!!process.env.BOT_TOKEN}`);
    console.log('');
    console.log('Доступные эндпоинты:');
    console.log(`  POST http://localhost:${PORT}/api/withdrawal/create`);
    console.log(`  GET  http://localhost:${PORT}/api/health`);
    console.log(`  GET  http://localhost:${PORT}/api/info`);
});

module.exports = app;
