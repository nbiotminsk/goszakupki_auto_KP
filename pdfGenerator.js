const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

class PDFGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, "calculator-template.html");
    this.generatedPath = path.join(__dirname, "generated");
    this.imagesPath = path.join(__dirname, "images");
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

  formatNumber(number) {
    // Форматируем число с двумя знаками после запятой
    return new Intl.NumberFormat("ru-BY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  replaceTemplateVariables(template, data) {
    let result = template;

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

    // Формируем текст для итоговой суммы
    let totalSummaryText = "";
    if (includeLot1 && includeLot2) {
      // Если есть два лота
      totalSummaryText = `Лот 1: ${this.formatNumber(totalAmount)}, Лот 2: ${this.formatNumber(totalAmount2)}`;
    } else if (includeLot1) {
      // Если только первый лот
      totalSummaryText = this.formatNumber(totalAmount);
    } else if (includeLot2) {
      // Если только второй лот
      totalSummaryText = this.formatNumber(totalAmount2);
    }

    // Заменяем все плейсхолдеры на реальные данные
    result = result.replace(/{{COMPANY_NAME}}/g, data.COMPANY_NAME || "");
    result = result.replace(/{{UNP}}/g, data.UNP || "");
    result = result.replace(/{{DATE}}/g, data.DATE || "");
    result = result.replace(/{{ADDRESS}}/g, data.ADDRESS || "");
    result = result.replace(/{{PLACE}}/g, data.PLACE || "");
    result = result.replace(/{{payment}}/g, data.PAYMENT || "");
    result = result.replace(/{{END_DATE}}/g, data.END_DATE || "");
    result = result.replace(/{{lot_description}}/g, data.LOT_DESCRIPTION || "");
    result = result.replace(/{{lot_count}}/g, data.LOT_COUNT || "");
    result = result.replace(
      /{{FREE_DESCRIPTION}}/g,
      data.FREE_DESCRIPTION || "",
    );
    result = result.replace(/{{unit_price}}/g, this.formatNumber(unitPrice));
    result = result.replace(
      /{{total_amount}}/g,
      this.formatNumber(totalAmount),
    );
    result = result.replace(/{{Price}}/g, this.formatNumber(totalAmount)); // Для совместимости
    result = result.replace(/{{total_summary}}/g, totalSummaryText); // Итоговая сумма с учетом лотов

    // Обработка второго лота
    result = result.replace(
      /{{lot_description_2}}/g,
      data.LOT_DESCRIPTION_2 || "",
    );
    result = result.replace(/{{lot_count_2}}/g, data.LOT_COUNT_2 || "");
    result = result.replace(/{{unit_price_2}}/g, this.formatNumber(unitPrice2));
    result = result.replace(
      /{{total_amount_2}}/g,
      this.formatNumber(totalAmount2),
    );

    // Обработка условных блоков для первого лота
    if (includeLot1) {
      // Удаляем теги условного отображения
      result = result.replace(/{{#has_first_lot}}/g, "");
      result = result.replace(/{{\/has_first_lot}}/g, "");
    } else {
      // Полностью удаляем блок первого лота
      const firstLotRegex = /{{#has_first_lot}}[\s\S]*?{{\/has_first_lot}}/g;
      result = result.replace(firstLotRegex, "");
    }

    // Добавляем номер для второго лота
    let lotNumber2 = includeLot1 ? "2" : "1";
    result = result.replace(/{{lot_number_2}}/g, lotNumber2);

    // Обработка условных блоков для второго лота
    if (includeLot2) {
      // Удаляем теги условного отображения
      result = result.replace(/{{#has_second_lot}}/g, "");
      result = result.replace(/{{\/has_second_lot}}/g, "");
    } else {
      // Полностью удаляем блок второго лота
      const secondLotRegex = /{{#has_second_lot}}[\s\S]*?{{\/has_second_lot}}/g;
      result = result.replace(secondLotRegex, "");
    }

    // Преобразуем изображения в base64 для встраивания в HTML
    const logoBase64 = this.imageToBase64("logo.png");
    const pechatBase64 = this.imageToBase64("pechat.jpg");

    result = result.replace(/{{LOGO_PATH}}/g, logoBase64);
    result = result.replace(/{{PECHAT_PATH}}/g, pechatBase64);

    return result;
  }

  async generatePDF(data, url = "") {
    await this.ensureGeneratedDir();

    // Читаем шаблон
    const template = fs.readFileSync(this.templatePath, "utf8");

    // Подставляем данные
    const htmlContent = this.replaceTemplateVariables(template, data);

    // Создаем уникальное имя файла с ID из URL
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

    // Извлекаем ID из URL
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

    // Проверяем существование изображений
    const logoPath = path.join(__dirname, "images", "logo.png");
    const pechatPath = path.join(__dirname, "images", "pechat.jpg");

    if (!fs.existsSync(logoPath)) {
      console.warn("Предупреждение: Файл логотипа не найден:", logoPath);
    }
    if (!fs.existsSync(pechatPath)) {
      console.warn("Предупреждение: Файл печати не найден:", pechatPath);
    }

    // Запускаем браузер для генерации PDF
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
        "--allow-file-access-from-files",
        "--disable-web-security",
      ],
    });

    try {
      const page = await browser.newPage();

      // Устанавливаем контент HTML
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      });

      // Ждем загрузки изображений
      await page.waitForTimeout(3000);

      // Генерируем PDF
      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: {
          top: "15mm",
          right: "15mm",
          bottom: "15mm",
          left: "15mm",
        },
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
      await browser.close();
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
    const parser = require("./parser");
    const goszakupkiParser = new parser();

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

      // Генерируем PDF
      const result = await this.generatePDF(data, url);

      return result;
    } catch (error) {
      console.error("Ошибка при генерации PDF из URL:", error);
      throw error;
    } finally {
      await goszakupkiParser.close();
    }
  }
}

module.exports = PDFGenerator;
