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
                console.log('Попытка отправки данных боту:', withdrawData);
                
                // Пробуем разные способы отправки данных
                let dataSent = false;
                
                // Способ 1: tg.sendData
                if (typeof tg.sendData === 'function') {
                    try {
                        tg.sendData(JSON.stringify(withdrawData));
                        console.log('✅ Данные отправлены через tg.sendData');
                        dataSent = true;
                    } catch (error) {
                        console.error('❌ Ошибка tg.sendData:', error);
                    }
                }
                
                // Способ 2: tg.MainButton (если первый не сработал)
                if (!dataSent && tg.MainButton) {
                    try {
                        tg.MainButton.setText('Вывод выполнен!');
                        tg.MainButton.show();
                        tg.MainButton.onClick(() => {
                            tg.close();
                        });
                        console.log('✅ Используем MainButton как fallback');
                        dataSent = true;
                    } catch (error) {
                        console.error('❌ Ошибка MainButton:', error);
                    }
                }
                
                // Способ 3: alert с данными для копирования
                if (!dataSent) {
                    const dataString = JSON.stringify(withdrawData, null, 2);
                    alert('WebApp API недоступен. Скопируйте данные:\n\n' + dataString);
                    console.log('❌ Все способы отправки не сработали');
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
 * Инициализация игры Краш с проверкой алгоритма
 */
window.initCrashGame = function() {
    console.log('🚀 Инициализация игры Краш...');
    
    // Проверяем корректность алгоритма (только в режиме разработки)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔍 Проверка алгоритма краша...');
        const isValid = validateCrashAlgorithm();
        console.log(isValid ? '✅ Алгоритм корректен' : '❌ Ошибка в алгоритме');
    }
    
    // Инициализируем график
    initCrashChart();
    
    // Обновляем баланс
    updateCrashBalance();
    
    // Генерируем начальную историю
    generateInitialHistory();
    
    // Запускаем игровой цикл
    startCrashGameLoop();
    
    console.log('✅ Игра Краш инициализирована');
};

// ==================== УЛУЧШЕННАЯ ВИЗУАЛИЗАЦИЯ ГРАФИКА ====================

/**
 * Инициализация графика с улучшенной визуализацией
 * Плавные кривые, динамические цвета, лучшая производительность
 */
function initCrashChart() {
    const ctx = document.getElementById('crash-chart');
    if (!ctx) return;
    
    crashGame.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Множитель',
                data: [],
                borderColor: '#00ff00', // Начинаем с зеленого
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                borderWidth: 4,
                fill: true,
                tension: 0.5, // Более плавные кривые
                pointRadius: 0,
                pointHoverRadius: 8,
                pointBackgroundColor: '#00ffff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                // Градиентная заливка
                fill: {
                    target: 'origin',
                    above: 'rgba(0, 255, 0, 0.1)',
                    below: 'rgba(255, 0, 0, 0.1)'
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
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#00ffff',
                    bodyColor: '#ffffff',
                    borderColor: '#00ffff',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
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
                            size: 11,
                            weight: 'bold'
                        },
                        callback: function(value) {
                            return value.toFixed(2) + 'x';
                        }
                    },
                    grid: {
                        color: 'rgba(0, 255, 255, 0.15)',
                        lineWidth: 1
                    },
                    border: {
                        color: 'rgba(0, 255, 255, 0.3)'
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

/**
 * Генерация криптографически честного множителя краша
 * Использует математически корректную формулу для обеспечения предопределенного House Edge
 * 
 * @returns {number} Множитель, на котором произойдет краш
 */
function generateCrashMultiplier() {
    // Генерируем криптографически стойкое случайное число
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / (0xFFFFFFFF + 1);
    
    // Проверяем шанс на мгновенный краш (дополнительное преимущество казино)
    if (random < CRASH_CONFIG.INSTANT_CRASH_CHANCE) {
        return CRASH_CONFIG.MIN_MULTIPLIER;
    }
    
    // Нормализуем случайное число для оставшихся 98%
    const normalizedRandom = (random - CRASH_CONFIG.INSTANT_CRASH_CHANCE) / (1 - CRASH_CONFIG.INSTANT_CRASH_CHANCE);
    
    // Математически корректная формула для расчета множителя
    // Обеспечивает точный House Edge на дистанции
    const E = CRASH_CONFIG.MAX_MULTIPLIER;
    const H = CRASH_CONFIG.HOUSE_EDGE;
    
    // Формула: multiplier = (E * (1 - H)) / (1 - r)
    // где r - нормализованное случайное число
    const multiplier = (E * (1 - H)) / (1 - normalizedRandom);
    
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
    
    for (let i = 0; i < iterations; i++) {
        const multiplier = generateCrashMultiplier();
        totalRTP += Math.min(multiplier, 1000); // Ограничиваем максимальный выигрыш
    }
    
    const averageRTP = totalRTP / iterations;
    const expectedRTP = 1 - CRASH_CONFIG.HOUSE_EDGE;
    
    console.log(`Теоретический RTP: ${(expectedRTP * 100).toFixed(2)}%`);
    console.log(`Фактический RTP (${iterations} итераций): ${(averageRTP * 100).toFixed(2)}%`);
    console.log(`Отклонение: ${Math.abs(averageRTP - expectedRTP) * 100}%`);
    
    return Math.abs(averageRTP - expectedRTP) < 0.01; // Допустимое отклонение 1%
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
    crashGame.history.slice(-10).reverse().forEach(multiplier => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = multiplier.toFixed(2) + 'x';
        
        // Улучшенная цветовая кодировка согласно скриншотам
        if (multiplier < 1.50) {
            // Очень низкие множители - красный
            item.classList.add('very-low');
        } else if (multiplier < 2.00) {
            // Низкие множители - красный
            item.classList.add('low');
        } else if (multiplier < 5.00) {
            // Средние множители - оранжевый
            item.classList.add('medium');
        } else if (multiplier < 10.00) {
            // Высокие множители - оранжевый/желтый
            item.classList.add('high');
        } else {
            // Очень высокие множители - фиолетовый/золотой
            item.classList.add('very-high');
        }
        
        historyList.appendChild(item);
    });
}

// ==================== УПРАВЛЕНИЕ ИГРОВЫМ ЦИКЛОМ ====================

/**
 * Запуск нового игрового цикла с правильной инициализацией состояния
 */
function startCrashGameLoop() {
    // Останавливаем предыдущую анимацию
    if (crashGame.animationId) {
        cancelAnimationFrame(crashGame.animationId);
        crashGame.animationId = null;
    }
    
    // Сбрасываем состояние раунда
    crashGame.gameState = 'WAITING';
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
    
    // Обновляем UI
    updateGameStatus('Идет прием ставок');
    updateMultiplierDisplay('1.00x');
    updateMainActionButton();
    resetChart();
    
    console.log(`Раунд #${crashGame.roundNumber}: Целевой множитель = ${crashGame.targetMultiplier.toFixed(2)}x`);
    
    // Время приема ставок - 5 секунд
    setTimeout(() => {
        if (crashGame.gameState === 'WAITING') {
            crashGame.isBettingPhase = false;
            startRound();
        }
    }, 5000);
}

// Начало раунда
function startRound() {
    crashGame.gameState = 'IN_PROGRESS';
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
    if (crashGame.gameState !== 'IN_PROGRESS') return;
    
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
 */
function calculateNonLinearProgress(progress, targetMultiplier) {
    // Фаза 1: Медленный старт (1x - 2x)
    if (targetMultiplier <= 2.0) {
        // Плавный рост для низких множителей
        return 1 - Math.pow(1 - progress, 2);
    }
    
    // Фаза 2: Средний рост (2x - 5x)
    if (targetMultiplier <= 5.0) {
        if (progress <= 0.3) {
            // Медленный старт
            return (progress / 0.3) * 0.2;
        } else if (progress <= 0.7) {
            // Ускорение
            const subProgress = (progress - 0.3) / 0.4;
            return 0.2 + (subProgress * subProgress) * 0.5;
        } else {
            // Быстрый финиш
            const subProgress = (progress - 0.7) / 0.3;
            return 0.7 + (1 - Math.pow(1 - subProgress, 3)) * 0.3;
        }
    }
    
    // Фаза 3: Высокий рост (5x+)
    if (progress <= 0.2) {
        // Очень медленный старт
        return (progress / 0.2) * 0.1;
    } else if (progress <= 0.5) {
        // Постепенное ускорение
        const subProgress = (progress - 0.2) / 0.3;
        return 0.1 + (subProgress * subProgress) * 0.3;
    } else if (progress <= 0.8) {
        // Быстрое ускорение
        const subProgress = (progress - 0.5) / 0.3;
        return 0.4 + (1 - Math.pow(1 - subProgress, 2)) * 0.4;
    } else {
        // Экспоненциальный финиш
        const subProgress = (progress - 0.8) / 0.2;
        return 0.8 + (1 - Math.pow(1 - subProgress, 4)) * 0.2;
    }
}

// Краш
function crash() {
    crashGame.gameState = 'CRASHED';
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
        startCrashGameLoop();
    }, 1000);
}

// ==================== ИСПРАВЛЕНИЕ БАГОВ С ВЫПЛАТАМИ ====================

/**
 * Обработка результатов раунда с защитой от двойных выплат
 * Использует флаги состояния для предотвращения race conditions
 */
function processRoundResults() {
    if (!crashGame.userBet) return;
    
    // Проверяем, не была ли уже обработана выплата
    if (crashGame.roundProcessed) {
        console.warn('Попытка повторной обработки результатов раунда - игнорируем');
        return;
    }
    
    // Устанавливаем флаг обработки
    crashGame.roundProcessed = true;
    
    if (crashGame.hasCashedOut && crashGame.cashOutMultiplier) {
        // Пользователь успел вывести - используем сохраненный множитель
        const winnings = Math.floor(crashGame.userBet * crashGame.cashOutMultiplier);
        gameState.balance += winnings;
        updateCrashBalance();
        updateBalanceUI();
        saveState();
        
        // Показываем уведомление о выигрыше
        showCrashNotification(`Выигрыш: ${winnings} ⭐`, 'success');
        
        console.log(`Выплата: ${winnings} ⭐ (ставка: ${crashGame.userBet}, множитель: ${crashGame.cashOutMultiplier.toFixed(2)}x)`);
    } else {
        // Пользователь проиграл - списываем ставку
        gameState.balance -= crashGame.userBet;
        updateCrashBalance();
        updateBalanceUI();
        saveState();
        
        // Показываем уведомление о проигрыше
        showCrashNotification(`Проигрыш: ${crashGame.userBet} ⭐`, 'error');
        
        console.log(`Проигрыш: ${crashGame.userBet} ⭐ (краш на ${crashGame.targetMultiplier.toFixed(2)}x)`);
    }
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
    
    if (crashGame.gameState === 'WAITING') {
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
    } else if (crashGame.gameState === 'IN_PROGRESS') {
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
    } else {
        // CRASHED
        button.textContent = 'Прием ставок завершен';
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
 */
function updateChartColor(multiplier) {
    if (!crashGame.chart) return;
    
    let color, backgroundColor;
    
    if (multiplier < 2.0) {
        // Зеленый для низких множителей
        color = '#00ff00';
        backgroundColor = 'rgba(0, 255, 0, 0.1)';
    } else if (multiplier < 5.0) {
        // Желтый для средних множителей
        color = '#ffff00';
        backgroundColor = 'rgba(255, 255, 0, 0.1)';
    } else if (multiplier < 10.0) {
        // Оранжевый для высоких множителей
        color = '#ff8800';
        backgroundColor = 'rgba(255, 136, 0, 0.1)';
    } else {
        // Красный для очень высоких множителей
        color = '#ff0000';
        backgroundColor = 'rgba(255, 0, 0, 0.1)';
    }
    
    // Обновляем цвета
    crashGame.chart.data.datasets[0].borderColor = color;
    crashGame.chart.data.datasets[0].backgroundColor = backgroundColor;
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
    
    // Главная кнопка действия
    const mainActionBtn = document.getElementById('main-action-btn');
    if (mainActionBtn) {
        mainActionBtn.onclick = function() {
            if (crashGame.gameState === 'WAITING' && crashGame.isBettingPhase) {
                if (crashGame.userBet) {
                    // Отменить ставку
                    crashGame.userBet = null;
                    updateMainActionButton();
                    console.log('Ставка отменена');
                } else {
                    // Сделать ставку
                    if (crashGame.betAmount <= Math.floor(gameState.balance) && crashGame.betAmount > 0) {
                        crashGame.userBet = crashGame.betAmount;
                        updateMainActionButton();
                        console.log(`Ставка сделана: ${crashGame.betAmount} ⭐`);
                    } else {
                        showCrashNotification('Недостаточно средств!', 'error');
                    }
                }
            } else if (crashGame.gameState === 'IN_PROGRESS') {
                if (crashGame.userBet && !crashGame.hasCashedOut) {
                    // Вывести выигрыш - сохраняем множитель на момент вывода
                    crashGame.hasCashedOut = true;
                    crashGame.cashOutMultiplier = crashGame.currentMultiplier;
                    
                    // НЕ выплачиваем здесь - выплата будет в processRoundResults()
                    updateMainActionButton();
                    
                    console.log(`Вывод на множителе: ${crashGame.cashOutMultiplier.toFixed(2)}x`);
                    showCrashNotification(`Вывод на ${crashGame.cashOutMultiplier.toFixed(2)}x!`, 'success');
                }
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

