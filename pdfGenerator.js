const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

// Регистрируем helper для форматирования чисел
Handlebars.registerHelper("formatNumber", function (number) {
  if (typeof number !== "number") {
    number = parseFloat(number) || 0;
  }
  return new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
});

class PDFGenerator {
  constructor(browserInstance = null) {
    this.browser = browserInstance;
    this.templatePath = path.join(__dirname, "calculator-template.html");
    this.generatedPath = path.join(__dirname, "generated");
    this.imagesPath = path.join(__dirname, "images");

    // Компилируем шаблон Handlebars при инициализации
    this.compileTemplate();
  }

  compileTemplate() {
    try {
      const templateSource = fs.readFileSync(this.templatePath, "utf8");
      this.template = Handlebars.compile(templateSource);
      console.log("✅ Шаблон Handlebars успешно скомпилирован");
    } catch (error) {
      console.error("❌ Ошибка при компиляции шаблона:", error);
      throw new Error(`Не удалось скомпилировать шаблон: ${error.message}`);
    }
  }

  async ensureGeneratedDir() {
    if (!fs.existsSync(this.generatedPath)) {
      fs.mkdirSync(this.generatedPath, { recursive: true });
    }
  }

  imageToBase64(filename) {
    try {
      const imagePath = path.join(this.imagesPath, filename);
      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(filename).toLowerCase().slice(1);
      return `data:image/${ext};base64,${imageBuffer.toString("base64")}`;
    } catch (error) {
      console.error(`Ошибка при чтении изображения ${filename}:`, error);
      return "";
    }
  }

  extractQuantity(lotCount) {
    // Извлекаем числовое значение из строки "2 ед." или "2 Единица(ед.)"
    const match = lotCount.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  prepareTemplateData(data) {
    // Расчет значений для первого лота
    const includeLot1 = data.INCLUDE_LOT_1 !== false; // По умолчанию включен
    let unitPrice = 0;
    let totalAmount = 0;

    if (includeLot1) {
      unitPrice = parseFloat(data.UNIT_PRICE || 0);
      const quantity = this.extractQuantity(data.LOT_COUNT || "0");
      totalAmount = unitPrice * quantity;
    }

    // Расчет значений для второго лота (если есть и включен)
    let includeLot2 = data.INCLUDE_LOT_2 === true;
    let unitPrice2 = 0;
    let totalAmount2 = 0;

    if (includeLot2 && data.HAS_SECOND_LOT) {
      unitPrice2 = parseFloat(data.UNIT_PRICE_2 || data.UNIT_PRICE || 0);
      const quantity2 = this.extractQuantity(data.LOT_COUNT_2 || "0");
      totalAmount2 = unitPrice2 * quantity2;
    } else {
      includeLot2 = false; // Если второго лота нет в данных, выключаем его
    }

    // Формируем текст для итоговой суммы (без форматирования, Handlebars сделает это)
    let totalSummaryText = "";
    if (includeLot1 && includeLot2) {
      // Если есть два лота
      totalSummaryText = `Лот 1: ${totalAmount}, Лот 2: ${totalAmount2}`;
    } else if (includeLot1) {
      // Если только первый лот
      totalSummaryText = `${totalAmount}`;
    } else if (includeLot2) {
      // Если только второй лот
      totalSummaryText = `${totalAmount2}`;
    }

    // Добавляем номер для второго лота
    let lotNumber2 = includeLot1 ? "2" : "1";

    // Преобразуем изображения в base64 для встраивания в HTML
    const logoBase64 = this.imageToBase64("logo.png");
    const pechatBase64 = this.imageToBase64("pechat.jpg");

    // Подготавливаем данные для шаблона Handlebars
    return {
      COMPANY_NAME: data.COMPANY_NAME || "",
      UNP: data.UNP || "",
      DATE: data.DATE || "",
      ADDRESS: data.ADDRESS || "",
      PLACE: data.PLACE || "",
      payment: data.PAYMENT || "",
      END_DATE: data.END_DATE || "",
      lot_description: data.LOT_DESCRIPTION || "",
      lot_count: data.LOT_COUNT || "",
      FREE_DESCRIPTION: data.FREE_DESCRIPTION || "",
      unit_price: unitPrice,
      total_amount: totalAmount,
      total_summary: totalSummaryText,

      // Второй лот
      lot_description_2: data.LOT_DESCRIPTION_2 || "",
      lot_count_2: data.LOT_COUNT_2 || "",
      unit_price_2: unitPrice2,
      total_amount_2: totalAmount2,
      lot_number_2: lotNumber2,

      // Флаги для условных блоков
      has_first_lot: includeLot1,
      has_second_lot: includeLot2,

      // Изображения
      LOGO_PATH: logoBase64,
      PECHAT_PATH: pechatBase64,
    };
  }

  async generatePDF(data, url = "") {
    await this.ensureGeneratedDir();

    const templateData = this.prepareTemplateData(data);
    const htmlContent = this.template(templateData);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    let idFromUrl = "";
    if (url) {
      const urlMatch = url.match(/\/(\d+)(?:\/|$)/);
      if (urlMatch) {
        idFromUrl = urlMatch[1];
      }
    }

    const fileName = idFromUrl
      ? `${year}_${month}_${day}_${hours}_${minutes}_${seconds}_${idFromUrl}.pdf`
      : `${year}_${month}_${day}_${hours}_${minutes}_${seconds}.pdf`;
    const outputPath = path.join(this.generatedPath, fileName);

    let browserToUse = this.browser;
    let shouldCloseBrowser = false;
    if (!browserToUse) {
      console.log("Внимание: Глобальный браузер не найден. Создается временный экземпляр.");
      browserToUse = await puppeteer.launch({ headless: "new" });
      shouldCloseBrowser = true;
    }

    let context = null;
    try {
      console.log("Создание инкогнито контекста для генерации PDF...");
      context = await browserToUse.createIncognitoBrowserContext();
      const page = await context.newPage();

      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      });

      console.log(`PDF успешно сгенерирован: ${outputPath}`);
      return {
        success: true,
        fileName: fileName,
        filePath: outputPath,
      };
    } catch (error) {
      console.error("Ошибка при генерации PDF:", error);
      throw new Error(`Не удалось сгенерировать PDF: ${error.message}`);
    } finally {
      if (context) {
        await context.close();
        console.log("Инкогнито контекст для PDF успешно закрыт.");
      }
      if (shouldCloseBrowser && browserToUse) {
        await browserToUse.close();
        console.log("Временный экземпляр браузера закрыт.");
      }
    }
  }

  async generatePDFFromURL(
    url,
    unitPrice,
    unitPrice2 = 0,
    includeLot1 = true,
    includeLot2 = false,
    freeDescription = "",
  ) {
    // Импортируем класс парсера
    const GoszakupkiParser = require("./parser");

    // Передаем централизованный браузер в парсер
    const goszakupkiParser = new GoszakupkiParser(this.browser);

    try {
      // Парсим данные с сайта
      const data = await goszakupkiParser.parsePage(url);

      // Добавляем цены за единицу и свободное описание
      data.UNIT_PRICE = unitPrice;
      data.UNIT_PRICE_2 = unitPrice2;
      data.INCLUDE_LOT_1 = includeLot1;
      data.INCLUDE_LOT_2 = includeLot2;
      data.FREE_DESCRIPTION = freeDescription;

      // Если второй лот включен, но не найден в данных, добавляем флаг
      if (includeLot2 && !data.HAS_SECOND_LOT) {
        console.warn("Второй лот включен, но не найден на странице закупки");
      }

      // Генерируем PDF с использованием того же браузера
      const result = await this.generatePDF(data, url);

      return result;
    } catch (error) {
      console.error("Ошибка при генерации PDF из URL:", error);
      throw error;
    }
  }
}

module.exports = PDFGenerator;
