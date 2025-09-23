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
    const gameScreen = document.getElementById('game-screen');
    const withdrawScreen = document.getElementById('withdraw-screen');
    const goToWithdrawBtn = document.getElementById('go-to-withdraw');
    const backButton = document.getElementById('back-from-withdraw');
    const notification = document.getElementById('notification');
    const successModal = document.getElementById('success-modal');
    const balanceCounter = document.getElementById('balance-counter');
    const energyBar = document.getElementById('energy-bar');
    const energyCounter = document = document.getElementById('energy-counter');
    
    // Элементы для экрана вывода
    const withdrawBalance = document.getElementById('withdraw-balance');
    const withdrawButtonsContainer = document.getElementById('withdraw-buttons-container');
    const withdrawStatusText = document.getElementById('withdraw-status-text');
    const withdrawInfo = document.getElementById('withdraw-info');
    const withdrawConfirmBtn = document.getElementById('withdraw-confirm-button');

    // --- THREE.JS ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let scene, camera, renderer, starMesh, pointLight;
    let energyRegenIntervalId = null;
    
    // Переменные для плавной анимации
    const BASE_SCALE = 2.5; // Увеличенный базовый размер звезды
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
        gameScreen.classList.add('hidden');
        withdrawScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    goToWithdrawBtn.addEventListener('click', () => {
        stopEnergyRegen(); 
        initWithdrawPage();
        showScreen(withdrawScreen);
    });

    backButton.addEventListener('click', () => {
        updateBalanceUI();
        startEnergyRegen(); 
        showScreen(gameScreen);
    });

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
        if (withdrawBalance) {
            withdrawBalance.innerText = Math.floor(gameState.balance).toLocaleString('ru-RU');
        }
    }
    
    function updateEnergyUI() {
        const percentage = (gameState.energy / config.maxEnergy) * 100;
        energyBar.style.width = `${percentage}%`;
        energyCounter.innerText = `${Math.floor(gameState.energy)}/${config.maxEnergy}`;
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
        if (!container || !THREE) return;

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
            },
            undefined,
            function (error) {
                console.error('An error happened during model loading:', error);
                const geometry = new THREE.IcosahedronGeometry(1.5, 1);
                const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                starMesh = new THREE.Mesh(geometry, material);
                starMesh.scale.set(BASE_SCALE, BASE_SCALE, BASE_SCALE);
                starMesh.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
                scene.add(starMesh);
            }
        );
        
        function animate() {
            requestAnimationFrame(animate);

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
            const bgElement = document.body; // or document.getElementById('game-screen');
            if(bgElement) {
                const newBgColor = new THREE.Color();
                newBgColor.lerpColors(bgColorStart, bgColorEnd, colorPhase);
                bgElement.style.backgroundColor = `#${newBgColor.getHexString()}`;
            }

            renderer.render(scene, camera);
        }
        animate();
        
        renderer.domElement.addEventListener('click', onStarClick, false);
        window.addEventListener('resize', onWindowResize, false);
    }

    function onStarClick(event) {
        if (!starMesh || gameState.energy < config.energyPerClick) {
            if (gameState.energy < config.energyPerClick) showNotification();
            return;
        }
        
        const container = document.getElementById('star-container');
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
        const withdrawAmounts = [200, 400, 600, 800, 1000, 1600, 2200];
        const userBalance = Math.floor(gameState.balance);
        let selectedAmount = 0;

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
        function updateWithdrawUI(amount, isMax = false) {
            selectedAmount = amount;
            if (isMax) {
                const commission = amount * getCommission(amount);
                const totalDeducted = amount + commission;
                withdrawStatusText.innerText = `Вы получите ⭐ ${Math.floor(amount / 200).toLocaleString('ru-RU')} звёзд за вычетом комиссии ✨ ${Math.floor(commission).toLocaleString('ru-RU')}. Всего будет списано ✨ ${Math.floor(totalDeducted).toLocaleString('ru-RU')}.`;
            } else {
                const commission = amount * getCommission(amount);
                const totalDeducted = amount + commission;
                withdrawStatusText.innerText = `Вы получите ⭐ ${Math.floor(amount / 200).toLocaleString('ru-RU')} звёзд за вычетом комиссии ✨ ${Math.floor(commission).toLocaleString('ru-RU')}. Всего будет списано ✨ ${Math.floor(totalDeducted).toLocaleString('ru-RU')}.`;
            }
            withdrawInfo.classList.remove('hidden');
            withdrawConfirmBtn.classList.remove('hidden');
            withdrawConfirmBtn.disabled = (amount + (amount * getCommission(amount))) > userBalance;
        }

        // Проверка дневного лимита
        withdrawConfirmBtn.disabled = true;
        withdrawButtonsContainer.innerHTML = '';
        withdrawInfo.classList.add('hidden');
        withdrawConfirmBtn.classList.add('hidden');

        if (gameState.withdrawalsToday.count >= 2) {
            withdrawStatusText.innerText = `Вы достигли дневного лимита операций на сегодня (2/2). Попробуйте завтра.`;
            withdrawInfo.classList.remove('hidden');
        } else {
            // Создание кнопок для вывода
            withdrawAmounts.forEach(amount => {
                const button = document.createElement('button');
                button.className = 'withdraw-btn';
                button.innerText = `${amount}`;
                button.disabled = (amount + (amount * getCommission(amount))) > userBalance;
                button.addEventListener('click', () => updateWithdrawUI(amount));
                withdrawButtonsContainer.appendChild(button);
            });
            // Кнопка MAX
            const maxButton = document.createElement('button');
            maxButton.className = 'withdraw-btn';
            maxButton.innerText = 'MAX';
            const maxAmount = Math.floor(userBalance / (1 + getCommission(userBalance))) || 0;
            maxButton.disabled = maxAmount < 200;
            maxButton.addEventListener('click', () => updateWithdrawUI(maxAmount, true));
            withdrawButtonsContainer.appendChild(maxButton);

            withdrawStatusText.innerText = `Сегодня вы можете вывести средства ещё ${2 - gameState.withdrawalsToday.count} раз. Выберите сумму:`;
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
                const jsonData = { action: "withdraw", withdraw_amount: amount, commission_amount: commission, total_deducted: totalDeducted, bot_stars_received: botStars };
                try {
                    tg.sendData(JSON.stringify(jsonData));
                } catch(e) { console.error("Couldn't send data to Telegram", e); }

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
                }, 3000);
            }
        };

        updateBalanceUI();
    }

    // --- ОБЩИЕ ФУНКЦИИ И ЗАПУСК ---
    function showNotification() {
        notification.classList.remove('hidden');
        setTimeout(() => notification.classList.add('hidden'), 3000);
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
    initGamePage();
    showScreen(gameScreen);
});

