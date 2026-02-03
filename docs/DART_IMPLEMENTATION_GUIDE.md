# Полная документация проекта Goszakupki KP Generator

Документ содержит исчерпывающую информацию для воссоздания аналогичного проекта на языке Dart.

---

## 1. Общее описание проекта

### 1.1 Назначение системы

Система представляет собой автоматизированный генератор коммерческих предложений для белорусского портала государственных закупок goszakupki.by. Основной workflow включает:

1. Пользователь вводит URL страницы закупки
2. Система автоматически извлекает данные со страницы
3. Обогащает данные через налоговый API Беларуси
4. Генерирует профессиональный PDF-документ
5. Опционально отправляет документ через Telegram

Целевая аудитория — компании, участвующие в государственных закупках Беларуси и регулярно подающие коммерческие предложения.

### 1.2 Технологический стек

**Серверная часть:**
- Node.js 18-22
- Express.js 4.18+
- Puppeteer 24.x (браузерная автоматизация)

**Генерация документов:**
- Handlebars 4.7 (шаблонизация)
- Puppeteer print-to-PDF (конвертация HTML в PDF)

**Интеграции:**
- Telegram Bot API (node-telegram-bot-api)
- Налоговый API Беларуси (grp.nalog.gov.by)

**Конфигурация:**
- dotenv 17.x (переменные окружения)

### 1.3 Структура проекта

```
goszakupki_auto_KP/
├── server.js              # Главный файл приложения
├── parser.js              # Модуль парсинга страниц
├── pdfGenerator.js        # Модуль генерации PDF
├── telegramSender.js       # Модуль отправки в Telegram
├── calculator-template.html # Шаблон коммерческого предложения
├── package.json           # Зависимости npm
├── .env                   # Конфигурация (не в репозитории)
├── data/
│   └── catalog.json       # Каталог товаров для автодополнения
├── generated/             # Сгенерированные PDF файлы
├── public/                # Статические файлы
├── images/                # Изображения (логотип, печать)
└── test/
    └── telegram_test.js   # Тест Telegram
```

---

## 2. Детальное описание модулей

### 2.1 Модуль parser.js

#### 2.1.1 Класс GoszakupkiParser

Центральный класс для парсинга страниц портала госзакупок.

```javascript
class GoszakupkiParser {
    constructor() {
        // Инициализация с селекторами из selectors.json
    }
    
    async parsePage(url) {
        // Основной метод парсинга страницы
        // Возвращает объект с извлеченными данными
    }
    
    async getCompanyDataFromAPI(unp) {
        // Запрос к налоговому API Беларуси
    }
    
    async checkNetworkConnectivity() {
        // Проверка доступности сети
    }
}
```

#### 2.1.2 Метод parsePage(url)

**Алгоритм работы:**

1. Создание новой страницы в Puppeteer
2. Настройка user-agent и viewport
3. Переход по URL с retry-логикой
4. Проверка на ошибки сети
5. Извлечение данных из таблиц страницы
6. Сохранение скриншота при ошибках

**Конфигурация Puppeteer для парсинга:**

```javascript
{
    viewport: { width: 1920, height: 1080 },
    headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    },
    timeout: 60000,
    waitUntil: 'domcontentloaded'
}
```

**Retry-логика при ошибках сети:**
- Максимальное количество попыток: 5
- Задержка между попытками: 5000ms
- Проверка типа ошибки (транзиентные ошибки = повтор, критические = остановка)

#### 2.1.3 Извлекаемые данные из страницы

**Основные данные компании-заказчика:**

```typescript
interface CustomerData {
    companyName: string;       // Полное название организации
    shortName: string;         // Краткое название
    unp: string;              // Учетный номер плательщика (9 цифр)
    address: string;           // Юридический адрес
    status: string;            // Статус (действующий/ликвидирован)
    registrationDate: string;  // Дата регистрации
}
```

**Данные о закупке:**

```typescript
interface ProcurementData {
    // Лот 1
    lotDescription: string;    // Описание лота
    lotCount: number;          // Количество
    lotUnit: string;           // Единица измерения (шт, кг, услуга и т.д.)
    
    // Лот 2 (опционально)
    hasSecondLot: boolean;
    lotDescription2: string;
    lotCount2: number;
    lotUnit2: string;
    
    // Условия закупки
    place: string;             // Место поставки
    payment: string;           // Порядок оплаты
    endDate: string;           // Срок подачи предложений
    date: string;              // Дата генерации документа
    
    // Техническая информация
    pageType: 'marketing' | 'tender' | 'request' | 'contract' | 'single-source';
    debugInfo?: object;
}
```

#### 2.1.4 Логика определения типа страницы

```javascript
const pageTypeDetectors = {
    marketing: /\/marketing\/view\//,
    tender: /\/tender\/view\//,
    request: /\/request\/view\//,
    contract: /\/contract\/view\//,
    'single-source': /\/single-source\/view\//
};
```

#### 2.1.5 Алгоритм извлечения UNP (учетный номер)

Проблема: UNP может быть перепутан с номером закупки.

**Решение:** Множественная проверка с контекстом:

```javascript
// 1. Поиск в "правильной" таблице (таблица с данными организации)
const correctTableTds = findCorrectTableTds(page);

// 2. Проверка на исключения
const excludePatterns = [
    /предложени[яю]/i,          // "предложение" в тексте
    /^01$/,                     // Только цифры "01"
    /^[0-9]{1,2}\/[0-9]{2,4}$/  // Номер закупки формата "01/2024"
];

// 3. Валидация: 9 цифр, не входит в exclude-список
const unpPattern = /^[0-9]{9}$/;
```

#### 2.1.6 Метод getCompanyDataFromAPI(unp)

**Запрос к налоговому API Беларуси:**

```
URL: https://grp.nalog.gov.by/api/nice/public/api/v1/unp/{unp}
Method: GET
Headers:
    Accept: application/json
    Accept-Encoding: gzip, deflate
    Connection: keep-alive
    User-Agent: (определяется динамически)
```

**Retry-логика с экспоненциальной задержкой:**

```javascript
const maxAttempts = 5;
const baseDelayMs = 20000;  // 20 секунд
const jitter = Math.random() * 1000;  // Случайный джиттер

// Формула задержки: baseDelay * 2^attempt + jitter
const attemptDelay = baseDelayMs * Math.pow(2, attempt) + jitter;
```

**Типичные ошибки API:**

```typescript
interface ApiError {
    code: number;      // Код ошибки
    message: string;  // Сообщение об ошибке
    isTransient: boolean;  // Можно ли повторить запрос
}

// Примеры:
- 404: УНП не найден
- 429: Превышен лимит запросов (транзиентная)
- 500: Внутренняя ошибка сервера (транзиентная)
- ECONNRESET: Сброс соединения (транзиентная)
```

**Агент с keep-alive для HTTPS:**

```javascript
const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 5,
    rejectUnauthorized: false  // Для обхода некоторых SSL-проблем
});
```

**Успешный ответ API:**

```typescript
interface NiceApiResponse {
    unp: "193896074";
    fullName: "Общество с ограниченной ответственностью \"ХЕССЕР-ПЛЮС\"";
    shortName: "ООО \"Хессер-Плюс\"";
    address: "220045, г.Минск, ул. Кальварийская, д. 25, пом. 420";
    registrationDate: "2023-04-20";
    taxOfficeCode: "110";
    taxOfficeName: "Инспекция МНС по Первомайскому району г.Минска";
    statusCode: "1";
    statusName: "Действующий";
    statusChangeDate: null;
}
```

**Известные исключения:**
- UNP `101223447` зарезервирован как тестовый и исключается из парсинга

---

### 2.2 Модуль pdfGenerator.js

#### 2.2.1 Класс PDFGenerator

```javascript
class PDFGenerator {
    constructor() {
        this.templatePath = path.join(__dirname, 'calculator-template.html');
        this.generatedDir = path.join(__dirname, 'generated');
    }
    
    async generatePDF(data, options) {
        // Основной метод генерации PDF
    }
    
    async generatePDFFromURL(url, extraData) {
        // Генерация PDF из URL с автоматическим парсингом
    }
}
```

#### 2.2.2 Подготовка данных для шаблона

```typescript
interface TemplateData {
    // Данные компании-исполнителя
    LOGO_PATH: string;      // Base64 или путь к логотипу
    PECHAT_PATH: string;    // Base64 или путь к печати
    
    // Данные заказчика
    COMPANY_NAME: string;
    UNP: string;
    ADDRESS: string;
    
    // Метаданные документа
    DATE: string;          // Дата генерации (формат ДД.ММ.ГГГГ)
    
    // Условия закупки
    PLACE: string;
    PAYMENT: string;
    END_DATE: string;
    FREE_DESCRIPTION?: string;
    
    // Лот 1 (старый формат - одна позиция)
    lot_description?: string;
    lot_count?: number;
    lot_unit?: string;
    unit_price?: number;
    total_amount?: number;
    
    // Лот 1 (новый формат - массив позиций)
    lot_1_items?: LotItem[];
    has_first_lot?: boolean;
    
    // Лот 2 (старый формат)
    lot_description_2?: string;
    lot_count_2?: number;
    lot_unit_2?: string;
    unit_price_2?: number;
    total_amount_2?: number;
    lot_number_2?: number;
    
    // Лот 2 (новый формат)
    lot_2_items?: LotItem[];
    has_second_lot?: boolean;
    
    // Итоги
    total_summary_amount?: number;
    
    // Данные из API
    API_DATA?: object;
}

interface LotItem {
    name: string;
    quantity: number;
    unit: string;
    price: number;
}
```

#### 2.2.3 Вспомогательные функции Handlebars

```javascript
Handlebars.registerHelper('formatNumber', function(value) {
    // Форматирование числа с разделителями пробелов
    // 10000.50 → "10 000,50"
    return value.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
});

Handlebars.registerHelper('multiply', function(a, b) {
    return a * b;
});

Handlebers.registerHelper('increment', function(index) {
    return index + 1;
});
```

#### 2.2.4 Обработка изображений

**Логотип и печать конвертируются в Base64:**

```javascript
class PDFGenerator {
    imageToBase64(imagePath) {
        const candidates = [
            imagePath,
            path.join(__dirname, '..', 'images', imagePath),
            path.join(process.cwd(), imagePath),
            path.join(process.cwd(), 'images', imagePath)
        ];
        
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return fs.readFileSync(candidate, 'base64');
            }
        }
        return null;
    }
}
```

#### 2.2.5 Генерация PDF через Puppeteer

```javascript
async generatePDF(templateData) {
    // 1. Компиляция шаблона Handlebars
    const htmlContent = Handlebars.compile(templateSource)(templateData);
    
    // 2. Генерация уникального имени файла
    const timestamp = new Date();
    const fileName = `KP_${companyName}_${year}${month}${day}_${hours}${minutes}${seconds}.pdf`;
    
    // 3. Настройки Puppeteer для печати
    const browserOptions = {
        headless: process.env.HEADLESS !== 'false',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    };
    
    // 4. Параметры печати PDF
    const pdfOptions = {
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '15mm',
            right: '15mm',
            bottom: '15mm',
            left: '15mm'
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true
    };
    
    // 5. Печать страницы в PDF
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await page.pdf(pdfOptions);
}
```

#### 2.2.6 Формат имени файла

```
KP_{companyName}_{YYYYMMDD}_{HHmmss}.pdf

Пример:
KP_ООО_Минскводоканал_20240115_143052.pdf
```

---

### 2.3 Модуль server.js

#### 2.3.1 Инициализация браузера

```javascript
let browserInstance = null;

async function initializeBrowser() {
    const headless = process.env.HEADLESS !== 'false';
    
    const launchOptions = {
        headless: headless,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--hide-scrollbars',
            '--disable-notifications',
            '--disable-extensions',
            '--mute-audio'
        ]
    };
    
    if (!headless) {
        // Для разработки: не скрывать окно браузера
        delete launchOptions.args;
    }
    
    browserInstance = await puppeteer.launch(launchOptions);
}

async function ensureBrowser() {
    if (!browserInstance || !browserInstance.isConnected()) {
        await initializeBrowser();
    }
}
```

#### 2.3.2 API Endpoints

**POST /generate**

Генерация PDF из URL страницы закупки.

```http
POST /generate
Content-Type: application/json

{
    "url": "https://goszakupki.by/marketing/view/12345",
    "unitPrice": 1500.00,        // Цена за единицу лота 1
    "unitPrice2": null,           // Цена за единицу лота 2 (опционально)
    "includeLot1": true,         // Включить лот 1 в КП
    "includeLot2": false,        // Включить лот 2 в КП
    "freeDescription": "",       // Дополнительное описание
    "unit1": "услуга",           // Единица измерения лота 1
    "unit2": null                // Единица измерения лота 2
}
```

**Ответ:**

```json
{
    "success": true,
    "fileName": "KP_company_20240115_143052.pdf",
    "filePath": "/path/to/generated/KP_company_20240115_143052.pdf",
    "url": "https://goszakupki.by/marketing/view/12345",
    "companyShortName": "ООО Компания",
    "proposalEndDate": "2024-01-20"
}
```

---

**POST /api/generate-manual**

Генерация PDF с ручным вводом данных (поддержка каталога товаров).

```http
POST /api/generate-manual
Content-Type: application/json

{
    "customerName": "ООО Минскводоканал",
    "customerUnp": "193896074",
    "customerAddress": "г. Минск, ул. Примерная, д. 1",
    "skipUnpApi": false,         // Пропустить запрос к налоговому API
    "includeLot1": true,
    "includeLot2": false,
    
    // Массив позиций лота 1 (новый формат)
    "lot1Items": [
        {"name": "Товар 1", "quantity": 10, "price": 150.00, "unit": "шт"},
        {"name": "Товар 2", "quantity": 5, "price": 300.00, "unit": "компл"}
    ],
    
    // Массив позиций лота 2 (опционально)
    "lot2Items": [],
    
    "freeDescription": "Гарантия 24 месяца",
    "place": "г. Минск, склад по адресу...",
    "payment": "100% предоплата в течение 5 дней",
    "endDate": "2024-01-20"
}
```

---

**POST /api/save-catalog**

Сохранение каталога товаров для автодополнения.

```http
POST /api/save-catalog
Content-Type: application/json

{
    "items": [
        {"name": "Товар 1", "quantity": 10, "price": 150.00, "unit": "шт"},
        {"name": "Товар 2", "quantity": 5, "price": 300.00, "unit": "компл"}
    ]
}
```

**Ответ:**

```json
{
    "success": true,
    "message": "Каталог успешно сохранен в data/catalog.json"
}
```

---

**GET /api/company/:unp**

Получение данных компании из налогового API.

```http
GET /api/company/193896074
```

**Ответ:**

```json
{
    "success": true,
    "data": {
        "unp": "193896074",
        "fullName": "Общество с ограниченной ответственностью \"ХЕССЕР-ПЛЮС\"",
        "shortName": "ООО \"Хессер-Плюс\"",
        "address": "220045, г.Минск, ул. Кальварийская, д. 25, пом. 420",
        "status": "Действующий",
        "registrationDate": "2023-04-20"
    }
}
```

---

**POST /send-to-telegram**

Отправка сгенерированного PDF в Telegram.

```http
POST /send-to-telegram
Content-Type: application/json

{
    "fileName": "KP_company_20240115_143052.pdf",
    "chatId": "-1001234567890",  // ID чата (отрицательный для супергрупп)
    "caption": "Коммерческое предложение для ООО Минскводоканал",
    "proposalEndDate": "2024-01-20",
    "companyShortName": "ООО Минскводоканал"
}
```

**Ответ:**

```json
{
    "success": true,
    "message": "Документ успешно отправлен в Telegram"
}
```

---

**GET /telegram-status**

Проверка доступности Telegram.

```http
GET /telegram-status
```

**Ответ:**

```json
{
    "available": true,
    "botInfo": {
        "id": 123456789,
        "username": "mybot",
        "first_name": "My Bot"
    },
    "message": "Telegram бот доступен"
}
```

---

**GET /health**

Проверка здоровья сервера.

```http
GET /health
```

**Ответ:**

```json
{
    "status": "ok",
    "timestamp": "2024-01-15T14:30:52.000Z",
    "uptime": 3600.5
}
```

#### 2.3.3 Управление портами (Port Fallback)

```javascript
async function startServer() {
    const preferredPort = process.env.PORT || 3001;
    const maxAttempts = 5;
    let selectedPort = null;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            selectedPort = preferredPort + attempt;
            await new Promise(resolve => {
                serverInstance = app.listen(selectedPort, '0.0.0.0', resolve);
            });
            console.log(`Server running on port ${selectedPort}`);
            break;
        } catch (error) {
            if (error.code === 'EADDRINUSE') {
                console.log(`Port ${selectedPort} is busy, trying next...`);
                continue;
            }
            throw error;
        }
    }
}
```

#### 2.3.4 Очистка старых файлов

```javascript
function cleanupGeneratedFiles() {
    const files = fs.readdirSync(generatedDir);
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24 часа
    
    files.forEach(file => {
        const filePath = path.join(generatedDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
        }
    });
}
```

---

### 2.4 Модуль telegramSender.js

#### 2.4.1 Класс TelegramSender

```javascript
class TelegramSender {
    constructor(token, chatId) {
        this.bot = new TelegramBot(token, { polling: false });
        this.defaultChatId = chatId;
    }
    
    async sendDocument(filePath, options) {
        const chatId = options.chatId || this.defaultChatId;
        
        await this.bot.sendDocument(chatId, filePath, {
            caption: options.caption,
            parse_mode: 'HTML'
        });
    }
    
    async checkAvailability() {
        try {
            const botInfo = await this.bot.getMe();
            return {
                available: true,
                botInfo: {
                    id: botInfo.id,
                    username: botInfo.username,
                    first_name: botInfo.first_name
                }
            };
        } catch (error) {
            return {
                available: false,
                message: error.message
            };
        }
    }
}
```

#### 2.4.2 Форматирование сообщения

```javascript
function formatMessage(data) {
    return `
📄 <b>Коммерческое предложение</b>

🏢 Компания: ${data.companyShortName}
📅 Срок подачи: ${data.proposalEndDate}

<i>Файл: ${data.fileName}</i>
    `.trim();
}
```

---

### 2.5 Шаблон calculator-template.html

#### 2.5.1 Структура HTML-шаблона

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Коммерческое предложение</title>
    <style>
        @media print {
            @page {
                size: A4;
                margin: 15mm;
            }
            body {
                margin: 0;
                padding: 0;
            }
        }
        
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .header-table td {
            vertical-align: top;
        }
        
        .company-details {
            text-align: left;
            font-size: 10pt;
            line-height: 1.3;
        }
        
        .price-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
            font-size: 10pt;
        }
        
        .price-table th,
        .price-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            text-align: left;
        }
        
        .price-table th {
            background: #f0f0f0;
            font-weight: bold;
        }
        
        .footer-info {
            margin-top: 0px;
            font-weight: bold;
        }
        
        .signature-table {
            width: 100%;
            margin-top: 40px;
            border-collapse: collapse;
        }
    </style>
</head>
<body>
    <!-- Шапка документа -->
    <table class="header-table">
        <tr>
            <td style="width: 20%; vertical-align: top">
                <img src="{{LOGO_PATH}}" alt="Hesser Group Logo" style="max-width: 150px;"/>
            </td>
            <td style="width: 50%; vertical-align: top; text-align: left; font-size: 10pt;">
                <strong>ООО "Хессер-Плюс"</strong><br/>
                УНП 193896074<br/>
                Р-с BY76 ALFA... в ЗАО "Альфа-банк"<br/>
                Юр. адрес: 220045, г. Минск, ул. Кальварийская, д. 25, пом. 420<br/>
                тел. +375 (29) 252-49-88 - Meter.by
            </td>
            <td style="width: 30%; vertical-align: top; padding-left: 15px; border-left: 1px solid #ccc; font-size: 10pt;">
                <strong>Заказчик:</strong><br/>
                {{COMPANY_NAME}}<br/>
                УНП: {{UNP}}<br/>
                {{ADDRESS}}
            </td>
        </tr>
    </table>
    
    <div class="doc-number">Исх. № ___ от {{DATE}}</div>
    
    <h2>Ценовое предложение:</h2>
    
    <!-- Таблица с лотами -->
    <table class="price-table">
        <thead>
            <tr>
                <th style="width: 5%">№ п/п</th>
                <th style="width: 45%">Наименование</th>
                <th style="width: 15%">Кол-во</th>
                <th style="width: 15%">Ед. изм.</th>
                <th style="width: 10%">Цена за ед., BYN</th>
                <th style="width: 10%">Сумма, BYN</th>
            </tr>
        </thead>
        <tbody>
            {{#if lot_1_items}}
                {{#each lot_1_items}}
                <tr>
                    <td align="center">{{increment @index}}</td>
                    <td>{{name}}</td>
                    <td align="center">{{quantity}}</td>
                    <td align="center">{{unit}}</td>
                    <td align="right">{{formatNumber price}}</td>
                    <td align="right">{{formatNumber (multiply quantity price)}}</td>
                </tr>
                {{/each}}
                <tr style="background: #f5f5f5">
                    <td colspan="5" align="right" style="font-weight: bold">Итого:</td>
                    <td align="right" style="font-weight: bold">{{formatNumber total_amount}}</td>
                </tr>
            {{else}}
                {{#if has_first_lot}}
                <tr>
                    <td align="center">1</td>
                    <td>{{lot_description}}</td>
                    <td align="center">{{lot_count}}</td>
                    <td align="center">{{lot_unit}}</td>
                    <td align="right">{{formatNumber unit_price}}</td>
                    <td align="right">{{formatNumber total_amount}}</td>
                </tr>
                {{/if}}
            {{/if}}
            <!-- Аналогично для лота 2 -->
        </tbody>
    </table>
    
    <div style="margin: 0px 0; font-size: 10pt; white-space: pre-wrap">
        {{FREE_DESCRIPTION}}
    </div>
    
    <!-- Подвал документа -->
    <div class="footer-info">
        <p>
            <strong>Итого:</strong>
            <span style="font-weight: normal">
                {{#if has_first_lot}}
                    {{#if has_second_lot}}
                        Лот №1: {{formatNumber total_amount}}, Лот №2: {{formatNumber total_amount_2}}
                    {{else}}
                        {{formatNumber total_summary_amount}}
                    {{/if}}
                {{else}}
                    {{formatNumber total_summary_amount}}
                {{/if}}
                бел.руб. без НДС согласно Главы 32 раздела 7 особенной части налогового кодекса РБ.
            </span>
        </p>
        <hr/>
        <p><strong>Срок выполнения работ (поставки):</strong> <span style="font-weight: normal">{{END_DATE}}</span></p>
        <p><strong>Порядок оплаты:</strong> <span style="font-weight: normal">{{PAYMENT}}</span></p>
        <p><strong>Место поставки:</strong> <span style="font-weight: normal">{{PLACE}}</span></p>
    </div>
    
    <div style="margin-top: 40px; display: flex; align-items: center; gap: 15px;">
        <strong>Директор</strong>
        <img src="{{PECHAT_PATH}}" alt="Печать" style="max-width: 200px;"/>
        <strong>Е.В.Грузд</strong>
    </div>
</body>
</html>
```

---

## 3. Конфигурация и переменные окружения

### 3.1 Файл .env

```env
# Сервер
PORT=3001

# Puppeteer
HEADLESS=true

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=-1001234567890

# Налоговый API
API_UNP_DISABLE=false
API_UNP_TIMEOUT_MS=20000
API_UNP_MAX_ATTEMPTS=5
```

### 3.2 Селекторы (selectors.json)

Файл `selectors.json` содержит CSS-селекторы для парсинга различных элементов страницы. Структура:

```json
{
    "customerInfo": {
        "table": "table.customer-table",
        "companyName": ".company-name",
        "unp": ".unp-value",
        "address": ".address"
    },
    "lotInfo": {
        "table": ".lot-table",
        "description": ".lot-desc",
        "quantity": ".lot-qty",
        "unit": ".lot-unit"
    },
    "procurementTerms": {
        "place": ".delivery-place",
        "payment": ".payment-terms",
        "endDate": ".submission-deadline"
    }
}
```

---

## 4. Поток данных в системе

### 4.1 Диаграмма потока данных

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (браузер)                              │
│                    https://meter.by/kp-generator                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         POST /generate (URL + цены)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS SERVER                                  │
│                           server.js                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
    ┌─────────────────────────┐       ┌─────────────────────────┐
    │    Puppeteer Browser    │       │    Telegram Sender     │
    │  (browserInstance)      │       │  telegramSender.js     │
    └─────────────────────────┘       └─────────────────────────┘
                    │                               ▲
                    ▼                               │
    ┌─────────────────────────┐       ┌─────────────────────────┐
    │  GoszakupkiParser       │       │   PDF File             │
    │  parser.js              │       │   (generated/)        │
    └─────────────────────────┘       └─────────────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     Налоговый API РБ                             │
    │               https://grp.nalog.gov.by/api/...                   │
    └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     PDFGenerator                                 │
    │                 pdfGenerator.js                                  │
    │    Handlebars Template ──► HTML ──► Puppeteer PDF ──► PDF      │
    └─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                      RESPONSE                                    │
    │    { success, fileName, filePath, companyShortName, ... }       │
    └─────────────────────────────────────────────────────────────────┘
```

### 4.2 Детальный поток генерации PDF

```typescript
async function generateKPFlow(req, res) {
    // 1. Валидация входных данных
    const { url, unitPrice, includeLot1 } = req.body;
    
    // 2. Проверка состояния браузера
    await ensureBrowser();
    
    // 3. Парсинг страницы закупки
    const parser = new GoszakupkiParser();
    const parsedData = await parser.parsePage(url);
    
    // 4. Запрос к налоговому API (если не отключено)
    let apiData = null;
    if (parsedData.UNP && !process.env.API_UNP_DISABLE) {
        apiData = await parser.getCompanyDataFromAPI(parsedData.UNP);
    }
    
    // 5. Подготовка данных для шаблона
    const templateData = prepareTemplateData({
        parsedData,
        apiData,
        prices: { unitPrice, unitPrice2 },
        options: { includeLot1, includeLot2 }
    });
    
    // 6. Генерация PDF
    const pdfGenerator = new PDFGenerator();
    const result = await pdfGenerator.generatePDF(templateData);
    
    // 7. Отправка ответа
    res.json({
        success: true,
        fileName: result.fileName,
        filePath: result.filePath,
        companyShortName: apiData?.shortName || parsedData.companyName
    });
}
```

---

## 5. Спецификация для Dart-реализации

### 5.1 Рекомендуемый стек для Dart

**Backend:**
- Dart + Shelf / Alfred / Start
- Dart http/http + retry
- html/parser или cheeriodart

**Browser Automation:**
- puppeteer-core с Dart FFI
- Или dart-через Node.js child_process (bridge)

**PDF Generation:**
- dart_pdf / pdf.dart
- Или рендеринг HTML → print to PDF через puppeteer

**Telegram:**
- telegram_bot_api или dart_telegram_bot

**API Client:**
- dio или http с retry

### 5.2 Структура проекта на Dart

```
lib/
├── src/
│   ├── parser/
│   │   ├── goszakupki_parser.dart
│   │   ├── models/
│   │   │   ├── customer_data.dart
│   │   │   ├── procurement_data.dart
│   │   │   └── api_response.dart
│   │   └── selectors/
│   │       └── selectors.dart
│   │
│   ├── pdf/
│   │   ├── pdf_generator.dart
│   │   └── templates/
│   │       └── calculator_template.html
│   │
│   ├── telegram/
│   │   └── telegram_sender.dart
│   │
│   ├── api/
│   │   ├── server.dart
│   │   └── endpoints/
│   │       ├── generate_endpoint.dart
│   │       ├── manual_endpoint.dart
│   │       └── telegram_endpoint.dart
│   │
│   └── utils/
│       ├── browser_manager.dart
│       ├── config.dart
│       └── cleanup_worker.dart
│
├── server.dart
└── main.dart
```

### 5.3 Ключевые модели данных (Dart)

```dart
import 'package:json_annotation/json_annotation.dart';

part 'customer_data.g.dart';

@JsonSerializable()
class CustomerData {
  final String fullName;
  final String? shortName;
  final String unp;
  final String? address;
  final String? status;
  final String? registrationDate;
  
  CustomerData({
    required this.fullName,
    this.shortName,
    required this.unp,
    this.address,
    this.status,
    this.registrationDate,
  });
  
  factory CustomerData.fromJson(Map<String, dynamic> json) =>
      _$CustomerDataFromJson(json);
  Map<String, dynamic> toJson() => _$CustomerDataToJson(this);
}
```

```dart
import 'package:json_annotation/json_annotation.dart';

part 'procurement_data.g.dart';

@JsonSerializable()
class ProcurementData {
  final String url;
  final CustomerData? customer;
  
  // Лот 1
  final String? lotDescription;
  final double? lotCount;
  final String? lotUnit;
  
  // Лот 2
  final bool hasSecondLot;
  final String? lotDescription2;
  final double? lotCount2;
  final String? lotUnit2;
  
  // Условия
  final String? place;
  final String? payment;
  final String? endDate;
  final String date;
  
  // Тип страницы
  final PageType pageType;
  
  ProcurementData({
    required this.url,
    this.customer,
    this.lotDescription,
    this.lotCount,
    this.lotUnit,
    this.hasSecondLot = false,
    this.lotDescription2,
    this.lotCount2,
    this.lotUnit2,
    this.place,
    this.payment,
    required this.endDate,
    required this.date,
    required this.pageType,
  });
  
  factory ProcurementData.fromJson(Map<String, dynamic> json) =>
      _$ProcurementDataFromJson(json);
  Map<String, dynamic> toJson() => _$ProcurementDataToJson(this);
}

enum PageType {
  marketing,
  tender,
  request,
  contract,
  singleSource,
}
```

```dart
import 'package:json_annotation/json_annotation.dart';

part 'lot_item.g.dart';

@JsonSerializable()
class LotItem {
  final String name;
  final double quantity;
  final String unit;
  final double price;
  
  LotItem({
    required this.name,
    required this.quantity,
    required this.unit,
    required this.price,
  });
  
  double get total => quantity * price;
  
  factory LotItem.fromJson(Map<String, dynamic> json) =>
      _$LotItemFromJson(json);
  Map<String, dynamic> toJson() => _$LotItemToJson(this);
}
```

### 5.4 Пример API-клиента с retry (Dart)

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class UnpApiClient {
  static const String baseUrl = 'https://grp.nalog.gov.by/api/nice/public/api/v1';
  final int maxAttempts;
  final Duration timeout;
  
  UnpApiClient({
    this.maxAttempts = 5,
    this.timeout = const Duration(seconds: 20),
  });
  
  Future<CustomerData?> getCompanyData(String unp) async {
    final url = Uri.parse('$baseUrl/unp/$unp');
    
    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        final response = await http.get(url).timeout(timeout);
        
        if (response.statusCode == 200) {
          final json = jsonDecode(utf8.decode(response.bodyBytes));
          return CustomerData.fromJson(json);
        } else if (response.statusCode == 404) {
          return null; // UNP не найден
        } else if (_isTransientError(response.statusCode)) {
          await _delayBeforeRetry(attempt);
          continue;
        } else {
          throw Exception('API error: ${response.statusCode}');
        }
      } catch (e) {
        if (attempt < maxAttempts - 1) {
          await _delayBeforeRetry(attempt);
          continue;
        }
        rethrow;
      }
    }
    return null;
  }
  
  bool _isTransientError(int statusCode) {
    return statusCode == 429 || 
           statusCode >= 500;
  }
  
  Future<void> _delayBeforeRetry(int attempt) async {
    final baseDelay = Duration(seconds: 20);
    final exponentialDelay = baseDelay * (1 << attempt);
    final jitter = Duration(milliseconds: Random().nextInt(1000));
    await Future.delayed(exponentialDelay + jitter);
  }
}
```

### 5.5 Пример браузер-менеджера (Dart)

```dart
import 'package:puppeteer/puppeteer.dart' as pup;

class BrowserManager {
  pup.Browser? _browser;
  bool headless;
  
  BrowserManager({this.headless = true});
  
  Future<pup.Browser> ensureBrowser() async {
    if (_browser == null || !_browser!.isConnected) {
      await initializeBrowser();
    }
    return _browser!;
  }
  
  Future<pup.Browser> initializeBrowser() async {
    _browser = await pup.puppeteer.launch(
      headless: headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    );
    return _browser!;
  }
  
  Future<void> closeBrowser() async {
    await _browser?.close();
    _browser = null;
  }
}
```

### 5.6 Пример парсера страницы (Dart)

```dart
import 'package:puppeteer/puppeteer.dart' as pup;
import 'package:html/parser.dart' as html_parser;

class GoszakupkiParser {
  final BrowserManager browserManager;
  final UnpApiClient apiClient;
  
  GoszakupkiParser({
    required this.browserManager,
    required this.apiClient,
  });
  
  Future<ProcurementData> parsePage(String url) async {
    final browser = await browserManager.ensureBrowser();
    final page = await browser.newPage();
    
    try {
      // Настройка page
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/120.0.0.0 Safari/537.36'
      );
      
      await page.setViewport(pup.Viewport(width: 1920, height: 1080));
      
      // Переход по URL
      await page.goto(url, waitUntil: pup.NetworkEventType.domcontentloaded);
      
      // Проверка на ошибки
      final content = await page.content;
      if (content.contains('error') || content.contains('404')) {
        throw Exception('Failed to load page');
      }
      
      // Извлечение HTML
      final html = await page.content;
      final document = html_parser.parse(html);
      
      // Парсинг данных
      final customer = await _parseCustomerData(document);
      final procurementData = await _parseProcurementData(document, url);
      
      // Объединение данных
      return procurementData.copyWith(customer: customer);
      
    } finally {
      await page.close();
    }
  }
  
  Future<CustomerData?> _parseCustomerData(html_parser.Document document) async {
    // Поиск UNP в таблице
    final unp = _extractUnp(document);
    
    if (unp == null || unp == '101223447') {
      return null;
    }
    
    // Запрос к API
    return await apiClient.getCompanyData(unp);
  }
  
  String? _extractUnp(html_parser.Document document) {
    // Логика поиска UNP с исключением номеров закупок
    // ...
    return null;
  }
}
```

---

## 6. Тестирование и отладка

### 6.1 Тестовый скрипт Telegram

Файл `test/telegram_test.js` проверяет:
- Доступность Telegram API
- Правильность токена бота
- Доступность чата
- Возможность отправки документа

### 6.2 Отладочная информация

При ошибках парсинга сохраняется скриншот:
```
error-screenshot-{timestamp}.png
```

В данные включается `DEBUG_INFO`:
```typescript
interface DebugInfo {
    pageType: string;
    allTdsCount: number;
    relevantTdsCount: number;
    correctTableTdsCount: number;
    companyNameFound: boolean;
    unpFound: boolean;
    addressFound: boolean;
    sampleIrrelevantTds: string[];
}
```

---

## 7. Известные проблемы и особенности

### 7.1 Проблема с UNP

UNP (9 цифр) часто путается с номером закупки. Решение — множественная проверка контекста.

### 7.2 Многостраничные лоты

Второй лот определяется по наличию `<th class="lot-num">2</th>`.

### 7.3 Формат даты API

Налоговый API возвращает даты в формате ISO (`2023-04-20`), требуется конвертация в `DD.MM.YYYY`.

### 7.4 SSL-сертификаты

Налоговый API может требовать отключение `rejectUnauthorized` в некоторых окружениях.

### 7.5 Rate Limiting

API имеет ограничения — требуется экспоненциальная задержка между запросами.

---

## 8. Запуск и развертывание

### 8.1 Локальный запуск

```bash
# Клонирование репозитория
git clone <repo_url>
cd goszakupki_auto_KP

# Установка зависимостей
npm install

# Создание .env файла
cp .env.example .env
# Редактирование .env с реальными значениями

# Запуск
npm start
```

### 8.2 Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p generated images data

EXPOSE 3001

CMD ["npm", "start"]
```

### 8.3 Railway Deployment

```toml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

---

## 9. Безопасность и конфиденциальность

### 9.1 Хранение секретов

- Токен бота Telegram
- ID чата Telegram
- Все в переменных окружения (не в коде)

### 9.2 Временные файлы

PDF-файлы автоматически удаляются через 24 часа.

### 9.3 HTTPS-запросы

Налоговый API требует HTTPS с корректными сертификатами.

---

Этот документ содержит всю необходимую информацию для воссоздания аналогичной системы на Dart. Основные сложности:

1. **Puppeteer integration** — в Dart нет нативного puppeteer, нужно использовать puppeteer-core с bridge
2. **HTML-to-PDF** — в Dart можно использовать dart_pdf или рендерить через headless Chrome
3. **Налоговый API** — работает стабильно, но требует retry-логики