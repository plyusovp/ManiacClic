# ⭐ Maniac Click - Telegram WebApp Game

Космический кликер с 3D звёздами, игрой Краш и системой вывода звёзд в Telegram боте.

![Maniac Click](https://img.shields.io/badge/Game-Maniac%20Click-blue)
![Telegram](https://img.shields.io/badge/Platform-Telegram%20WebApp-blue)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![Three.js](https://img.shields.io/badge/3D-Three.js-green)

## 🎮 Особенности

- **3D Звёзды** - Интерактивная 3D модель с анимациями
- **Игра Краш** - Азартная игра с множителями и графиком
- **Система энергии** - Реалистичная механика восстановления
- **Вывод звёзд** - Интеграция с Telegram ботом
- **Адаптивный дизайн** - Работает на всех устройствах

## 🚀 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone https://github.com/your-username/maniac-click.git
cd maniac-click
```

### 2. Настройка веб-приложения
Откройте `docs/index.html` в браузере или загрузите на хостинг.

### 3. Настройка сервера для вывода звёзд

#### Создайте сервер:
```bash
mkdir telegram-bot-server
cd telegram-bot-server
```

#### Установите зависимости:
```bash
npm install express cors dotenv
```

#### Скопируйте файлы сервера:
- `docs/server-example.js` → `server.js`
- `docs/package.json` → `package.json`
- `docs/env.example` → `.env`

#### Настройте токен бота:
1. Получите токен у [@BotFather](https://t.me/BotFather)
2. Обновите файл `.env`:
```env
BOT_TOKEN=ваш_токен_здесь
PORT=8080
```

#### Запустите сервер:
```bash
npm start
```

## 📁 Структура проекта

```
maniac-click/
├── docs/                          # Основные файлы приложения
│   ├── index.html                 # Главная страница
│   ├── main.js                    # Основная логика игры
│   ├── style.css                  # Стили
│   ├── api_config.js              # Конфигурация API
│   ├── server-example.js          # Пример серверного кода
│   ├── package.json               # Зависимости сервера
│   ├── env.example                # Пример конфигурации
│   ├── SETUP_GUIDE.md             # Руководство по настройке
│   └── STEP_BY_STEP_GUIDE.md      # Пошаговая инструкция
├── README.md                      # Этот файл
└── .gitignore                     # Игнорируемые файлы
```

## 🎯 Игровые механики

### Кликер
- Кликайте по 3D звезде для получения очков
- Тратьте энергию на каждый клик
- Энергия восстанавливается автоматически

### Игра Краш
- Делайте ставки перед началом раунда
- Наблюдайте за ростом множителя
- Выводите выигрыш до краша

### Вывод звёзд
- Конвертация: 200 игровых звёзд = 1 звезда бота
- Комиссия: 5-7% в зависимости от суммы
- Уведомления в Telegram боте

## 🔧 Настройка

### Конфигурация API
Обновите `docs/api_config.js`:
```javascript
// Для локальной разработки
const API_URL = "http://localhost:8080/api/withdraw";

// Для продакшена
const API_URL = "https://your-domain.com/api/withdraw";
```

### Настройка CORS
В файле сервера добавьте ваш домен:
```javascript
const allowedOrigins = [
  'https://telegram.org',
  'https://web.telegram.org',
  'https://your-domain.com' // Ваш домен
];
```

## 🌐 Деплой

### Vercel (рекомендуется)
```bash
npm install -g vercel
vercel --prod
```

### Netlify
1. Подключите GitHub репозиторий
2. Настройте build команду: `npm run build`
3. Deploy

### Heroku
```bash
heroku create your-app-name
git push heroku main
```

## 📱 Telegram WebApp

### Создание бота
1. Найдите [@BotFather](https://t.me/BotFather)
2. Создайте нового бота: `/newbot`
3. Настройте WebApp: `/newapp`
4. Укажите URL вашего приложения

### Настройка меню
```
/setmenubutton
@your_bot_name
🎮 Играть
```

## 🛠️ Разработка

### Требования
- Node.js 16+
- Современный браузер
- Telegram Bot Token

### Установка зависимостей
```bash
cd telegram-bot-server
npm install
```

### Запуск в режиме разработки
```bash
npm run dev
```

## 📊 API Endpoints

### POST /api/withdraw
Вывод звёзд в бота

**Запрос:**
```json
{
  "amount": 200,
  "user_id": 123456789,
  "username": "user",
  "first_name": "Имя",
  "initData": "telegram_init_data"
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Зачислено 1 звёзд в боте",
  "data": {
    "user_id": 123456789,
    "amount": 200,
    "botStars": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🔒 Безопасность

- Валидация данных Telegram WebApp
- Проверка подписи initData
- Rate limiting для API
- CORS защита

## 🐛 Отладка

### Консоль браузера
Откройте F12 и проверьте:
- Ошибки JavaScript
- Сетевые запросы
- Данные Telegram WebApp

### Логи сервера
```bash
# Проверка работы сервера
curl http://localhost:8080

# Тест API
curl -X POST http://localhost:8080/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount":200,"user_id":123456789}'
```

## 📈 Мониторинг

### Логи
- Успешные выводы
- Ошибки API
- Статистика пользователей

### Метрики
- Количество выводов
- Суммы транзакций
- Активность пользователей

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch: `git checkout -b feature/new-feature`
3. Commit изменения: `git commit -am 'Add new feature'`
4. Push в branch: `git push origin feature/new-feature`
5. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 👨‍💻 Автор

**Your Name**
- GitHub: [@your-username](https://github.com/your-username)
- Telegram: [@your-telegram](https://t.me/your-telegram)

## 🙏 Благодарности

- [Three.js](https://threejs.org/) - 3D графика
- [Chart.js](https://www.chartjs.org/) - Графики
- [Telegram WebApp API](https://core.telegram.org/bots/webapps)

## 📞 Поддержка

Если у вас возникли вопросы:
1. Проверьте [FAQ](docs/SETUP_GUIDE.md)
2. Создайте [Issue](https://github.com/your-username/maniac-click/issues)
3. Напишите в [Telegram](https://t.me/your-telegram)

---

⭐ **Поставьте звезду, если проект вам понравился!**
