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
    const { url, unitPrice, freeDescription } = req.body;

    // Валидация входных данных
    if (!url || !unitPrice) {
      return res.status(400).json({
        success: false,
        message: "Необходимо указать URL и цену за единицу",
      });
    }

    // Проверка формата URL
    if (!url.includes("goszakupki.by")) {
      return res.status(400).json({
        success: false,
        message: "URL должен вести на портал goszakupki.by",
      });
    }

    // Проверка формата цены за единицу
    const unitPriceNum = parseFloat(unitPrice);
    if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Цена за единицу должна быть положительным числом",
      });
    }

    console.log(
      `Начало генерации PDF для URL: ${url}, цена за единицу: ${unitPrice}`,
    );

    // Генерация PDF
    const result = await pdfGenerator.generatePDFFromURL(
      url,
      unitPrice,
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
