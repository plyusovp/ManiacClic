document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram Web App
    const tg = window.Telegram.WebApp;
    try {
        tg.ready();
        tg.expand();
    } catch (e) {
        console.error("Telegram Web App API not available.", e);
    }

    // --- ОБЩИЕ ЭЛЕМЕНТЫ И СОСТОЯНИЕ ---
    window.config = {
        maxEnergy: 200,
        energyPerClick: 1,
        starPerClick: 1,
        energyRegenRate: 1,
        energyRegenInterval: 20000 // Теперь 1 единица раз в 20 секунд
    };

    window.gameState = {
        balance: 0,
        energy: window.config.maxEnergy,
        lastUpdate: Date.now(),
        withdrawalsToday: {
            count: 0,
            date: new Date().toLocaleDateString()
        }
    };

    // --- ЭЛЕМЕНТЫ DOM ---
    const loadingScreen = document.getElementById('loading-screen');
    const gameScreen = document.getElementById('game-screen');
    const withdrawScreen = document.getElementById('withdraw-screen');
    const goToWithdrawBtn = document.getElementById('go-to-withdraw');
    const backButton = document.getElementById('back-from-withdraw');
    const notification = document.getElementById('notification');
    const successModal = document.getElementById('success-modal');
    const balanceCounter = document.getElementById('balance-counter');
    const energyBar = document.getElementById('energy-bar');
    const energyCounter = document.getElementById('energy-counter');

    // --- THREE.JS ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let scene, camera, renderer, starMesh, pointLight;
    let energyRegenIntervalId = null;
    let animationFrameId = null;
    
    // Переменные для плавной анимации
    const BASE_SCALE = 2.5;
    let targetScale = BASE_SCALE;
    let baseRotation = new THREE.Euler(0, -Math.PI / 2, 0); 
    let targetRotation = baseRotation.clone();
    
    // Цветовые переменные для анимации
    const colorStart = new THREE.Color(0xff0000);
    const colorEnd = new THREE.Color(0x0000ff);
    const bgColorStart = new THREE.Color(0x110000);
    const bgColorEnd = new THREE.Color(0x000011);
    let colorPhase = 0;
    
    // --- ФУНКЦИИ УПРАВЛЕНИЯ ЭКРАНАМИ ---
    function showScreen(screen) {
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (gameScreen) gameScreen.classList.add('hidden');
        if (withdrawScreen) withdrawScreen.classList.add('hidden');
        
        // Добавляем поддержку экрана Краш
        const crashScreen = document.getElementById('crash-screen');
        if (crashScreen) crashScreen.classList.add('hidden');
        
        if (typeof screen === 'string') {
            const screenElement = document.getElementById(screen);
            if (screenElement) screenElement.classList.remove('hidden');
        } else if (screen) {
            screen.classList.remove('hidden');
        }
    }

    function hideLoadingScreen() {
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // Показываем игровой экран после скрытия загрузочного
            setTimeout(() => {
                showScreen(gameScreen);
            }, 300); // Небольшая задержка для плавного перехода
        }
    }

    function updateLoadingProgress(percent) {
        const progressBar = document.querySelector('.loading-progress');
        const loadingMessage = document.querySelector('.loading-message');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        if (loadingMessage) {
            if (percent < 30) {
                loadingMessage.textContent = 'Загружаем звёзды...';
            } else if (percent < 60) {
                loadingMessage.textContent = 'Подготавливаем космос...';
            } else if (percent < 90) {
                loadingMessage.textContent = 'Почти готово...';
            } else {
                loadingMessage.textContent = 'Завершаем загрузку...';
            }
        }
    }

    if (goToWithdrawBtn) {
        goToWithdrawBtn.addEventListener('click', () => {
            stopEnergyRegen();
            disposeThreeJSScene(); // Полностью очищаем сцену
            initWithdrawPage();
            showScreen(withdrawScreen);
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            updateBalanceUI();
            startEnergyRegen(); 
            initThreeJSScene(); // Заново инициализируем и запускаем 3D-сцену
            showScreen(gameScreen);
        });
    }

    // --- СОХРАНЕНИЕ / ЗАГРУЗКА ---
    window.saveState = function() {
        localStorage.setItem('maniacClicState', JSON.stringify(gameState));
    };

    function loadState() {
        const savedState = localStorage.getItem('maniacClicState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            gameState = { ...gameState, ...parsedState };

            // Проверка и сброс лимита вывода, если наступил новый день
            const today = new Date().toLocaleDateString();
            if (gameState.withdrawalsToday.date !== today) {
                gameState.withdrawalsToday.count = 0;
                gameState.withdrawalsToday.date = today;
            }

            const now = Date.now();
            const elapsedSeconds = Math.floor((now - gameState.lastUpdate) / 1000);
            const intervalsPassed = Math.floor(elapsedSeconds / (window.config.energyRegenInterval / 1000));

            if (intervalsPassed > 0) {
                const energyToRegen = intervalsPassed * window.config.energyRegenRate;
                gameState.energy = Math.min(window.config.maxEnergy, gameState.energy + energyToRegen);
            }
        }
        gameState.lastUpdate = Date.now();
        saveState();
    }
    
    // --- ОБНОВЛЕНИЕ UI И АНИМАЦИИ ---
    window.updateBalanceUI = function() {
        const balanceCounter = document.getElementById('balance-counter');
        if (balanceCounter) {
            balanceCounter.innerText = Math.floor(gameState.balance).toLocaleString('ru-RU');
        }
    };
    
    function updateEnergyUI() {
        const percentage = (gameState.energy / window.config.maxEnergy) * 100;
        const energyBar = document.getElementById('energy-bar');
        const energyCounter = document.getElementById('energy-counter');
        if (energyBar) {
            energyBar.style.width = `${percentage}%`;
        }
        if (energyCounter) {
            energyCounter.innerText = `${Math.floor(gameState.energy)}/${window.config.maxEnergy}`;
        }
    }

    function checkEnergy() {
        const starContainer = document.getElementById('star-container');
        if (starContainer) {
            starContainer.classList.toggle('disabled', gameState.energy < window.config.energyPerClick);
        }
    }

    function playClickAnimations(x, y) {
        const textAnim = document.createElement('div');
        textAnim.className = 'click-animation-text';
        textAnim.innerText = `+${window.config.starPerClick}`;
        document.body.appendChild(textAnim);
        textAnim.style.left = `${x - 15}px`;
        textAnim.style.top = `${y - 30}px`;
        setTimeout(() => textAnim.remove(), 1000);

        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            document.body.appendChild(particle);
            const size = Math.random() * 5 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            const angle = Math.random() * 360;
            const distance = Math.random() * 80 + 50;
            const endX = Math.cos(angle * Math.PI / 180) * distance;
            const endY = Math.sin(angle * Math.PI / 180) * distance;
            particle.style.setProperty('--x', `${endX}px`);
            particle.style.setProperty('--y', `${endY}px`);
            setTimeout(() => particle.remove(), 800);
        }
    }

    // --- ИНИЦИАЛИЗАЦИЯ ИГРОВОГО ЭКРАНА ---
    function initGamePage() {
        loadState();
        updateBalanceUI();
        updateEnergyUI();
        checkEnergy();
        initThreeJSScene();
        startEnergyRegen();
        // Не показываем игровой экран сразу - он будет показан после загрузки
    }

    // --- УПРАВЛЕНИЕ ТАЙМЕРОМ РЕГЕНЕРАЦИИ ---
    function startEnergyRegen() {
        stopEnergyRegen();
        energyRegenIntervalId = setInterval(() => {
            if (gameState.energy < window.config.maxEnergy) {
                gameState.energy = Math.min(window.config.maxEnergy, gameState.energy + window.config.energyRegenRate);
                gameState.lastUpdate = Date.now();
                updateEnergyUI();
                checkEnergy();
                saveState();
            }
        }, window.config.energyRegenInterval);
    }

    function stopEnergyRegen() {
        if (energyRegenIntervalId) {
            clearInterval(energyRegenIntervalId);
            energyRegenIntervalId = null;
        }
    }

    // --- ЛОГИКА THREE.JS ---
    function initThreeJSScene() {
        const container = document.getElementById('star-container');
        if (!container || !window.THREE) {
            return;
        }
        
        // Очищаем старый рендерер, если он существует
        if (renderer) {
            disposeThreeJSScene();
        }

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        pointLight = new THREE.PointLight(0xff0000, 1.5, 100);
        pointLight.position.set(0, 0, 5);
        scene.add(pointLight);
        
        const loader = new THREE.GLTFLoader();
        const modelPath = 'Galactic_Starburst_0923140405_texture.glb'; 

        loader.load(
            modelPath,
            function (gltf) {
                starMesh = gltf.scene;
                
                const box = new THREE.Box3().setFromObject(starMesh);
                const center = box.getCenter(new THREE.Vector3());
                starMesh.position.sub(center); 
                // Установка начального размера
                starMesh.scale.set(BASE_SCALE, BASE_SCALE, BASE_SCALE); 
                // Правильный поворот, чтобы звезда была "лицом" к камере.
                starMesh.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
                
                scene.add(starMesh);
                animate(); // Запускаем анимацию только после загрузки модели
                
                // Скрываем загрузочный экран после загрузки модели
                setTimeout(() => {
                    hideLoadingScreen();
                }, 500); // Небольшая задержка для плавного перехода
            },
            function (progress) {
                // Обновляем прогресс загрузки
                const percent = Math.round((progress.loaded / progress.total) * 100);
                updateLoadingProgress(percent);
            },
            function (error) {
                console.error('An error happened during model loading:', error);
                const geometry = new THREE.IcosahedronGeometry(1.5, 1);
                const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                starMesh = new THREE.Mesh(geometry, material);
                starMesh.scale.set(BASE_SCALE, BASE_SCALE, BASE_SCALE);
                starMesh.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
                scene.add(starMesh);
                animate(); // Запускаем анимацию, даже если модель не загрузилась
                
                // Скрываем загрузочный экран даже при ошибке
                setTimeout(() => {
                    hideLoadingScreen();
                }, 500);
            }
        );
        
        if (renderer.domElement) {
            renderer.domElement.addEventListener('click', onStarClick, false);
        }
        window.addEventListener('resize', onWindowResize, false);
    }
    
    // Функция для очистки и остановки сцены
    function disposeThreeJSScene() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (renderer) {
            renderer.dispose();
            renderer = null;
        }

        if (scene) {
            // Удаляем все объекты из сцены
            while (scene.children.length > 0) {
                scene.remove(scene.children[0]);
            }
            scene = null;
        }

        starMesh = null;
    }

    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        if (starMesh) {
            // Плавное изменение размера и вращения
            starMesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            starMesh.rotation.x = THREE.MathUtils.lerp(starMesh.rotation.x, targetRotation.x, 0.1);
            starMesh.rotation.y = THREE.MathUtils.lerp(starMesh.rotation.y, targetRotation.y, 0.1);
            starMesh.rotation.z = THREE.MathUtils.lerp(starMesh.rotation.z, targetRotation.z, 0.1);
        }

        if(pointLight){
            colorPhase = (Math.sin(Date.now() * 0.0005) + 1) / 2;
            const newColor = new THREE.Color();
            newColor.lerpColors(colorStart, colorEnd, colorPhase);
            pointLight.color = newColor;
        }

        // Плавное изменение цвета фона
        const bgElement = document.body;
        if(bgElement) {
            const newBgColor = new THREE.Color();
            newBgColor.lerpColors(bgColorStart, bgColorEnd, colorPhase);
            bgElement.style.backgroundColor = `#${newBgColor.getHexString()}`;
        }

        if (renderer) {
            renderer.render(scene, camera);
        }
    }

    function onStarClick(event) {
        if (!starMesh || gameState.energy < window.config.energyPerClick) {
            if (gameState.energy < window.config.energyPerClick) showNotification();
            return;
        }
        
        const container = document.getElementById('star-container');
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(starMesh, true);

        if (intersects.length > 0) {
            gameState.energy -= window.config.energyPerClick;
            gameState.balance += window.config.starPerClick;

            updateBalanceUI();
            updateEnergyUI();
            checkEnergy();
            
            // Задаем целевые значения для анимации
            targetScale = BASE_SCALE * 0.9; // Уменьшение размера
            targetRotation.x = baseRotation.x + (Math.random() - 0.5) * 0.2;
            targetRotation.y = baseRotation.y + (Math.random() - 0.5) * 0.2;
            targetRotation.z = baseRotation.z + (Math.random() - 0.5) * 0.2;

            // Возврат к исходным значениям после короткой задержки
            setTimeout(() => {
                targetScale = BASE_SCALE;
                targetRotation.copy(baseRotation);
            }, 120);
            
            playClickAnimations(event.clientX, event.clientY);
            saveState();
        }
    }

    function onWindowResize() {
        const container = document.getElementById('star-container');
        if (!container || !renderer) return;

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    // --- ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ВЫВОДА ---
    function initWithdrawPage() {
        // Проверяем, существуют ли все необходимые элементы
        const withdrawBalance = document.getElementById('withdraw-balance');
        const withdrawButtonsContainer = document.getElementById('withdraw-buttons-container');
        const withdrawStatusText = document.getElementById('withdraw-status-text');
        const withdrawInfo = document.getElementById('withdraw-info');
        const withdrawConfirmBtn = document.getElementById('withdraw-confirm-button');
        const withdrawsToday = document.getElementById('withdraws-today');
        
        if (!withdrawBalance || !withdrawButtonsContainer || !withdrawStatusText || !withdrawInfo || !withdrawConfirmBtn) {
            console.error("One or more withdrawal page elements not found.");
            return;
        }

        const withdrawAmounts = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200];
        const userBalance = Math.floor(gameState.balance);
        let selectedAmount = 0;
        let selectedButton = null;

        // Функция для расчета комиссии в зависимости от суммы
        function getCommission(amount) {
            if (amount >= 2200) {
                return 0.05; // 5%
            } else if (amount >= 1600) {
                return 0.06; // 6%
            } else {
                return 0.07; // 7%
            }
        }

        // Обновление UI вывода
        function updateWithdrawUI(amount, isMax = false, buttonElement = null) {
            // Убираем выделение с предыдущей кнопки
            if (selectedButton) {
                selectedButton.classList.remove('selected');
            }
            
            // Выделяем новую кнопку
            if (buttonElement) {
                selectedButton = buttonElement;
                buttonElement.classList.add('selected');
            }
            
            selectedAmount = amount;
            const commission = amount * getCommission(amount);
            const totalDeducted = amount + commission;
            const botStars = amount / 200;

            // Обновляем статус
            withdrawStatusText.innerText = `Вы получите ⭐ ${botStars.toLocaleString('ru-RU')} звёзд в боте`;

            // Обновляем детали в карточке
            document.getElementById('withdraw-amount').textContent = `${amount.toLocaleString('ru-RU')} ✨`;
            document.getElementById('withdraw-commission').textContent = `${Math.floor(commission).toLocaleString('ru-RU')} ✨`;
            document.getElementById('withdraw-total').textContent = `${Math.floor(totalDeducted).toLocaleString('ru-RU')} ✨`;

            withdrawInfo.classList.remove('hidden');
            withdrawConfirmBtn.classList.remove('hidden');
            withdrawConfirmBtn.disabled = totalDeducted > userBalance;
        }

        // Проверка дневного лимита
        withdrawConfirmBtn.disabled = true;
        withdrawButtonsContainer.innerHTML = '';
        withdrawInfo.classList.add('hidden');
        withdrawConfirmBtn.classList.add('hidden');

        // Обновляем статистику
        if (withdrawsToday) {
            withdrawsToday.textContent = `${gameState.withdrawalsToday.count}/2`;
        }

        if (false) { // Временно отключено ограничение на вывод
            withdrawStatusText.innerText = `Вы достигли дневного лимита операций на сегодня (2/2). Попробуйте завтра.`;
            withdrawInfo.classList.remove('hidden');
        } else {
            // Создание кнопок для вывода
            withdrawAmounts.forEach(amount => {
                const commission = amount * getCommission(amount);
                const totalDeducted = amount + commission;
                const botStars = amount / 200;
                const isDisabled = totalDeducted > userBalance;

                const button = document.createElement('button');
                button.className = `withdraw-btn ${isDisabled ? 'disabled' : ''}`;
                button.disabled = isDisabled;
                
                button.innerHTML = `
                    <div class="btn-amount">${amount.toLocaleString('ru-RU')}</div>
                    <div class="btn-stars">⭐ ${botStars.toLocaleString('ru-RU')} звёзд</div>
                    <div class="btn-commission">Комиссия: ${Math.floor(commission).toLocaleString('ru-RU')}</div>
                `;
                
                button.addEventListener('click', () => {
                    if (!isDisabled) {
                        updateWithdrawUI(amount, false, button);
                    }
                });
                withdrawButtonsContainer.appendChild(button);
            });
            
            // Кнопка MAX - рассчитываем максимальную сумму, кратной 200 (чтобы получить целое число звёзд)
            let maxAmount = 0;
            let maxCommission = 0;
            let maxTotalDeducted = 0;
            let maxBotStars = 0;
            
            // Находим максимальную сумму, кратную 200, которую можно вывести
            for (let amount = 200; amount <= userBalance; amount += 200) {
                const commission = amount * getCommission(amount);
                const totalDeducted = amount + commission;
                
                if (totalDeducted <= userBalance) {
                    maxAmount = amount;
                    maxCommission = commission;
                    maxTotalDeducted = totalDeducted;
                    maxBotStars = amount / 200;
                } else {
                    break;
                }
            }
            
            const isMaxDisabled = maxAmount < 200;

            const maxButton = document.createElement('button');
            maxButton.className = `withdraw-btn max-btn ${isMaxDisabled ? 'disabled' : ''}`;
            maxButton.disabled = isMaxDisabled;
            
            maxButton.innerHTML = `
                <div class="btn-amount">${maxAmount.toLocaleString('ru-RU')}</div>
                <div class="btn-stars">⭐ ${maxBotStars.toLocaleString('ru-RU')} звёзд</div>
                <div class="btn-commission">Комиссия: ${Math.floor(maxCommission).toLocaleString('ru-RU')}</div>
            `;
            
            maxButton.addEventListener('click', () => {
                if (!isMaxDisabled) {
                    updateWithdrawUI(maxAmount, true, maxButton);
                }
            });
            withdrawButtonsContainer.appendChild(maxButton);

            withdrawStatusText.innerText = `Ограничения на вывод временно отключены. Выберите сумму:`;
        }

        // Логика подтверждения вывода
        withdrawConfirmBtn.onclick = async () => {
            if (withdrawConfirmBtn.disabled || selectedAmount === 0) return;
            const amount = selectedAmount;
            const commissionRate = getCommission(amount);
            const commission = Math.round(amount * commissionRate);
            const totalDeducted = amount + commission;

            if (totalDeducted <= userBalance) {
                // Получаем данные пользователя
                const userData = getTelegramUserData();
                
                if (!userData || !userData.id) {
                    showWithdrawalNotification('Ошибка: не удалось получить данные пользователя', 'error');
                    return;
                }

                // Блокируем кнопку во время обработки
                withdrawConfirmBtn.disabled = true;
                withdrawConfirmBtn.textContent = 'Обработка...';
                
                try {
                    // Отправляем запрос на создание заявки на вывод через API
                    const response = await createWithdrawalRequest(amount, userData);
                    
                    // Обрабатываем ответ сервера
                    handleWithdrawalResponse(response, amount);
                    
                    // Если запрос успешен, обновляем локальное состояние
                    if (response.success) {
                        gameState.balance -= totalDeducted;
                        gameState.withdrawalsToday.count++;
                        saveState();
                        
                        // Обновляем UI
                        updateBalanceUI();
                        
                        // Показываем модальное окно успеха
                        document.getElementById('success-message').innerText = `Заявка на вывод ⭐ ${(amount / 200).toLocaleString('ru-RU')} звёзд отправлена на рассмотрение!`;
                        successModal.classList.remove('hidden');

                        setTimeout(() => {
                            successModal.classList.add('hidden');
                            showScreen(gameScreen);
                            startEnergyRegen();
                            initThreeJSScene();
                        }, 3000);
                    }
                    
                } catch (error) {
                    console.error('Ошибка при создании заявки на вывод:', error);
                    showWithdrawalNotification(
                        'Ошибка при отправке заявки на вывод. Попробуйте позже.',
                        'error'
                    );
                } finally {
                    // Разблокируем кнопку
                    withdrawConfirmBtn.disabled = false;
                    withdrawConfirmBtn.textContent = 'Подтвердить вывод';
                }
            }
        };

        if (withdrawBalance) {
            withdrawBalance.innerText = Math.floor(gameState.balance).toLocaleString('ru-RU');
        }
    }

    // --- ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ С БОТОМ ---
    function getTelegramUserData() {
        try {
            const userData = tg.initDataUnsafe?.user;
            if (userData) {
                return {
                    id: userData.id,
                    first_name: userData.first_name,
                    last_name: userData.last_name,
                    username: userData.username,
                    language_code: userData.language_code
                };
            }
        } catch (e) {
            console.error('Ошибка получения данных пользователя:', e);
        }
        return null;
    }

    function sendDataToBot(data) {
        try {
            console.log('Отправляем данные боту:', data);
            tg.sendData(JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Ошибка отправки данных в Telegram:', e);
            return false;
        }
    }

    // --- НОВЫЕ ФУНКЦИИ ДЛЯ API ИНТЕГРАЦИИ ---
    
    /**
     * Генерация HMAC-SHA256 подписи для запроса
     * @param {string} data - Данные для подписи
     * @param {string} secret - Секретный ключ
     * @returns {string} HMAC подпись в hex формате
     */
    async function generateHMACSignature(data, secret) {
        try {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const messageData = encoder.encode(data);
            
            const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            
            const signature = await crypto.subtle.sign('HMAC', key, messageData);
            const signatureArray = new Uint8Array(signature);
            const signatureHex = Array.from(signatureArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            return signatureHex;
        } catch (error) {
            console.error('Ошибка генерации HMAC подписи:', error);
            throw error;
        }
    }

    /**
     * Генерация уникального ID транзакции
     * @returns {string} Уникальный ID транзакции
     */
    function generateTransactionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `tx_${timestamp}_${random}`;
    }

    /**
     * Получение секретного ключа для подписи
     * В продакшене этот ключ должен храниться безопасно на сервере
     * @returns {string} Секретный ключ
     */
    function getSecretKey() {
        // ВАЖНО: Этот ключ должен совпадать с SECRET_KEY в .env файле сервера!
        return 'maniac-stars-secret-key-2024'; // Должен совпадать с ключом на сервере
    }

    /**
     * Отправка запроса на создание заявки на вывод
     * @param {number} amount - Сумма для вывода
     * @param {object} userData - Данные пользователя
     * @returns {Promise<object>} Ответ сервера
     */
    async function createWithdrawalRequest(amount, userData) {
        try {
            const appTransactionId = generateTransactionId();
            const user_id = userData.id;
            
            // Формируем данные для подписи
            const signatureData = `${user_id}_${amount}_${appTransactionId}`;
            const signature = await generateHMACSignature(signatureData, getSecretKey());
            
            // Формируем тело запроса
            const requestBody = {
                user_id: user_id,
                amount: amount,
                app_transaction_id: appTransactionId,
                signature: signature
            };
            
            console.log('Отправляем запрос на вывод:', requestBody);
            
            // Отправляем запрос
            const response = await fetch(window.API_URL || 'http://localhost:8080/api/withdrawal/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Ответ сервера:', result);
            
            return result;
            
        } catch (error) {
            console.error('Ошибка при создании заявки на вывод:', error);
            throw error;
        }
    }

    /**
     * Обработка ответа от сервера и показ уведомления пользователю
     * @param {object} response - Ответ от сервера
     * @param {number} amount - Сумма вывода
     */
    function handleWithdrawalResponse(response, amount) {
        if (response.success) {
            // Успешное создание заявки
            const botStars = amount / 200;
            showWithdrawalNotification(
                `Заявка на вывод отправлена на рассмотрение! Вы получите ⭐ ${botStars} звёзд в боте.`,
                'success'
            );
        } else {
            // Ошибка при создании заявки
            const errorMessage = response.error || response.message || 'Произошла ошибка при создании заявки';
            showWithdrawalNotification(errorMessage, 'error');
        }
    }

    /**
     * Показ уведомления о результате вывода
     * @param {string} message - Сообщение
     * @param {string} type - Тип уведомления ('success' или 'error')
     */
    function showWithdrawalNotification(message, type) {
        // Создаем элемент уведомления
        const notification = document.createElement('div');
        notification.className = `withdrawal-notification ${type}`;
        notification.textContent = message;
        
        // Стили для уведомления
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: type === 'success' ? 'linear-gradient(135deg, #00ff00, #00cc00)' : 'linear-gradient(135deg, #ff4444, #cc0000)',
            color: 'white',
            padding: '15px 25px',
            borderRadius: '12px',
            fontFamily: 'Orbitron, Exo 2, sans-serif',
            fontWeight: '700',
            fontSize: '1.1rem',
            zIndex: '10000',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
            animation: 'slideDown 0.3s ease-out',
            maxWidth: '90%',
            textAlign: 'center'
        });
        
        document.body.appendChild(notification);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // --- ОБЩИЕ ФУНКЦИИ И ЗАПУСК ---
    function showNotification() {
        if (notification) {
            notification.classList.remove('hidden');
            setTimeout(() => notification.classList.add('hidden'), 3000);
        }
    }

    function createBackgroundStars() {
        const container = document.getElementById('background-stars');
        if (!container) return;
        const starCount = 30;
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            const duration = Math.random() * 5 + 5;
            const delay = Math.random() * 5;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;
            star.style.setProperty('--start-x', `${Math.random() * 100}vw`);
            star.style.setProperty('--start-y', `${Math.random() * 100}vh`);
            star.style.setProperty('--end-x', `${Math.random() * 100}vw`);
            star.style.setProperty('--end-y', `${Math.random() * 100}vh`);
            container.appendChild(star);
        }
    }

    // Первоначальный запуск
    createBackgroundStars();
    
    // Логируем данные Telegram WebApp для отладки
    console.log('=== ДИАГНОСТИКА TELEGRAM WEBAPP ===');
    console.log('tg объект:', tg);
    console.log('tg.sendData функция:', typeof tg.sendData);
    console.log('initData:', tg.initData);
    console.log('initDataUnsafe:', tg.initDataUnsafe);
    console.log('user данные:', getTelegramUserData());
    console.log('=====================================');
    
    // Показываем загрузочный экран сначала
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
    
    // Инициализируем игру (это запустит загрузку 3D модели)
    initGamePage();
    
    // Инициализируем обработчики событий для игры Краш
    initCrashEventHandlers();
    
    // Игровой экран будет показан после скрытия загрузочного экрана
});

// Делаем функцию showScreen глобальной для использования в игре Краш
window.showScreen = function(screen) {
    const loadingScreen = document.getElementById('loading-screen');
    const gameScreen = document.getElementById('game-screen');
    const withdrawScreen = document.getElementById('withdraw-screen');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.add('hidden');
    if (withdrawScreen) withdrawScreen.classList.add('hidden');
    
    // Добавляем поддержку экрана Краш
    const crashScreen = document.getElementById('crash-screen');
    if (crashScreen) crashScreen.classList.add('hidden');
    
    if (typeof screen === 'string') {
        const screenElement = document.getElementById(screen);
        if (screenElement) screenElement.classList.remove('hidden');
    } else if (screen) {
        screen.classList.remove('hidden');
    }
};

// ==================== ИГРА КРАШ ====================

// ==================== СОСТОЯНИЕ ИГРЫ КРАШ ====================

// Переменные для игры Краш с улучшенным управлением состоянием
let crashGame = {
    isActive: false,
    currentMultiplier: 1.00,
    targetMultiplier: 1.00,
    gameState: 'WAITING', // WAITING, IN_PROGRESS, CRASHED
    betAmount: 10,
    userBet: null,
    hasCashedOut: false,
    cashOutMultiplier: null, // Сохраняем множитель на момент вывода
    roundTime: 0,
    maxRoundTime: 10000, // 10 секунд максимум
    chart: null,
    history: [],
    roundStartTime: 0,
    animationId: null,
    roundProcessed: false, // Флаг для предотвращения двойных выплат
    isBettingPhase: true, // Флаг фазы приема ставок
    roundNumber: 0 // Номер раунда для отладки
};

// ==================== ИНИЦИАЛИЗАЦИЯ ИГРЫ КРАШ ====================

/**
 * Инициализация игры Краш с проверкой алгоритма и систем безопасности
 */
window.initCrashGame = function() {
    console.log('🚀 Инициализация игры Краш...');
    
    // Сбрасываем конечный автомат состояний
    crashStateMachine.reset();
    
    // Проверяем корректность алгоритма (только в режиме разработки)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔍 Проверка алгоритма краша...');
        const isValid = validateCrashAlgorithm();
        console.log(isValid ? '✅ Алгоритм корректен' : '❌ Ошибка в алгоритме');
        
        // Показываем отчет о безопасности
        const securityReport = crashSecurity.getSecurityReport();
        console.log('🛡️ Отчет о безопасности:', securityReport);
    }
    
    // Инициализируем график
    initCrashChart();
    
    // Обновляем баланс
    updateCrashBalance();
    
    // Генерируем начальную историю
    generateInitialHistory();
    
    // Запускаем игровой цикл
    startCrashGameLoop();
    
    console.log('✅ Игра Краш инициализирована с полной системой безопасности');
};

// ==================== УЛУЧШЕННАЯ ВИЗУАЛИЗАЦИЯ ГРАФИКА ====================

/**
 * Инициализация графика с улучшенной визуализацией
 * Плавные кривые, динамические цвета, лучшая производительность
 */
function initCrashChart() {
    const ctx = document.getElementById('crash-chart');
    if (!ctx) return;
    
    // Создаем градиент для линии графика
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0.8)');
    
    // Создаем градиент для заливки
    const fillGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
    fillGradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
    fillGradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.1)');
    fillGradient.addColorStop(1, 'rgba(255, 0, 0, 0.2)');
    
    crashGame.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Множитель',
                data: [],
                borderColor: gradient,
                backgroundColor: fillGradient,
                borderWidth: 4,
                fill: true,
                tension: 0.8, // Очень плавные кривые
                pointRadius: 0,
                pointHoverRadius: 8,
                pointBackgroundColor: '#00ffff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                segment: {
                    borderColor: function(ctx) {
                        const value = ctx.p1.parsed.y;
                        if (value < 2) return '#00ff00';
                        if (value < 5) return '#ffff00';
                        if (value < 10) return '#ff8800';
                        return '#ff0000';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Отключаем анимацию для лучшей производительности
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#00ffff',
                    bodyColor: '#ffffff',
                    borderColor: '#00ffff',
                    borderWidth: 2,
                    cornerRadius: 12,
                    displayColors: false,
                    titleFont: {
                        family: 'Orbitron, Exo 2, sans-serif',
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        family: 'Orbitron, Exo 2, sans-serif',
                        size: 13
                    },
                    callbacks: {
                        title: function(context) {
                            return `Время: ${context[0].label}`;
                        },
                        label: function(context) {
                            return `Множитель: ${context.parsed.y.toFixed(2)}x`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    beginAtZero: false,
                    min: 1.00,
                    max: 10.00,
                    ticks: {
                        color: '#00ffff',
                        font: {
                            family: 'Orbitron, Exo 2, sans-serif',
                            size: 12,
                            weight: 'bold'
                        },
                        callback: function(value) {
                            return value.toFixed(2) + 'x';
                        },
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 255, 255, 0.2)',
                        lineWidth: 1,
                        drawBorder: false
                    },
                    border: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round'
                },
                point: {
                    hoverBorderWidth: 3
                }
            },
            layout: {
                padding: {
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10
                }
            }
        }
    });
}

// Обновление баланса в игре Краш
window.updateCrashBalance = function() {
    const balanceElement = document.getElementById('crash-balance');
    if (balanceElement) {
        balanceElement.textContent = Math.floor(gameState.balance).toLocaleString('ru-RU');
    }
};

// Генерация начальной истории
function generateInitialHistory() {
    const history = [];
    for (let i = 0; i < 15; i++) {
        const multiplier = generateCrashMultiplier();
        history.push(multiplier);
    }
    crashGame.history = history;
    updateHistoryDisplay();
}

// ==================== КРИПТОГРАФИЧЕСКИ ЧЕСТНЫЙ АЛГОРИТМ КРАША ====================

// Настройки House Edge (прибыльность для казино)
const CRASH_CONFIG = {
    HOUSE_EDGE: 0.05, // 5% прибыли для казино (RTP 95%)
    MAX_MULTIPLIER: 1000000, // Максимальный возможный множитель
    INSTANT_CRASH_CHANCE: 0.02, // 2% шанс на мгновенный краш (1.00x)
    MIN_MULTIPLIER: 1.00
};

// Криптографически стойкий генератор случайных чисел
class CryptoRandom {
    static getSecureRandom() {
        if (window.crypto && window.crypto.getRandomValues) {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] / (0xFFFFFFFF + 1);
        } else {
            // Fallback для старых браузеров
            console.warn('Криптографический API недоступен, используется Math.random()');
            return Math.random();
        }
    }
}

// ==================== КОНЕЧНЫЙ АВТОМАТ СОСТОЯНИЙ ====================

/**
 * Конечный автомат для управления состоянием игры Краш
 * Обеспечивает строгий контроль переходов между состояниями
 */
class CrashGameStateMachine {
    constructor() {
        this.currentState = 'WAITING';
        this.previousState = null;
        this.stateHistory = [];
        this.transitions = {
            'WAITING': ['BETTING', 'ERROR'],
            'BETTING': ['RUNNING', 'WAITING', 'ERROR'],
            'RUNNING': ['CRASHED', 'ERROR'],
            'CRASHED': ['WAITING', 'ERROR'],
            'ERROR': ['WAITING']
        };
    }
    
    /**
     * Переход в новое состояние с проверкой валидности
     * @param {string} newState - Новое состояние
     * @param {object} context - Контекст перехода
     * @returns {boolean} Успешность перехода
     */
    transitionTo(newState, context = {}) {
        if (!this.isValidTransition(newState)) {
            console.error(`Недопустимый переход из ${this.currentState} в ${newState}`);
            return false;
        }
        
        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateHistory.push({
            from: this.previousState,
            to: newState,
            timestamp: Date.now(),
            context: context
        });
        
        // Ограничиваем историю состояний
        if (this.stateHistory.length > 100) {
            this.stateHistory.shift();
        }
        
        console.log(`🔄 Переход состояния: ${this.previousState} → ${newState}`);
        return true;
    }
    
    /**
     * Проверка валидности перехода
     * @param {string} newState - Новое состояние
     * @returns {boolean} Валидность перехода
     */
    isValidTransition(newState) {
        return this.transitions[this.currentState]?.includes(newState) || false;
    }
    
    /**
     * Получение текущего состояния
     * @returns {string} Текущее состояние
     */
    getCurrentState() {
        return this.currentState;
    }
    
    /**
     * Проверка, находится ли автомат в определенном состоянии
     * @param {string} state - Состояние для проверки
     * @returns {boolean} Результат проверки
     */
    isInState(state) {
        return this.currentState === state;
    }
    
    /**
     * Сброс автомата в начальное состояние
     */
    reset() {
        this.previousState = null;
        this.currentState = 'WAITING';
        this.stateHistory = [];
        console.log('🔄 Конечный автомат сброшен в состояние WAITING');
    }
    
    /**
     * Получение статистики состояний
     * @returns {object} Статистика
     */
    getStateStats() {
        const stats = {};
        this.stateHistory.forEach(entry => {
            if (!stats[entry.to]) {
                stats[entry.to] = 0;
            }
            stats[entry.to]++;
        });
        return stats;
    }
}

// Глобальный экземпляр конечного автомата
const crashStateMachine = new CrashGameStateMachine();

// ==================== СИСТЕМА БЕЗОПАСНОСТИ ====================

/**
 * Система безопасности для предотвращения читерства и взлома
 * Включает проверки целостности, валидацию данных и защиту от манипуляций
 */
class CrashGameSecurity {
    constructor() {
        this.integrityChecks = [];
        this.suspiciousActivity = [];
        this.maxSuspiciousEvents = 10;
        this.securityEnabled = true;
    }
    
    /**
     * Проверка целостности игрового состояния
     * @param {object} gameState - Состояние игры для проверки
     * @returns {boolean} Результат проверки
     */
    validateGameState(gameState) {
        if (!this.securityEnabled) return true;
        
        const checks = [
            this.checkMultiplierRange(gameState.currentMultiplier),
            this.checkMultiplierRange(gameState.targetMultiplier),
            this.checkBetAmount(gameState.userBet),
            this.checkBalanceIntegrity(gameState.userBet),
            this.checkTimingIntegrity(gameState.roundStartTime)
        ];
        
        const allValid = checks.every(check => check.valid);
        
        if (!allValid) {
            const failedChecks = checks.filter(check => !check.valid);
            this.logSuspiciousActivity('GAME_STATE_VALIDATION_FAILED', {
                failedChecks: failedChecks,
                gameState: gameState
            });
        }
        
        return allValid;
    }
    
    /**
     * Проверка диапазона множителя
     * @param {number} multiplier - Множитель для проверки
     * @returns {object} Результат проверки
     */
    checkMultiplierRange(multiplier) {
        const valid = multiplier >= CRASH_CONFIG.MIN_MULTIPLIER && 
                     multiplier <= CRASH_CONFIG.MAX_MULTIPLIER &&
                     !isNaN(multiplier) && 
                     isFinite(multiplier);
        
        return {
            valid: valid,
            check: 'MULTIPLIER_RANGE',
            value: multiplier,
            reason: valid ? null : 'Множитель вне допустимого диапазона'
        };
    }
    
    /**
     * Проверка суммы ставки
     * @param {number} betAmount - Сумма ставки
     * @returns {object} Результат проверки
     */
    checkBetAmount(betAmount) {
        if (!betAmount) return { valid: true, check: 'BET_AMOUNT' };
        
        const valid = betAmount > 0 && 
                     betAmount <= gameState.balance &&
                     Number.isInteger(betAmount) &&
                     betAmount <= 1000000; // Максимальная ставка
        
        return {
            valid: valid,
            check: 'BET_AMOUNT',
            value: betAmount,
            reason: valid ? null : 'Некорректная сумма ставки'
        };
    }
    
    /**
     * Проверка целостности баланса
     * @param {number} betAmount - Сумма ставки
     * @returns {object} Результат проверки
     */
    checkBalanceIntegrity(betAmount) {
        if (!betAmount) return { valid: true, check: 'BALANCE_INTEGRITY' };
        
        const valid = gameState.balance >= betAmount &&
                     gameState.balance >= 0 &&
                     isFinite(gameState.balance);
        
        return {
            valid: valid,
            check: 'BALANCE_INTEGRITY',
            value: gameState.balance,
            reason: valid ? null : 'Нарушение целостности баланса'
        };
    }
    
    /**
     * Проверка временной целостности
     * @param {number} roundStartTime - Время начала раунда
     * @returns {object} Результат проверки
     */
    checkTimingIntegrity(roundStartTime) {
        const now = Date.now();
        const valid = roundStartTime <= now &&
                     roundStartTime > (now - 60000) && // Не старше минуты
                     isFinite(roundStartTime);
        
        return {
            valid: valid,
            check: 'TIMING_INTEGRITY',
            value: roundStartTime,
            reason: valid ? null : 'Нарушение временной целостности'
        };
    }
    
    /**
     * Проверка подозрительной активности
     * @param {string} eventType - Тип события
     * @param {object} data - Данные события
     * @returns {boolean} Есть ли подозрительная активность
     */
    checkSuspiciousActivity(eventType, data) {
        const suspiciousPatterns = [
            { type: 'RAPID_BETTING', condition: this.checkRapidBetting.bind(this) },
            { type: 'UNUSUAL_MULTIPLIERS', condition: this.checkUnusualMultipliers.bind(this) },
            { type: 'TIMING_ANOMALIES', condition: this.checkTimingAnomalies.bind(this) },
            { type: 'INVALID_BET_AMOUNTS', condition: this.checkInvalidBetAmounts.bind(this) },
            { type: 'BALANCE_MANIPULATION', condition: this.checkBalanceManipulation.bind(this) },
            { type: 'DEVICE_FINGERPRINT', condition: this.checkDeviceFingerprint.bind(this) }
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.condition(data)) {
                this.logSuspiciousActivity(pattern.type, data);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Проверка быстрых ставок
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkRapidBetting(data) {
        // Проверяем, не делаются ли ставки слишком быстро
        const recentBets = this.suspiciousActivity.filter(activity => 
            activity.type === 'BET_PLACED' && 
            Date.now() - activity.timestamp < 1000 // За последнюю секунду
        );
        
        return recentBets.length > 5; // Более 5 ставок в секунду
    }
    
    /**
     * Проверка необычных множителей
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkUnusualMultipliers(data) {
        if (!data.multiplier) return false;
        
        // Проверяем, не выпадают ли слишком часто высокие множители
        const recentMultipliers = crashGame.history.slice(-10);
        const highMultipliers = recentMultipliers.filter(m => m > 10);
        
        return highMultipliers.length > 7; // Более 7 из 10 высоких множителей
    }
    
    /**
     * Проверка временных аномалий
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkTimingAnomalies(data) {
        if (!data.timestamp) return false;
        
        // Проверяем, не происходят ли события слишком быстро
        const now = Date.now();
        const timeDiff = now - data.timestamp;
        
        return timeDiff < 10; // Менее 10мс между событиями
    }
    
    /**
     * Проверка некорректных сумм ставок
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkInvalidBetAmounts(data) {
        if (!data.betAmount) return false;
        
        const betAmount = data.betAmount;
        const balance = gameState.balance;
        
        // Проверяем подозрительные суммы ставок
        return betAmount <= 0 || 
               betAmount > balance || 
               betAmount > 1000000 || // Максимальная ставка
               !Number.isInteger(betAmount) ||
               betAmount === Infinity ||
               betAmount === -Infinity ||
               isNaN(betAmount);
    }
    
    /**
     * Проверка манипуляций с балансом
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkBalanceManipulation(data) {
        const balance = gameState.balance;
        
        // Проверяем некорректные значения баланса
        return balance < 0 || 
               balance === Infinity ||
               balance === -Infinity ||
               isNaN(balance) ||
               !isFinite(balance);
    }
    
    /**
     * Проверка отпечатка устройства для обнаружения ботов
     * @param {object} data - Данные для проверки
     * @returns {boolean} Подозрительная активность
     */
    checkDeviceFingerprint(data) {
        // Проверяем наличие подозрительных признаков автоматизации
        const userAgent = navigator.userAgent.toLowerCase();
        const suspiciousPatterns = [
            'headless',
            'phantom',
            'selenium',
            'webdriver',
            'automation',
            'bot',
            'crawler',
            'spider'
        ];
        
        const isSuspiciousUA = suspiciousPatterns.some(pattern => userAgent.includes(pattern));
        
        // Проверяем отсутствие мыши (признак бота)
        const hasMouseEvents = window.onmousemove !== null;
        
        // Проверяем размеры экрана (могут быть поддельными у ботов)
        const screenSize = window.screen.width * window.screen.height;
        const suspiciousScreenSize = screenSize < 100000 || screenSize > 50000000;
        
        return isSuspiciousUA || !hasMouseEvents || suspiciousScreenSize;
    }
    
    /**
     * Логирование подозрительной активности
     * @param {string} type - Тип активности
     * @param {object} data - Данные активности
     */
    logSuspiciousActivity(type, data) {
        const activity = {
            type: type,
            timestamp: Date.now(),
            data: data,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.suspiciousActivity.push(activity);
        
        // Ограничиваем количество записей
        if (this.suspiciousActivity.length > this.maxSuspiciousEvents) {
            this.suspiciousActivity.shift();
        }
        
        console.warn(`🚨 Подозрительная активность: ${type}`, activity);
        
        // В продакшене здесь можно отправить данные на сервер
        if (this.suspiciousActivity.length >= this.maxSuspiciousEvents) {
            this.handleSecurityBreach();
        }
    }
    
    /**
     * Обработка нарушения безопасности
     */
    handleSecurityBreach() {
        console.error('🚨 Обнаружено нарушение безопасности!');
        
        // Отключаем игру
        this.securityEnabled = false;
        crashStateMachine.transitionTo('ERROR');
        
        // Показываем сообщение пользователю
        showCrashNotification('Обнаружена подозрительная активность. Игра приостановлена.', 'error');
        
        // В продакшене здесь можно отправить уведомление администратору
    }
    
    /**
     * Получение отчета о безопасности
     * @returns {object} Отчет о безопасности
     */
    getSecurityReport() {
        return {
            securityEnabled: this.securityEnabled,
            suspiciousActivityCount: this.suspiciousActivity.length,
            recentActivity: this.suspiciousActivity.slice(-5),
            integrityChecks: this.integrityChecks.length
        };
    }
}

// Глобальный экземпляр системы безопасности
const crashSecurity = new CrashGameSecurity();

/**
 * Генерация криптографически честного множителя краша
 * Использует математически корректную формулу для обеспечения предопределенного House Edge
 * 
 * @returns {number} Множитель, на котором произойдет краш
 */
function generateCrashMultiplier() {
    // Генерируем криптографически стойкое случайное число
    const random = CryptoRandom.getSecureRandom();
    
    // Проверяем шанс на мгновенный краш (дополнительное преимущество казино)
    if (random < CRASH_CONFIG.INSTANT_CRASH_CHANCE) {
        return CRASH_CONFIG.MIN_MULTIPLIER;
    }
    
    // Нормализуем случайное число для оставшихся 98%
    const normalizedRandom = (random - CRASH_CONFIG.INSTANT_CRASH_CHANCE) / (1 - CRASH_CONFIG.INSTANT_CRASH_CHANCE);
    
    // КОРРЕКТНАЯ математическая формула для расчета множителя
    // Формула: multiplier = (1 - H) / (1 - r)
    // где H - House Edge, r - нормализованное случайное число
    // Эта формула обеспечивает точный RTP = (1 - H) на дистанции
    const H = CRASH_CONFIG.HOUSE_EDGE;
    const multiplier = (1 - H) / (1 - normalizedRandom);
    
    // Ограничиваем минимальным множителем
    const finalMultiplier = Math.max(CRASH_CONFIG.MIN_MULTIPLIER, multiplier);
    
    // Округляем до 2 знаков после запятой для удобства отображения
    return Math.min(Math.round(finalMultiplier * 100) / 100, CRASH_CONFIG.MAX_MULTIPLIER);
}

/**
 * Проверка математической корректности алгоритма
 * Вычисляет теоретический RTP на основе текущих настроек
 */
function validateCrashAlgorithm() {
    const iterations = 100000;
    let totalRTP = 0;
    let instantCrashes = 0;
    
    for (let i = 0; i < iterations; i++) {
        const multiplier = generateCrashMultiplier();
        totalRTP += multiplier;
        if (multiplier === 1.00) {
            instantCrashes++;
        }
    }
    
    const averageRTP = totalRTP / iterations;
    const expectedRTP = 1 - CRASH_CONFIG.HOUSE_EDGE;
    const actualInstantCrashRate = instantCrashes / iterations;
    
    console.log(`=== ПРОВЕРКА АЛГОРИТМА КРАША ===`);
    console.log(`Теоретический RTP: ${(expectedRTP * 100).toFixed(2)}%`);
    console.log(`Фактический RTP (${iterations} итераций): ${(averageRTP * 100).toFixed(2)}%`);
    console.log(`Отклонение RTP: ${Math.abs(averageRTP - expectedRTP) * 100}%`);
    console.log(`Теоретический шанс мгновенного краша: ${(CRASH_CONFIG.INSTANT_CRASH_CHANCE * 100).toFixed(2)}%`);
    console.log(`Фактический шанс мгновенного краша: ${(actualInstantCrashRate * 100).toFixed(2)}%`);
    console.log(`House Edge: ${(CRASH_CONFIG.HOUSE_EDGE * 100).toFixed(2)}%`);
    console.log(`================================`);
    
    const rtpValid = Math.abs(averageRTP - expectedRTP) < 0.01; // Допустимое отклонение 1%
    const instantCrashValid = Math.abs(actualInstantCrashRate - CRASH_CONFIG.INSTANT_CRASH_CHANCE) < 0.005; // Допустимое отклонение 0.5%
    
    return rtpValid && instantCrashValid;
}

// ==================== ОБНОВЛЕНИЕ ИСТОРИИ КРАШЕЙ ====================

/**
 * Обновление отображения истории крашей с улучшенной цветовой кодировкой
 * Соответствует дизайну из скриншотов
 */
function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    // Показываем последние 10 результатов (как на скриншотах)
    crashGame.history.slice(-10).reverse().forEach((multiplier, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = multiplier.toFixed(2) + 'x';
        
        // Добавляем анимацию появления
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px) scale(0.8)';
        
        // Улучшенная цветовая кодировка согласно скриншотам
        if (multiplier < 1.50) {
            // Очень низкие множители - темно-красный
            item.classList.add('very-low');
        } else if (multiplier < 2.00) {
            // Низкие множители - красный
            item.classList.add('low');
        } else if (multiplier < 5.00) {
            // Средние множители - оранжевый
            item.classList.add('medium');
        } else if (multiplier < 10.00) {
            // Высокие множители - желтый/золотой
            item.classList.add('high');
        } else {
            // Очень высокие множители - фиолетовый/золотой с эффектами
            item.classList.add('very-high');
        }
        
        historyList.appendChild(item);
        
        // Анимация появления с задержкой
        setTimeout(() => {
            item.style.transition = 'all 0.3s ease-out';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0) scale(1)';
        }, index * 50);
    });
}

// ==================== УПРАВЛЕНИЕ ИГРОВЫМ ЦИКЛОМ ====================

/**
 * Запуск нового игрового цикла с правильной инициализацией состояния
 * Использует конечный автомат для управления состояниями
 */
function startCrashGameLoop() {
    // Останавливаем предыдущую анимацию
    if (crashGame.animationId) {
        cancelAnimationFrame(crashGame.animationId);
        crashGame.animationId = null;
    }
    
    // Сбрасываем состояние раунда
    crashGame.currentMultiplier = 1.00;
    crashGame.targetMultiplier = generateCrashMultiplier(); // Генерируем заранее!
    crashGame.userBet = null;
    crashGame.hasCashedOut = false;
    crashGame.cashOutMultiplier = null;
    crashGame.roundTime = 0;
    crashGame.roundStartTime = Date.now();
    crashGame.roundProcessed = false;
    crashGame.isBettingPhase = true;
    crashGame.roundNumber++;
    
    // Переходим в состояние BETTING через конечный автомат
    if (!crashStateMachine.transitionTo('BETTING', { roundNumber: crashGame.roundNumber })) {
        console.error('Не удалось перейти в состояние BETTING');
        crashStateMachine.transitionTo('ERROR');
        return;
    }
    
    // Обновляем UI
    updateGameStatus('Идет прием ставок');
    updateMultiplierDisplay('1.00x');
    updateMainActionButton();
    resetChart();
    
    console.log(`🎮 Раунд #${crashGame.roundNumber}: Целевой множитель = ${crashGame.targetMultiplier.toFixed(2)}x`);
    
    // Время приема ставок - 5 секунд
    setTimeout(() => {
        if (crashStateMachine.isInState('BETTING')) {
            crashGame.isBettingPhase = false;
            startRound();
        }
    }, 5000);
}

// Начало раунда
function startRound() {
    // Переходим в состояние RUNNING через конечный автомат
    if (!crashStateMachine.transitionTo('RUNNING', { roundNumber: crashGame.roundNumber })) {
        console.error('Не удалось перейти в состояние RUNNING');
        crashStateMachine.transitionTo('ERROR');
        return;
    }
    
    crashGame.roundStartTime = Date.now();
    
    updateGameStatus('В игре!');
    updateMainActionButton();
    
    // Запуск анимации роста множителя
    animateMultiplier();
}

// ==================== НЕЛИНЕЙНАЯ АНИМАЦИЯ РОСТА МНОЖИТЕЛЯ ====================

/**
 * Анимация роста множителя с нелинейным ускорением
 * Создает напряжение через изменение скорости роста в зависимости от фазы
 */
function animateMultiplier() {
    if (!crashStateMachine.isInState('RUNNING')) return;
    
    const elapsed = Date.now() - crashGame.roundStartTime;
    const maxDuration = getMaxRoundDuration(crashGame.targetMultiplier);
    const progress = Math.min(elapsed / maxDuration, 1);
    
    // Нелинейная функция роста с ускорением
    const easeProgress = calculateNonLinearProgress(progress, crashGame.targetMultiplier);
    crashGame.currentMultiplier = 1 + (crashGame.targetMultiplier - 1) * easeProgress;
    
    // Обновляем отображение
    updateMultiplierDisplay(crashGame.currentMultiplier.toFixed(2) + 'x');
    updateChart(crashGame.currentMultiplier);
    updateMainActionButton();
    
    // Проверяем, достигли ли целевого множителя
    if (crashGame.currentMultiplier >= crashGame.targetMultiplier) {
        crash();
    } else {
        crashGame.animationId = requestAnimationFrame(animateMultiplier);
    }
}

/**
 * Вычисляет максимальную длительность раунда в зависимости от целевого множителя
 * Высокие множители требуют больше времени для создания напряжения
 */
function getMaxRoundDuration(targetMultiplier) {
    if (targetMultiplier <= 2.0) {
        return 3000; // 3 секунды для низких множителей
    } else if (targetMultiplier <= 5.0) {
        return 5000; // 5 секунд для средних множителей
    } else if (targetMultiplier <= 10.0) {
        return 8000; // 8 секунд для высоких множителей
    } else {
        return 12000; // 12 секунд для очень высоких множителей
    }
}

/**
 * Вычисляет нелинейный прогресс роста множителя
 * Создает разные фазы роста для максимального напряжения
 * Улучшенная версия с более реалистичной кривой роста
 */
function calculateNonLinearProgress(progress, targetMultiplier) {
    // Базовое ускорение - чем выше целевой множитель, тем больше ускорение
    const accelerationFactor = Math.min(targetMultiplier / 10, 3); // Максимум 3x ускорение
    
    // Фаза 1: Медленный старт (0-25% времени) - множитель растет от 1.00x до ~1.50x
    if (progress <= 0.25) {
        const phaseProgress = progress / 0.25;
        // Очень медленный рост в начале для создания напряжения
        const slowGrowth = Math.pow(phaseProgress, 3 + accelerationFactor) * 0.15;
        return slowGrowth;
    }
    
    // Фаза 2: Средний рост (25-60% времени) - множитель растет от ~1.50x до ~3.00x
    if (progress <= 0.60) {
        const phaseProgress = (progress - 0.25) / 0.35;
        // Ускоряющийся рост
        const mediumGrowth = 0.15 + Math.pow(phaseProgress, 1.8 + accelerationFactor) * 0.45;
        return mediumGrowth;
    }
    
    // Фаза 3: Быстрый рост (60-85% времени) - множитель растет от ~3.00x до ~6.00x
    if (progress <= 0.85) {
        const phaseProgress = (progress - 0.60) / 0.25;
        // Быстро ускоряющийся рост
        const fastGrowth = 0.60 + Math.pow(phaseProgress, 1.2 + accelerationFactor) * 0.25;
        return fastGrowth;
    }
    
    // Фаза 4: Экспоненциальный финиш (85-100% времени) - множитель растет от ~6.00x до целевого
    const phaseProgress = (progress - 0.85) / 0.15;
    // Экспоненциальный финиш для создания максимального напряжения
    const exponentialFinish = 0.85 + Math.pow(phaseProgress, 0.3 + accelerationFactor) * 0.15;
    return exponentialFinish;
}

// Краш
function crash() {
    // Переходим в состояние CRASHED через конечный автомат
    if (!crashStateMachine.transitionTo('CRASHED', { 
        roundNumber: crashGame.roundNumber,
        crashMultiplier: crashGame.targetMultiplier 
    })) {
        console.error('Не удалось перейти в состояние CRASHED');
        crashStateMachine.transitionTo('ERROR');
        return;
    }
    
    crashGame.currentMultiplier = crashGame.targetMultiplier;
    
    updateGameStatus('Краш!');
    updateMultiplierDisplay(crashGame.currentMultiplier.toFixed(2) + 'x');
    updateChart(crashGame.currentMultiplier);
    updateMainActionButton();
    
    // Обрабатываем результаты
    processRoundResults();
    
    // Добавляем в историю
    crashGame.history.push(crashGame.targetMultiplier);
    if (crashGame.history.length > 50) {
        crashGame.history.shift();
    }
    updateHistoryDisplay();
    
    // Сокращаем паузу до 1 секунды для непрерывной игры
    setTimeout(() => {
        // Переходим обратно в WAITING перед новым раундом
        crashStateMachine.transitionTo('WAITING');
        startCrashGameLoop();
    }, 1000);
}

// ==================== ИСПРАВЛЕНИЕ БАГОВ С ВЫПЛАТАМИ ====================

/**
 * Обработка результатов раунда с защитой от двойных выплат
 * Использует флаги состояния для предотвращения race conditions
 * Улучшенная версия с дополнительными проверками и транзакционной безопасностью
 */
function processRoundResults() {
    // Проверяем, есть ли активная ставка
    if (!crashGame.userBet || crashGame.userBet <= 0) {
        console.log('Нет активной ставки для обработки результатов');
        return;
    }
    
    // Проверяем, не была ли уже обработана выплата
    if (crashGame.roundProcessed) {
        console.warn('Попытка повторной обработки результатов раунда - игнорируем');
        return;
    }
    
    // Проверяем, что раунд действительно завершен
    if (!crashStateMachine.isInState('CRASHED')) {
        console.warn('Попытка обработки результатов незавершенного раунда - игнорируем');
        return;
    }
    
    // Проверка безопасности игрового состояния
    if (!crashSecurity.validateGameState(crashGame)) {
        console.error('Обнаружено нарушение целостности игрового состояния');
        crashStateMachine.transitionTo('ERROR');
        return;
    }
    
    // Устанавливаем флаг обработки СРАЗУ для предотвращения race conditions
    crashGame.roundProcessed = true;
    
    // Сохраняем данные для обработки в атомарном виде
    const transactionData = {
        betAmount: crashGame.userBet,
        cashedOut: crashGame.hasCashedOut,
        cashOutMultiplier: crashGame.cashOutMultiplier,
        crashMultiplier: crashGame.targetMultiplier,
        roundNumber: crashGame.roundNumber,
        timestamp: Date.now()
    };
    
    // Сбрасываем ставку пользователя СРАЗУ после сохранения данных
    crashGame.userBet = null;
    crashGame.hasCashedOut = false;
    crashGame.cashOutMultiplier = null;
    
    try {
        // Проверяем баланс перед любой операцией
        if (gameState.balance < 0) {
            console.error('Обнаружен отрицательный баланс! Сброс в 0.');
            gameState.balance = 0;
        }
        
        if (transactionData.cashedOut && transactionData.cashOutMultiplier && transactionData.cashOutMultiplier > 0) {
            // Пользователь успел вывести - используем сохраненный множитель
            const winnings = Math.floor(transactionData.betAmount * transactionData.cashOutMultiplier);
            
            // Расширенные проверки на разумность выигрыша
            if (winnings > 0 && 
                winnings <= transactionData.betAmount * 1000 && // Максимум 1000x
                winnings <= 10000000 && // Максимум 10M абсолютно
                transactionData.cashOutMultiplier >= 1.00 &&
                transactionData.cashOutMultiplier <= transactionData.crashMultiplier) {
                
                // Проверяем, что у нас достаточно средств для выплаты
                const newBalance = gameState.balance + winnings;
                if (newBalance < 0 || !isFinite(newBalance)) {
                    console.error('Некорректный баланс после выплаты:', newBalance);
                    return;
                }
                
                // Атомарное обновление баланса
                gameState.balance = newBalance;
                updateCrashBalance();
                updateBalanceUI();
                saveState();
                
                // Показываем уведомление о выигрыше
                showCrashNotification(`Выигрыш: ${winnings} ⭐`, 'success');
                
                console.log(`✅ Выплата: ${winnings} ⭐ (ставка: ${transactionData.betAmount}, множитель: ${transactionData.cashOutMultiplier.toFixed(2)}x, раунд: ${transactionData.roundNumber})`);
                
                // Логируем успешную транзакцию для аудита
                logTransaction('WIN', transactionData, winnings);
            } else {
                console.error('Некорректные данные для выплаты:', {
                    winnings,
                    betAmount: transactionData.betAmount,
                    cashOutMultiplier: transactionData.cashOutMultiplier,
                    crashMultiplier: transactionData.crashMultiplier
                });
                // В случае ошибки просто не списываем ставку
            }
        } else {
            // Пользователь проиграл - списываем ставку
            if (gameState.balance >= transactionData.betAmount) {
                const newBalance = gameState.balance - transactionData.betAmount;
                
                // Проверяем корректность нового баланса
                if (newBalance >= 0 && isFinite(newBalance)) {
                    // Атомарное обновление баланса
                    gameState.balance = newBalance;
                    updateCrashBalance();
                    updateBalanceUI();
                    saveState();
                    
                    // Показываем уведомление о проигрыше
                    showCrashNotification(`Проигрыш: ${transactionData.betAmount} ⭐`, 'error');
                    
                    console.log(`❌ Проигрыш: ${transactionData.betAmount} ⭐ (краш на ${transactionData.crashMultiplier.toFixed(2)}x, раунд: ${transactionData.roundNumber})`);
                    
                    // Логируем проигрышную транзакцию для аудита
                    logTransaction('LOSS', transactionData, 0);
                } else {
                    console.error('Некорректный баланс после списания:', newBalance);
                }
            } else {
                console.error('Недостаточно средств для списания ставки:', {
                    balance: gameState.balance,
                    betAmount: transactionData.betAmount
                });
            }
        }
    } catch (error) {
        console.error('Ошибка при обработке результатов раунда:', error);
        // В случае ошибки сбрасываем флаг для повторной попытки
        crashGame.roundProcessed = false;
        
        // Логируем ошибку для отладки
        logTransaction('ERROR', transactionData, 0, error.message);
    }
}

/**
 * Логирование транзакций для аудита и отладки
 * @param {string} type - Тип транзакции (WIN, LOSS, ERROR)
 * @param {object} transactionData - Данные транзакции
 * @param {number} amount - Сумма (для выигрыша) или 0
 * @param {string} errorMessage - Сообщение об ошибке (если есть)
 */
function logTransaction(type, transactionData, amount, errorMessage = null) {
    const logEntry = {
        type,
        timestamp: Date.now(),
        roundNumber: transactionData.roundNumber,
        betAmount: transactionData.betAmount,
        cashOutMultiplier: transactionData.cashOutMultiplier,
        crashMultiplier: transactionData.crashMultiplier,
        amount,
        errorMessage,
        userAgent: navigator.userAgent,
        sessionId: getSessionId()
    };
    
    // В продакшене здесь можно отправить на сервер
    console.log('📊 Транзакция:', logEntry);
    
    // Сохраняем в локальном хранилище для отладки
    try {
        const logs = JSON.parse(localStorage.getItem('crashTransactionLogs') || '[]');
        logs.push(logEntry);
        
        // Ограничиваем количество логов
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }
        
        localStorage.setItem('crashTransactionLogs', JSON.stringify(logs));
    } catch (e) {
        console.error('Ошибка сохранения лога транзакции:', e);
    }
}

/**
 * Генерация уникального ID сессии для отслеживания
 */
function getSessionId() {
    if (!window.crashSessionId) {
        window.crashSessionId = 'crash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    return window.crashSessionId;
}

// Обновление статуса игры
function updateGameStatus(status) {
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Обновление отображения множителя
function updateMultiplierDisplay(multiplier) {
    const displayElement = document.getElementById('multiplier-display');
    if (displayElement) {
        displayElement.textContent = multiplier;
    }
}

// ==================== ОБНОВЛЕНИЕ UI КНОПОК ====================

/**
 * Обновление главной кнопки действия с учетом всех состояний игры
 */
function updateMainActionButton() {
    const button = document.getElementById('main-action-btn');
    if (!button) return;
    
    // Сбрасываем все классы
    button.className = 'main-action-button';
    button.disabled = false;
    
    const currentState = crashStateMachine.getCurrentState();
    
    if (currentState === 'WAITING' || currentState === 'BETTING') {
        if (crashGame.isBettingPhase) {
            if (crashGame.userBet) {
                button.textContent = 'Отменить ставку';
                button.classList.add('cancel');
            } else {
                button.textContent = 'Сделать ставку';
            }
        } else {
            button.textContent = 'Прием ставок завершен';
            button.classList.add('disabled');
            button.disabled = true;
        }
    } else if (currentState === 'RUNNING') {
        if (crashGame.userBet && !crashGame.hasCashedOut) {
            const potentialWin = Math.floor(crashGame.userBet * crashGame.currentMultiplier);
            button.textContent = `Вывести ${potentialWin}`;
            button.classList.add('cashout');
        } else if (crashGame.hasCashedOut) {
            button.textContent = 'Выведено!';
            button.classList.add('disabled');
            button.disabled = true;
        } else {
            button.textContent = 'Прием ставок завершен';
            button.classList.add('disabled');
            button.disabled = true;
        }
    } else if (currentState === 'CRASHED') {
        button.textContent = 'Прием ставок завершен';
        button.classList.add('disabled');
        button.disabled = true;
    } else if (currentState === 'ERROR') {
        button.textContent = 'Ошибка игры';
        button.classList.add('disabled');
        button.disabled = true;
    }
}

// Сброс графика
function resetChart() {
    if (crashGame.chart) {
        crashGame.chart.data.labels = [];
        crashGame.chart.data.datasets[0].data = [];
        crashGame.chart.update();
    }
}

// ==================== ДИНАМИЧЕСКОЕ ОБНОВЛЕНИЕ ГРАФИКА ====================

/**
 * Обновление графика с динамическим изменением цвета и масштабированием
 */
function updateChart(multiplier) {
    if (!crashGame.chart) return;
    
    const elapsed = Date.now() - crashGame.roundStartTime;
    const timeLabel = (elapsed / 1000).toFixed(1) + 's';
    
    // Добавляем новые данные
    crashGame.chart.data.labels.push(timeLabel);
    crashGame.chart.data.datasets[0].data.push(multiplier);
    
    // Ограничиваем количество точек для производительности
    if (crashGame.chart.data.labels.length > 100) {
        crashGame.chart.data.labels.shift();
        crashGame.chart.data.datasets[0].data.shift();
    }
    
    // Динамическое изменение цвета линии в зависимости от множителя
    updateChartColor(multiplier);
    
    // Автоматическое масштабирование оси Y
    const maxValue = Math.max(...crashGame.chart.data.datasets[0].data) * 1.2;
    crashGame.chart.options.scales.y.max = Math.max(10, maxValue);
    
    // Обновляем график без анимации для плавности
    crashGame.chart.update('none');
}

/**
 * Динамическое изменение цвета графика в зависимости от множителя
 * Улучшенная версия с плавными переходами и градиентами
 */
function updateChartColor(multiplier) {
    if (!crashGame.chart) return;
    
    const ctx = crashGame.chart.ctx;
    
    // Создаем динамический градиент в зависимости от текущего множителя
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    
    if (multiplier < 2.0) {
        // Зеленый градиент для низких множителей
        gradient.addColorStop(0, 'rgba(0, 255, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 100, 0.7)');
        gradient.addColorStop(1, 'rgba(0, 255, 0, 0.5)');
    } else if (multiplier < 5.0) {
        // Желтый градиент для средних множителей
        gradient.addColorStop(0, 'rgba(255, 255, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0.5)');
    } else if (multiplier < 10.0) {
        // Оранжевый градиент для высоких множителей
        gradient.addColorStop(0, 'rgba(255, 136, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 136, 0, 0.5)');
    } else {
        // Красный градиент для очень высоких множителей
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.9)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.5)');
    }
    
    // Создаем соответствующий градиент для заливки
    const fillGradient = ctx.createLinearGradient(0, 0, 0, 250);
    if (multiplier < 2.0) {
        fillGradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
        fillGradient.addColorStop(1, 'rgba(0, 255, 0, 0.05)');
    } else if (multiplier < 5.0) {
        fillGradient.addColorStop(0, 'rgba(255, 255, 0, 0.2)');
        fillGradient.addColorStop(1, 'rgba(255, 255, 0, 0.05)');
    } else if (multiplier < 10.0) {
        fillGradient.addColorStop(0, 'rgba(255, 136, 0, 0.2)');
        fillGradient.addColorStop(1, 'rgba(255, 136, 0, 0.05)');
    } else {
        fillGradient.addColorStop(0, 'rgba(255, 0, 0, 0.2)');
        fillGradient.addColorStop(1, 'rgba(255, 0, 0, 0.05)');
    }
    
    // Обновляем цвета
    crashGame.chart.data.datasets[0].borderColor = gradient;
    crashGame.chart.data.datasets[0].backgroundColor = fillGradient;
}

// Показ уведомления
function showCrashNotification(message, type) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = `crash-notification ${type}`;
    notification.textContent = message;
    
    // Стили для уведомления
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: type === 'success' ? 'linear-gradient(135deg, #00ff00, #00cc00)' : 'linear-gradient(135deg, #ff4444, #cc0000)',
        color: 'white',
        padding: '15px 25px',
        borderRadius: '12px',
        fontFamily: 'Orbitron, Exo 2, sans-serif',
        fontWeight: '700',
        fontSize: '1.1rem',
        zIndex: '10000',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
        animation: 'slideDown 0.3s ease-out'
    });
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Инициализация обработчиков событий для игры Краш
function initCrashEventHandlers() {
    // Кнопка "Назад" из игры Краш
    const backFromCrashBtn = document.getElementById('back-from-crash');
    if (backFromCrashBtn) {
        backFromCrashBtn.onclick = function() {
            showScreen('game-screen');
        };
    }
    
    // Кнопка перехода к игре Краш
    const goToCrashBtn = document.getElementById('go-to-crash');
    if (goToCrashBtn) {
        goToCrashBtn.onclick = function() {
            showScreen('crash-screen');
            updateCrashBalance();
            // Инициализируем игру Краш, если она еще не была инициализирована
            if (!crashGame.isActive) {
                initCrashGame();
            }
        };
    }
    
    // Поле ввода ставки
    const betInput = document.getElementById('bet-amount');
    if (betInput) {
        betInput.addEventListener('input', function() {
            const value = parseInt(this.value) || 0;
            if (value > gameState.balance) {
                this.value = Math.floor(gameState.balance);
            }
            if (value < 1) {
                this.value = 1;
            }
            crashGame.betAmount = parseInt(this.value) || 1;
        });
    }
    
    // Кнопки модификаторов ставки
    const betHalfBtn = document.getElementById('bet-half');
    if (betHalfBtn) {
        betHalfBtn.onclick = function() {
            const newAmount = Math.max(1, Math.floor(crashGame.betAmount / 2));
            crashGame.betAmount = newAmount;
            betInput.value = newAmount;
        };
    }
    
    const betDoubleBtn = document.getElementById('bet-double');
    if (betDoubleBtn) {
        betDoubleBtn.onclick = function() {
            const newAmount = Math.min(Math.floor(gameState.balance), crashGame.betAmount * 2);
            crashGame.betAmount = newAmount;
            betInput.value = newAmount;
        };
    }
    
    // Кнопки быстрых ставок
    const quickBetButtons = document.querySelectorAll('.quick-bet');
    quickBetButtons.forEach(button => {
        button.onclick = function() {
            const amount = parseInt(this.dataset.amount);
            if (amount <= Math.floor(gameState.balance)) {
                crashGame.betAmount = amount;
                betInput.value = amount;
                
                // Обновляем активную кнопку
                quickBetButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
            }
        };
    });
    
    // ==================== ОБРАБОТЧИКИ СОБЫТИЙ С ИСПРАВЛЕННОЙ ЛОГИКОЙ ====================
    
    // Главная кнопка действия с защитой от множественных кликов
    const mainActionBtn = document.getElementById('main-action-btn');
    if (mainActionBtn) {
        let isProcessing = false; // Флаг для предотвращения множественных кликов
        
        mainActionBtn.onclick = function() {
            // Предотвращаем множественные клики
            if (isProcessing) {
                console.log('Игнорируем повторный клик - операция уже выполняется');
                return;
            }
            
            isProcessing = true;
            
            try {
                const currentState = crashStateMachine.getCurrentState();
                
                if ((currentState === 'WAITING' || currentState === 'BETTING') && crashGame.isBettingPhase) {
                    if (crashGame.userBet) {
                        // Отменить ставку
                        crashGame.userBet = null;
                        updateMainActionButton();
                        console.log('Ставка отменена');
                    } else {
                        // Сделать ставку
                        if (crashGame.betAmount <= Math.floor(gameState.balance) && crashGame.betAmount > 0) {
                            // Проверка безопасности перед размещением ставки
                            if (crashSecurity.checkSuspiciousActivity('BET_PLACED', {
                                betAmount: crashGame.betAmount,
                                timestamp: Date.now()
                            })) {
                                showCrashNotification('Подозрительная активность обнаружена!', 'error');
                                return;
                            }
                            
                            // Атомарное размещение ставки
                            crashGame.userBet = crashGame.betAmount;
                            updateMainActionButton();
                            console.log(`Ставка сделана: ${crashGame.betAmount} ⭐`);
                            
                            // Логируем размещение ставки
                            logTransaction('BET_PLACED', {
                                betAmount: crashGame.betAmount,
                                roundNumber: crashGame.roundNumber,
                                timestamp: Date.now()
                            }, 0);
                        } else {
                            showCrashNotification('Недостаточно средств!', 'error');
                        }
                    }
                } else if (currentState === 'RUNNING') {
                    if (crashGame.userBet && !crashGame.hasCashedOut) {
                        // Вывести выигрыш - сохраняем множитель на момент вывода
                        const cashOutTime = Date.now();
                        const currentMultiplier = crashGame.currentMultiplier;
                        
                        // Проверяем, что множитель валиден
                        if (currentMultiplier >= 1.00 && currentMultiplier <= crashGame.targetMultiplier) {
                            crashGame.hasCashedOut = true;
                            crashGame.cashOutMultiplier = currentMultiplier;
                            
                            // НЕ выплачиваем здесь - выплата будет в processRoundResults()
                            updateMainActionButton();
                            
                            console.log(`Вывод на множителе: ${crashGame.cashOutMultiplier.toFixed(2)}x`);
                            showCrashNotification(`Вывод на ${crashGame.cashOutMultiplier.toFixed(2)}x!`, 'success');
                            
                            // Логируем вывод средств
                            logTransaction('CASH_OUT', {
                                betAmount: crashGame.userBet,
                                cashOutMultiplier: crashGame.cashOutMultiplier,
                                roundNumber: crashGame.roundNumber,
                                timestamp: cashOutTime
                            }, 0);
                        } else {
                            console.error('Некорректный множитель для вывода:', currentMultiplier);
                            showCrashNotification('Ошибка вывода средств!', 'error');
                        }
                    }
                }
            } finally {
                // Сбрасываем флаг обработки через небольшую задержку
                setTimeout(() => {
                    isProcessing = false;
                }, 100);
            }
        };
    }
}

// Добавляем CSS анимации для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        to {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Игра Краш готова к использованию
