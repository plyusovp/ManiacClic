// docs/api_config.js
// Конфигурация API для вывода звёзд

// ВАЖНО: Замените на ваш реальный URL сервера!
// Для локальной разработки:
const API_URL = "http://localhost:8080/api/withdrawal/create";

// Для продакшена (раскомментируйте нужный):
// const API_URL = "https://your-domain.com/api/withdrawal/create";
// const API_URL = "https://your-app.herokuapp.com/api/withdrawal/create";
// const API_URL = "https://your-app.vercel.app/api/withdrawal/create";
// const API_URL = "https://your-app.railway.app/api/withdrawal/create";

// Инструкция по настройке:
// 1. Создайте сервер используя server-example.js
// 2. Получите токен бота у @BotFather
// 3. Настройте .env файл с токеном и секретным ключом
// 4. Запустите сервер: npm start
// 5. Обновите URL выше на ваш реальный адрес
// 6. Убедитесь, что секретный ключ в getSecretKey() совпадает с ключом на сервере

// Экспортируем URL для использования в main.js
window.API_URL = API_URL;

