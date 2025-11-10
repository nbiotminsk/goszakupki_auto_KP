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

    // Расчет значений
    const unitPrice = parseFloat(data.UNIT_PRICE || 0);
    const quantity = this.extractQuantity(data.LOT_COUNT || "0");
    const totalAmount = unitPrice * quantity;

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

  async generatePDFFromURL(url, unitPrice, freeDescription = "") {
    const parser = require("./parser");
    const goszakupkiParser = new parser();

    try {
      // Парсим данные с сайта
      const data = await goszakupkiParser.parsePage(url);

      // Добавляем цену за единицу и свободное описание
      data.UNIT_PRICE = unitPrice;
      data.FREE_DESCRIPTION = freeDescription;

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
