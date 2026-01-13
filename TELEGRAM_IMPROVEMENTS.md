# Новые функции Telegram

## Обзор изменений

В систему добавлена возможность отправлять дополнительную информацию в сообщения Telegram:

- 📢 Краткое название организации (из REST API налоговой службы)
- ⏰ Подать до (с парсинга страницы закупки)

## Изменения в коде

### 1. Парсер (`parser.js`)

Добавлено извлечение даты окончания приема предложений с двух возможных локаторов:

```javascript
const proposalEndDate =
  safeExtract(
    "#print-area > div:nth-child(4) > table > tbody > tr:nth-child(3) > td",
  ) ||
  safeExtract(
    "body > div > div > div:nth-child(5) > table > tbody > tr:nth-child(2) > td",
  );
```

Данные сохраняются в объекте под ключом `PROPOSAL_END_DATE`.

### 2. Генератор PDF (`pdfGenerator.js`)

Метод `generatePDFFromURL` теперь возвращает дополнительные данные:

```javascript
{
  fileName: "...",
  filePath: "...",
  companyShortName: "ООО \"Название\"",  // Краткое название из API
  proposalEndDate: "31.12.2024 12:00"     // Дата окончания приема
}
```

### 3. Сервер (`server.js`)

Эндпоинт `/generate` возвращает дополнительные данные:

```javascript
res.json({
  success: true,
  fileName: result.fileName,
  filePath: result.filePath,
  url: url,
  companyShortName: result.companyShortName || "",
  proposalEndDate: result.proposalEndDate || "",
});
```

Эндпоинт `/send-to-telegram` принимает новые параметры:

```javascript
{
  chatId: "...",
  fileName: "...",
  url: "...",
  caption: "...",
  companyShortName: "ООО \"Название\"",  // Новый параметр
  proposalEndDate: "31.12.2024 12:00"     // Новый параметр
}
```

Формирование сообщения с дополнительными данными:

```javascript
let messageText = caption || "";

if (companyShortName) {
  messageText += (messageText ? "\n" : "") + `📢 Организация: ${companyShortName}`;
}

if (proposalEndDate) {
  messageText += (messageText ? "\n" : "") + `⏰ Подать до: ${proposalEndDate}`;
}
```

### 4. Frontend (`public/index.html`)

Функция `showSuccess` теперь сохраняет и передает дополнительные данные:

```javascript
let currentCompanyShortName = "";
let currentProposalEndDate = "";

function showSuccess(fileName, companyShortName, proposalEndDate) {
  // ... сохранение данных ...
  currentCompanyShortName = companyShortName || "";
  currentProposalEndDate = proposalEndDate || "";
  // ...
}
```

Функция `sendToTelegram` передает данные на сервер:

```javascript
const response = await fetch("/send-to-telegram", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chatId: chatId,
    fileName: fileName,
    url: url,
    caption: "",
    companyShortName: currentCompanyShortName,
    proposalEndDate: currentProposalEndDate,
  }),
});
```

### 5. Frontend (`public/manual.html`)

Для ручного режима данные берутся из полей формы:

```javascript
const customerName = document.getElementById("customerName").value;
const endDate = document.getElementById("endDate").value;

const response = await fetch("/send-to-telegram", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chatId: chatId || null,
    fileName: window.currentFileName,
    url: "Создано вручную",
    caption: "Коммерческое предложение для " + customerName,
    companyShortName: customerName,
    proposalEndDate: endDate,
  }),
});
```

## Формат сообщения в Telegram

Пример сформированного сообщения:

```
📋 Коммерческое предложение
📢 Организация: ГУ "Минский городской дворец спорта"
⏰ Подать до: 31.12.2024 12:00

🔗 [Ссылка на закупку](https://goszakupki.by/single-source/view/123456)
```

## Локаторы для парсинга

### Подать до

1. Основной локатор:
   - `#print-area > div:nth-child(4) > table > tbody > tr:nth-child(3) > td`

2. Альтернативный локатор:
   - `body > div > div > div:nth-child(5) > table > tbody > tr:nth-child(2) > td`

### Краткое название организации

Название получается из REST API налоговой службы Беларуси:

- **API endpoint:** `https://grp.nalog.gov.by/api/grp-public/data?unp={UNP}&charset=UTF-8&type=json`
- **Поле в ответе:** `row.vnaimk` (краткое название организации)
- **Резервное поле:** `row.vnaimp` (полное название организации, если краткое отсутствует)

## Тестирование

Для тестирования новых функций можно использовать скрипт:

```bash
node test/telegram_test.js
```

Скрипт проверяет:
1. Доступность Telegram бота
2. Информацию о боте
3. Доступность чата
4. Отправку сообщения с кратким названием организации
5. Отправку сообщения с датой окончания
6. Отправку сообщения с обоими параметрами
7. Формирование текста подписи

## Совместимость

Изменения полностью обратимо совместимы с существующим кодом:
- Если дополнительные данные не переданы, сообщение будет отправлено без них
- Старые клиенты, не передающие новые параметры, будут продолжать работать
- Параметры `companyShortName` и `proposalEndDate` являются опциональными