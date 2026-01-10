require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const PDFGenerator = require("./pdfGenerator");
const TelegramSender = require("./telegramSender");

const app = express();
const PORT = process.env.PORT || 3001;

// Глобальный экземпляр браузера
let browserInstance = null;

// Инициализация браузера при запуске сервера
async function initializeBrowser() {
  try {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-web-security",
        "--allow-file-access-from-files",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-background-networking",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI,VizDisplayCompositor,IsolateOrigins,site-per-process",
        "--disable-ipc-flooding-protection",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-zygote",
        "--disable-notifications",
        "--disable-popup-blocking",
        "--disable-blink-features=AutomationControlled",
        "--disable-sync",
        "--metrics-recording-only",
        "--disable-domain-reliability",
        "--disable-field-trial-config",
        "--disable-client-side-phishing-detection",
        "--disable-default-apps",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--disable-session-crashed-bubble",
        "--dns-prefetch-disable",
        "--proxy-server='direct://'",
        "--no-proxy-server",
      ],
    });
    console.log("🌐 Браузер Puppeteer успешно запущен");
  } catch (error) {
    console.error("❌ Ошибка при запуске браузера:", error);
    process.exit(1);
  }
}

// Закрытие браузера при остановке сервера
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log("🌐 Браузер Puppeteer закрыт");
    } catch (error) {
      console.error("❌ Ошибка при закрытии браузера:", error);
    }
  }
}

// Инициализация генератора PDF с передачей экземпляра браузера
let pdfGenerator = null;

// Инициализация отправщика Telegram
let telegramSender = null;

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Статические файлы
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

// Раздача сгенерированных файлов
app.use("/download", express.static(path.join(__dirname, "generated")));

// Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API для генерации PDF
app.post("/generate", async (req, res) => {
  try {
    const {
      url,
      unitPrice,
      unitPrice2,
      includeLot1,
      includeLot2,
      freeDescription,
      unit1,
      unit2,
    } = req.body;

    // Валидация входных данных
    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать URL",
      });
    }

    // Проверяем, что хотя бы один лот включен
    if (!includeLot1 && !includeLot2) {
      return res.status(400).json({
        success: false,
        message: "Необходимо выбрать хотя бы один лот",
      });
    }

    // Проверяем цены для включенных лотов
    if (includeLot1 && (!unitPrice || parseFloat(unitPrice) <= 0)) {
      return res.status(400).json({
        success: false,
        message:
          "Цена за единицу первого лота должна быть положительным числом",
      });
    }

    if (includeLot2 && (!unitPrice2 || parseFloat(unitPrice2) <= 0)) {
      return res.status(400).json({
        success: false,
        message:
          "Цена за единицу второго лота должна быть положительным числом",
      });
    }

    // Проверка формата URL
    if (!url.includes("goszakupki.by")) {
      return res.status(400).json({
        success: false,
        message: "URL должен вести на портал goszakupki.by",
      });
    }

    // Преобразуем цены в числа
    const unitPriceNum = includeLot1 ? parseFloat(unitPrice) : 0;
    const unitPrice2Num = includeLot2 ? parseFloat(unitPrice2) : 0;

    console.log(
      `Начало генерации PDF для URL: ${url}, лот 1: ${includeLot1 ? "включен, цена: " + unitPriceNum : "выключен"}, лот 2: ${includeLot2 ? "включен, цена: " + unitPrice2Num : "выключен"}`,
    );

    // Генерация PDF
    const result = await pdfGenerator.generatePDFFromURL(
      url,
      unitPriceNum,
      unitPrice2Num,
      includeLot1,
      includeLot2,
      freeDescription,
      unit1 || "",
      unit2 || "",
    );

    res.json({
      success: true,
      fileName: result.fileName,
      filePath: result.filePath,
      url: url, // Добавляем URL закупки в ответ
    });
  } catch (error) {
    console.error("Ошибка при генерации PDF:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Внутренняя ошибка сервера",
    });
  }
});

// API для генерации KP с ручным вводом данных (без парсинга страницы)
app.post("/api/generate-manual", async (req, res) => {
  try {
    const {
      // Данные заказчика
      customerName,
      customerUnp,
      customerAddress,
      // Данные лотов
      includeLot1,
      includeLot2,
      lot1Items,
      lot2Items,
      // Дополнительная информация
      freeDescription,
      place,
      payment,
      endDate,
    } = req.body;

    // Валидация обязательных полей
    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать название организации",
      });
    }

    // Проверяем, что хотя бы один лот включен
    if (!includeLot1 && !includeLot2) {
      return res.status(400).json({
        success: false,
        message: "Необходимо выбрать хотя бы один лот",
      });
    }

    // Проверяем данные для первого лота
    if (includeLot1) {
      if (!lot1Items || !Array.isArray(lot1Items) || lot1Items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Необходимо добавить хотя бы одну позицию в первый лот",
        });
      }
      // Валидация каждой позиции в лоте
      for (let i = 0; i < lot1Items.length; i++) {
        const item = lot1Items[i];
        if (!item.name || item.name.trim() === "") {
          return res.status(400).json({
            success: false,
            message:
              "Необходимо указать наименование во всех позициях первого лота",
          });
        }
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "Количество во всех позициях первого лота должно быть положительным числом",
          });
        }
        if (!item.price || parseFloat(item.price) <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "Цена во всех позициях первого лота должна быть положительным числом",
          });
        }
      }
    }

    // Проверяем данные для второго лота
    if (includeLot2) {
      if (!lot2Items || !Array.isArray(lot2Items) || lot2Items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Необходимо добавить хотя бы одну позицию во второй лот",
        });
      }
      // Валидация каждой позиции в лоте
      for (let i = 0; i < lot2Items.length; i++) {
        const item = lot2Items[i];
        if (!item.name || item.name.trim() === "") {
          return res.status(400).json({
            success: false,
            message:
              "Необходимо указать наименование во всех позициях второго лота",
          });
        }
        if (!item.quantity || parseFloat(item.quantity) <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "Количество во всех позициях второго лота должно быть положительным числом",
          });
        }
        if (!item.price || parseFloat(item.price) <= 0) {
          return res.status(400).json({
            success: false,
            message:
              "Цена во всех позициях второго лота должна быть положительным числом",
          });
        }
      }
    }

    console.log(
      `Начало генерации KP с ручным вводом данных для заказчика: ${customerName}`,
    );

    // Если указан УНП, пытаемся получить данные из API
    let apiData = null;
    if (customerUnp && customerUnp.trim() !== "") {
      const GoszakupkiParser = require("./parser");
      const goszakupkiParser = new GoszakupkiParser(browserInstance);
      apiData = await goszakupkiParser.getCompanyDataFromAPI(customerUnp);

      // Если данные получены из API и указано короткое название, используем его
      if (apiData && apiData.shortName) {
        console.log(
          `Использование данных из API для УНП ${customerUnp}: ${apiData.shortName}`,
        );
        // Если пользователь не указал адрес, используем из API
        if (!customerAddress && apiData.address) {
          customerAddress = apiData.address;
        }
      }
    }

    // Подготавливаем данные для генерации PDF
    const data = {
      COMPANY_NAME: customerName,
      UNP: customerUnp || "",
      ADDRESS: customerAddress || "",
      DATE: new Date().toLocaleDateString("ru-RU"),
      PLACE: place || "",
      PAYMENT: payment || "",
      END_DATE: endDate || "",

      // Первый лот
      LOT_DESCRIPTION: "",
      LOT_COUNT: "",
      UNIT_PRICE: 0,
      LOT_1_ITEMS: lot1Items || [],

      // Второй лот
      LOT_DESCRIPTION_2: "",
      LOT_COUNT_2: "",
      UNIT_PRICE_2: 0,
      LOT_2_ITEMS: lot2Items || [],
      HAS_SECOND_LOT: includeLot2,

      // Дополнительно
      FREE_DESCRIPTION: freeDescription || "",
      INCLUDE_LOT_1: includeLot1,
      INCLUDE_LOT_2: includeLot2,
      UNIT_1: "",
      UNIT_2: "",

      // Данные из API
      API_DATA: apiData,
    };

    // Генерируем PDF
    const result = await pdfGenerator.generatePDF(data, "manual");

    res.json({
      success: true,
      fileName: result.fileName,
      filePath: result.filePath,
      apiData: apiData,
    });
  } catch (error) {
    console.error("Ошибка при генерации KP с ручным вводом:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Внутренняя ошибка сервера",
    });
  }
});

// API для получения данных организации по УНП
app.get("/api/company/:unp", async (req, res) => {
  try {
    const { unp } = req.params;

    if (!unp || unp.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать УНП",
      });
    }

    console.log(`Запрос данных по УНП: ${unp}`);

    const GoszakupkiParser = require("./parser");
    const goszakupkiParser = new GoszakupkiParser(browserInstance);

    const companyData = await goszakupkiParser.getCompanyDataFromAPI(unp);

    if (!companyData) {
      return res.status(404).json({
        success: false,
        message: "Данные по указанному УНП не найдены",
      });
    }

    res.json({
      success: true,
      data: companyData,
    });
  } catch (error) {
    console.error("Ошибка при получении данных по УНП:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Внутренняя ошибка сервера",
    });
  }
});

// API для проверки статуса сервера
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера",
  });
});

// API для отправки в Telegram
app.post("/send-to-telegram", async (req, res) => {
  try {
    const { chatId, fileName, url, caption } = req.body;

    // Используем Chat ID из запроса или из переменных окружения
    const finalChatId = chatId || process.env.TELEGRAM_CHAT_ID;

    // Валидация входных данных
    if (!finalChatId) {
      return res.status(400).json({
        success: false,
        message:
          "Необходимо указать Chat ID или настроить TELEGRAM_CHAT_ID в .env",
      });
    }

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать имя файла",
      });
    }

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать ссылку на закупку",
      });
    }

    // Проверяем, доступен ли Telegram бот
    if (!telegramSender || !telegramSender.isAvailable()) {
      return res.status(503).json({
        success: false,
        message:
          "Telegram бот недоступен. Проверьте токен бота в переменных окружения TELEGRAM_BOT_TOKEN",
      });
    }

    // Формируем полный путь к файлу
    const filePath = path.join(__dirname, "generated", fileName);

    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Файл не найден",
      });
    }

    // Отправляем PDF файл с ссылкой
    const result = await telegramSender.sendPDFWithLink(
      finalChatId,
      filePath,
      fileName,
      url,
      caption || "",
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Ошибка при отправке в Telegram:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Внутренняя ошибка сервера",
    });
  }
});

// API для проверки доступности Telegram
app.get("/telegram-status", async (req, res) => {
  try {
    if (!telegramSender) {
      return res.json({
        available: false,
        message: "Telegram отправщик не инициализирован",
      });
    }

    const isAvailable = telegramSender.isAvailable();

    if (isAvailable) {
      try {
        const botInfo = await telegramSender.getBotInfo();
        res.json({
          available: true,
          botInfo: botInfo,
          message: "Telegram бот доступен",
        });
      } catch (error) {
        res.json({
          available: false,
          message: error.message,
        });
      }
    } else {
      res.json({
        available: false,
        message:
          "Токен Telegram бота не найден. Установите переменную окружения TELEGRAM_BOT_TOKEN",
      });
    }
  } catch (error) {
    console.error("Ошибка при проверке статуса Telegram:", error);
    res.status(500).json({
      available: false,
      message: "Внутренняя ошибка сервера",
    });
  }
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Страница не найдена",
  });
});

// Запуск сервера
async function startServer() {
  try {
    // Сначала инициализируем браузер
    await initializeBrowser();

    // Затем инициализируем генератор PDF с браузером
    pdfGenerator = new PDFGenerator(browserInstance);

    // Инициализируем отправщик Telegram
    telegramSender = new TelegramSender();

    // Запускаем сервер
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(
        `📄 Генератор коммерческих предложений доступен по адресу: http://localhost:${PORT}`,
      );
      console.log(
        `📁 Сгенерированные файлы сохраняются в: ${path.join(__dirname, "generated")}`,
      );
    });
  } catch (error) {
    console.error("❌ Ошибка при запуске сервера:", error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log("\n🔄 Завершение работы сервера...");
  try {
    // Закрываем генератор PDF если он был создан
    if (pdfGenerator && pdfGenerator.browser) {
      console.log("📄 Закрытие браузера генератора PDF...");
      // Не закрываем браузер здесь, так как он управляется на уровне сервера
    }

    await closeBrowser();
    console.log("✅ Сервер успешно завершил работу");
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при завершении работы:", error);
    process.exit(1);
  }
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Запускаем сервер
startServer();
