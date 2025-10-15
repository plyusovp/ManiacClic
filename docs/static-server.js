const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;

// MIME типы для различных файлов
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm',
    '.glb': 'model/gltf-binary'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Парсим URL
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname;

    // Если запрос к корню, перенаправляем на index.html
    if (pathname === '/') {
        pathname = '/index.html';
    }

    // Убираем /docs из пути, если он есть
    if (pathname.startsWith('/docs/')) {
        pathname = pathname.substring(6);
    }

    // Полный путь к файлу
    const filePath = path.join(__dirname, pathname);

    // Проверяем безопасность пути (защита от directory traversal)
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    // Проверяем существование файла
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`Файл не найден: ${filePath}`);
            res.writeHead(404);
            res.end('File not found');
            return;
        }

        // Получаем расширение файла
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        // Читаем и отправляем файл
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log(`Ошибка чтения файла: ${err.message}`);
                res.writeHead(500);
                res.end('Internal Server Error');
                return;
            }

            // Устанавливаем заголовки CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Статический сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Обслуживает файлы из: ${__dirname}`);
    console.log(`🌐 Откройте: http://localhost:${PORT}/index.html`);
});

// Обработка завершения процесса
process.on('SIGINT', () => {
    console.log('\n🛑 Сервер остановлен');
    server.close();
    process.exit(0);
});
