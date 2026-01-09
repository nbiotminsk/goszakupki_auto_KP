const puppeteer = require("puppeteer");
const PDFGenerator = require("../pdfGenerator");

async function testPDFGeneration() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для тестирования генерации PDF...");

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const pdfGenerator = new PDFGenerator(browser);

    // Тестовые данные из маркетинговой страницы
    const testData = {
      COMPANY_NAME: "МГК кулинарии",
      UNP: "100099572",
      ADDRESS: "Беларусь, г. Минск, ПР. ПАРТИЗАНСКИЙ, дом 70а",
      PLACE: "г. Минск. пр-т Партизанский, 70А (учебный корпус)\nг. Минск, пр-т Партизанский, 121 (учебный корпус)\nг. Минск, пр-т Партизанский, 123 (гараж) \nг. Минск, ул.Строителей,1 (учебный корпус)",
      PAYMENT: "Оплата после подписания акта оказанных услуг (выполненных работ) путем перечисления денежных средств на расчетный счет Исполнителя через органы государственного казначейства.",
      END_DATE: "c 13.01.2026 по 31.12.2026",
      LOT_DESCRIPTION: "Техническое обслуживание систем регулирования тепловой энергии",
      LOT_COUNT: "1 ед.",
      LOT_DESCRIPTION_2: "",
      LOT_COUNT_2: "",
      HAS_SECOND_LOT: false,
      DATE: "09.01.2026",

      // Параметры для генерации
      UNIT_PRICE: 1000,
      INCLUDE_LOT_1: true,
      INCLUDE_LOT_2: false,
      UNIT_1: "", // Не указано - должно использовать "1 ед." из LOT_COUNT
      UNIT_2: "",
    };

    console.log("\n" + "=".repeat(80));
    console.log("📄 ГЕНЕРАЦИЯ PDF С ДАННЫМИ МАРКЕТИНГОВОЙ СТРАНИЦЫ");
    console.log("=".repeat(80));

    console.log("\n📊 Входные данные:");
    console.log("-".repeat(80));
    console.log(`Название компании: ${testData.COMPANY_NAME}`);
    console.log(`УНП: ${testData.UNP}`);
    console.log(`Описание лота: ${testData.LOT_DESCRIPTION}`);
    console.log(`📦 Количество лота: ${testData.LOT_COUNT}`);
    console.log(`Цена за единицу: ${testData.UNIT_PRICE} BYN`);
    console.log("-".repeat(80));

    console.log("\n🔄 Генерация PDF...");

    const result = await pdfGenerator.generatePDF(
      testData,
      "https://goszakupki.by/marketing/view/3030091"
    );

    console.log("✅ PDF успешно сгенерирован!");
    console.log("\n" + "=".repeat(80));
    console.log("📊 РЕЗУЛЬТАТЫ ГЕНЕРАЦИИ");
    console.log("=".repeat(80));
    console.log(`📁 Имя файла: ${result.fileName}`);
    console.log(`📍 Путь к файлу: ${result.filePath}`);

    // Проверяем, что количество попало в данные шаблона
    const templateData = pdfGenerator.prepareTemplateData(testData);
    console.log("\n" + "=".repeat(80));
    console.log("📋 ДАННЫЕ ДЛЯ ШАБЛОНА");
    console.log("=".repeat(80));
    console.log(`lot_count: "${templateData.lot_count}"`);
    console.log(`lot_description: "${templateData.lot_description.substring(0, 50)}..."`);
    console.log(`unit_price: ${templateData.unit_price}`);
    console.log(`total_amount: ${templateData.total_amount}`);

    // Проверка результата
    console.log("\n" + "=".repeat(80));
    console.log("🎯 ПРОВЕРКА КОЛИЧЕСТВА В PDF");
    console.log("=".repeat(80));

    if (templateData.lot_count && templateData.lot_count.trim() !== "") {
      console.log(`✅ Количество успешно передано в шаблон: "${templateData.lot_count}"`);

      // Проверяем, что количество соответствует ожидаемому
      if (templateData.lot_count === "1 ед.") {
        console.log("✅ Количество соответствует ожидаемому значению");
      } else {
        console.log(`⚠️ Количество отличается от ожидаемого. Ожидалось: "1 ед.", Получено: "${templateData.lot_count}"`);
      }
    } else {
      console.log("❌ Ошибка: количество не передано в шаблон (пустая строка)");
      console.log("💡 Возможные причины:");
      console.log("   1. Параметр LOT_COUNT не был передан в testData");
      console.log("   2. Логика в prepareTemplateData не обрабатывает это значение");
    }

    console.log("\n" + "=".repeat(80));
    console.log("💡 ИНСТРУКЦИЯ");
    console.log("=".repeat(80));
    console.log(`Откройте сгенерированный PDF файл: ${result.filePath}`);
    console.log("Проверьте, что в столбце 'Кол-во' отображается значение из парсера");
    console.log("-".repeat(80));

  } catch (error) {
    console.error("\n❌ Ошибка при генерации PDF:", error);
  } finally {
    if (browser) {
      console.log("\n🔄 Закрытие браузера...");
      await browser.close();
      console.log("✅ Браузер закрыт");
    }

    console.log("\n🏁 Тест завершен");
  }
}

// Запуск теста
testPDFGeneration().catch(console.error);
