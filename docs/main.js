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
    const config = {
        maxEnergy: 200,
        energyPerClick: 1,
        starPerClick: 1,
        energyRegenRate: 1,
        energyRegenInterval: 20000 // Теперь 1 единица раз в 20 секунд
    };

    let gameState = {
        balance: 0,
        energy: config.maxEnergy,
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
        if (screen) screen.classList.remove('hidden');
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
    function saveState() {
        localStorage.setItem('maniacClicState', JSON.stringify(gameState));
    }

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
            const intervalsPassed = Math.floor(elapsedSeconds / (config.energyRegenInterval / 1000));

            if (intervalsPassed > 0) {
                const energyToRegen = intervalsPassed * config.energyRegenRate;
                gameState.energy = Math.min(config.maxEnergy, gameState.energy + energyToRegen);
            }
        }
        gameState.lastUpdate = Date.now();
        saveState();
    }
    
    // --- ОБНОВЛЕНИЕ UI И АНИМАЦИИ ---
    function updateBalanceUI() {
        if (balanceCounter) {
            balanceCounter.innerText = Math.floor(gameState.balance).toLocaleString('ru-RU');
        }
    }
    
    function updateEnergyUI() {
        const percentage = (gameState.energy / config.maxEnergy) * 100;
        if (energyBar) {
            energyBar.style.width = `${percentage}%`;
        }
        if (energyCounter) {
            energyCounter.innerText = `${Math.floor(gameState.energy)}/${config.maxEnergy}`;
        }
    }

    function checkEnergy() {
        const starContainer = document.getElementById('star-container');
        if (starContainer) {
            starContainer.classList.toggle('disabled', gameState.energy < config.energyPerClick);
        }
    }

    function playClickAnimations(x, y) {
        const textAnim = document.createElement('div');
        textAnim.className = 'click-animation-text';
        textAnim.innerText = `+${config.starPerClick}`;
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
            if (gameState.energy < config.maxEnergy) {
                gameState.energy = Math.min(config.maxEnergy, gameState.energy + config.energyRegenRate);
                gameState.lastUpdate = Date.now();
                updateEnergyUI();
                checkEnergy();
                saveState();
            }
        }, config.energyRegenInterval);
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
        if (!starMesh || gameState.energy < config.energyPerClick) {
            if (gameState.energy < config.energyPerClick) showNotification();
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
            gameState.energy -= config.energyPerClick;
            gameState.balance += config.starPerClick;

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
        withdrawConfirmBtn.onclick = () => {
            if (withdrawConfirmBtn.disabled || selectedAmount === 0) return;
            const amount = selectedAmount;
            const commissionRate = getCommission(amount);
            const commission = Math.round(amount * commissionRate);
            const totalDeducted = amount + commission;

            if (totalDeducted <= userBalance) {
                const botStars = amount / 200;
                
                // Получаем данные пользователя
                const userData = getTelegramUserData();
                
                // Подготавливаем данные для отправки боту
                const withdrawData = {
                    action: "withdraw",
                    user_id: userData?.id || null,
                    user_info: userData,
                    withdraw_amount: amount,
                    commission_amount: commission,
                    total_deducted: totalDeducted,
                    bot_stars_received: botStars,
                    timestamp: Date.now(),
                    game_version: "1.0"
                };
                
                // Отправляем данные боту
                if (!sendDataToBot(withdrawData)) {
                    alert('Ошибка отправки данных. Попробуйте еще раз.');
                    return;
                }

                // Обновляем локальное состояние только после успешной отправки
                gameState.balance -= totalDeducted;
                gameState.withdrawalsToday.count++;
                saveState();

                document.getElementById('success-message').innerText = `⭐ ${botStars.toLocaleString('ru-RU')} звёзд зачислены в бота.`;
                successModal.classList.remove('hidden');

                setTimeout(() => {
                    successModal.classList.add('hidden');
                    updateBalanceUI();
                    showScreen(gameScreen);
                    startEnergyRegen();
                    initThreeJSScene();
                }, 3000);
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
    console.log('Telegram WebApp данные:', {
        initData: tg.initData,
        initDataUnsafe: tg.initDataUnsafe,
        user: getTelegramUserData()
    });
    
    // Показываем загрузочный экран сначала
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
    
    // Инициализируем игру (это запустит загрузку 3D модели)
    initGamePage();
    
    // Игровой экран будет показан после скрытия загрузочного экрана
});

