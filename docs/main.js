document.addEventListener('DOMContentLoaded', () => {
    console.log("Running Maniac Clic main.js version 5.0 - Static Star with Wobble Animation");

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
        energyRegenInterval: 10000
    };

    let gameState = {
        balance: 0,
        energy: config.maxEnergy,
        lastUpdate: Date.now()
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
    const energyCounter = document.getElementById('energy-counter');
    
    // --- THREE.JS ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    let scene, camera, renderer, starMesh, pointLight;
    let energyRegenIntervalId = null;


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
        const withdrawBalance = document.getElementById('withdraw-balance');
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
        pointLight = new THREE.PointLight(0x00ffff, 1.5, 100);
        pointLight.position.set(0, 0, 5);
        scene.add(pointLight);
        
        const loader = new THREE.GLTFLoader();
        const modelPath = 'Galactic_Starburst_0923140405_texture.glb'; 

        loader.load(
            modelPath,
            function (gltf) {
                starMesh = gltf.scene;
                starMesh.scale.set(2, 2, 2); 
                scene.add(starMesh);
                console.log("3D model loaded successfully!");
            },
            undefined,
            function (error) {
                console.error('Ошибка при загрузке модели:', error);
                const geometry = new THREE.IcosahedronGeometry(1.5, 1);
                const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
                starMesh = new THREE.Mesh(geometry, material);
                scene.add(starMesh);
            }
        );
        
        function animate() {
            requestAnimationFrame(animate);
            // ИЗМЕНЕНО: Постоянное вращение звезды удалено.
            if(pointLight){
                const time = Date.now() * 0.001;
                pointLight.position.x = Math.sin(time * 0.7) * 4;
                pointLight.position.y = Math.cos(time * 0.5) * 4;
                pointLight.position.z = Math.cos(time * 0.3) * 4;
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
            
            // ИЗМЕНЕНО: Анимация клика заменена на "пошатывание"
            if (starMesh) {
                // 1. Уменьшаем звезду
                starMesh.scale.set(1.8, 1.8, 1.8);

                // 2. Слегка поворачиваем ее в случайную сторону для эффекта "удара"
                starMesh.rotation.z = (Math.random() - 0.5) * 0.2;
                starMesh.rotation.x = (Math.random() - 0.5) * 0.2;

                // 3. Через 120мс возвращаем в исходное состояние
                setTimeout(() => {
                    starMesh.scale.set(2, 2, 2);
                    starMesh.rotation.z = 0;
                    starMesh.rotation.x = 0;
                }, 120);
            }
            
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
        const slider = document.getElementById('withdraw-slider');
        const calcAmount = document.getElementById('calc-amount');
        const calcCommission = document.getElementById('calc-commission');
        const calcTotal = document.getElementById('calc-total');
        const calcBotStars = document.getElementById('calc-bot-stars');
        const withdrawButton = document.getElementById('withdraw-button');

        updateBalanceUI();
        const userBalance = Math.floor(gameState.balance);
        const minWithdraw = 200;
        const step = 200;

        const maxWithdraw = Math.floor(userBalance / step) * step;

        slider.min = minWithdraw;
        slider.step = step;

        if (maxWithdraw >= minWithdraw) {
            slider.disabled = false;
            slider.max = maxWithdraw;
            slider.value = minWithdraw;
        } else {
            slider.disabled = true;
            slider.max = minWithdraw;
            slider.value = minWithdraw;
        }

        function updateCalculator() {
            const amount = parseInt(slider.value);
            const commission = Math.round(amount * 0.07);
            const totalDeducted = amount + commission;
            const botStars = amount / 200;

            calcAmount.innerText = `✨ ${amount.toLocaleString('ru-RU')}`;
            calcCommission.innerText = `✨ ${commission.toLocaleString('ru-RU')}`;
            calcTotal.innerText = `✨ ${totalDeducted.toLocaleString('ru-RU')}`;
            calcBotStars.innerText = `⭐ ${botStars.toLocaleString('ru-RU')}`;
            withdrawButton.disabled = slider.disabled || (totalDeducted > userBalance);
        }

        slider.oninput = updateCalculator;

        withdrawButton.onclick = () => {
            if (withdrawButton.disabled) return;
            const amount = parseInt(slider.value);
            const commission = Math.round(amount * 0.07);
            const totalDeducted = amount + commission;

            if (totalDeducted <= userBalance) {
                const botStars = amount / 200;
                const jsonData = { action: "withdraw", withdraw_amount: amount, commission_amount: commission, total_deducted: totalDeducted, bot_stars_received: botStars };
                try {
                    tg.sendData(JSON.stringify(jsonData));
                } catch(e) { console.error("Couldn't send data to Telegram", e); }

                gameState.balance -= totalDeducted;
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
        updateCalculator();
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

