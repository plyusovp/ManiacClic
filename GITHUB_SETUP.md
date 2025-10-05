# 🚀 Загрузка проекта на GitHub

## 📋 Пошаговая инструкция

### 1. Создание репозитория на GitHub

1. **Перейдите на GitHub.com** и войдите в свой аккаунт
2. **Нажмите кнопку "New"** или "+" → "New repository"
3. **Заполните форму:**
   - Repository name: `maniac-click`
   - Description: `Космический кликер с 3D звёздами и игрой Краш для Telegram`
   - Visibility: Public (или Private)
   - ✅ Add a README file (НЕ ставьте галочку, так как у нас уже есть README.md)
   - ✅ Add .gitignore (НЕ ставьте галочку, так как у нас уже есть .gitignore)
   - ✅ Choose a license (опционально)
4. **Нажмите "Create repository"**

### 2. Подключение локального репозитория к GitHub

После создания репозитория GitHub покажет инструкции. Выполните команды:

```bash
# Добавляем удалённый репозиторий (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/maniac-click.git

# Переименовываем основную ветку в main (если нужно)
git branch -M main

# Загружаем код на GitHub
git push -u origin main
```

### 3. Альтернативный способ через GitHub CLI

Если у вас установлен GitHub CLI:

```bash
# Создание репозитория через CLI
gh repo create maniac-click --public --description "Космический кликер с 3D звёздами и игрой Краш для Telegram"

# Загрузка кода
git push -u origin main
```

### 4. Проверка загрузки

После выполнения команд:
1. Обновите страницу репозитория на GitHub
2. Убедитесь, что все файлы загружены
3. Проверьте, что README.md отображается корректно

## 📁 Структура загруженного проекта

Ваш репозиторий должен содержать:

```
maniac-click/
├── .gitignore                     # Игнорируемые файлы
├── README.md                      # Описание проекта
├── GITHUB_SETUP.md               # Эта инструкция
├── docs/                          # Основные файлы
│   ├── index.html                 # Главная страница
│   ├── main.js                    # Логика игры
│   ├── style.css                  # Стили
│   ├── api_config.js              # Конфигурация API
│   ├── server-example.js          # Пример сервера
│   ├── package.json               # Зависимости
│   ├── env.example                # Пример конфигурации
│   ├── SETUP_GUIDE.md             # Руководство по настройке
│   ├── STEP_BY_STEP_GUIDE.md      # Пошаговая инструкция
│   └── Galactic_Starburst_0923140405_texture.glb  # 3D модель
```

## 🌐 Настройка GitHub Pages (опционально)

Для автоматического хостинга на GitHub Pages:

1. **Перейдите в Settings** вашего репозитория
2. **Найдите раздел "Pages"** в левом меню
3. **В разделе "Source"** выберите:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /docs
4. **Нажмите "Save"**
5. **Дождитесь деплоя** (обычно 1-2 минуты)
6. **Ваш сайт будет доступен по адресу:** `https://YOUR_USERNAME.github.io/maniac-click/`

## 🔗 Полезные ссылки

После загрузки у вас будет:

- **Репозиторий:** `https://github.com/YOUR_USERNAME/maniac-click`
- **GitHub Pages:** `https://YOUR_USERNAME.github.io/maniac-click/` (если настроили)
- **Issues:** `https://github.com/YOUR_USERNAME/maniac-click/issues`
- **Wiki:** `https://github.com/YOUR_USERNAME/maniac-click/wiki`

## 📝 Следующие шаги

1. **Обновите README.md** - замените `YOUR_USERNAME` на ваш реальный username
2. **Настройте Issues** - включите шаблоны для bug reports и feature requests
3. **Добавьте теги** - используйте теги для категоризации коммитов
4. **Настройте Actions** - добавьте CI/CD для автоматического тестирования
5. **Создайте Releases** - для публикации новых версий

## 🛠️ Команды для дальнейшей работы

```bash
# Клонирование репозитория на другом компьютере
git clone https://github.com/YOUR_USERNAME/maniac-click.git

# Обновление локальной копии
git pull origin main

# Создание новой ветки для разработки
git checkout -b feature/new-feature

# Загрузка изменений
git add .
git commit -m "Описание изменений"
git push origin feature/new-feature
```

## 🎉 Готово!

Теперь ваш проект Maniac Click доступен на GitHub со всеми файлами, документацией и инструкциями по настройке!
