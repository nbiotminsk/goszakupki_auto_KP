const express = require("express");
const path = require("path");
const PDFGenerator = require("./pdfGenerator");

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация генератора PDF
const pdfGenerator = new PDFGenerator();

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
    );

    res.json({
      success: true,
      fileName: result.fileName,
      filePath: result.filePath,
    });
  } catch (error) {
    console.error("Ошибка при генерации PDF:", error);

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

// Обработка 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Страница не найдена",
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(
    `📄 Генератор коммерческих предложений доступен по адресу: http://localhost:${PORT}`,
  );
  console.log(
    `📁 Сгенерированные файлы сохраняются в: ${path.join(__dirname, "generated")}`,
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Завершение работы сервера...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🔄 Завершение работы сервера...");
  process.exit(0);
});
