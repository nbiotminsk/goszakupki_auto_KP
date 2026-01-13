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

Handlebars.registerHelper("multiply", function (a, b) {
  const numA = typeof a !== "number" ? parseFloat(a) || 0 : a;
  const numB = typeof b !== "number" ? parseFloat(b) || 0 : b;
  return numA * numB;
});

Handlebars.registerHelper("increment", function (index) {
  return index + 1;
});

class PDFGenerator {
  constructor(browserInstance = null) {
    this.browser = browserInstance;
    this.templatePath = path.join(__dirname, "calculator-template.html");
    this.generatedPath = path.join(__dirname, "generated");
    this.imagesPath = path.join(__dirname, "images");
    this.parsingCache = new Map();

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
    // Если значение не найдено или пустое, возвращаем 0
    if (!lotCount || lotCount.trim() === "") {
      return 0;
    }
    const match = lotCount.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Извлекает единицу измерения из строки с количеством
   * @param {string} lotCount - строка вида "1 ед.", "2 шт.", "12 мес"
   * @returns {string} единица измерения без числа
   */
  extractUnit(lotCount) {
    if (!lotCount) return "ед.";
    // Убираем ведущее число и пробелы
    let unit = lotCount.replace(/^\d+\s*/, "").trim();
    // Обрезаем все, что идет после запятой (цена и валюта)
    const commaIndex = unit.indexOf(",");
    if (commaIndex > 0) {
      unit = unit.substring(0, commaIndex).trim();
    }
    return unit || "ед.";
  }

  prepareTemplateData(data) {
    // Расчет значений для первого лота
    const includeLot1 = data.INCLUDE_LOT_1 !== false; // По умолчанию включен
    let unitPrice = 0;
    let totalAmount = 0;
    let lot1Items = [];

    if (includeLot1) {
      // Если есть массив позиций из таблицы, используем его
      if (
        data.LOT_1_ITEMS &&
        Array.isArray(data.LOT_1_ITEMS) &&
        data.LOT_1_ITEMS.length > 0
      ) {
        lot1Items = data.LOT_1_ITEMS;
        // Рассчитываем общую сумму как сумму всех позиций
        totalAmount = lot1Items.reduce((sum, item) => {
          const price = parseFloat(item.price) || 0;
          const quantity = parseFloat(item.quantity) || 0;
          return sum + price * quantity;
        }, 0);
      } else {
        // Иначе используем старый формат данных
        unitPrice = parseFloat(data.UNIT_PRICE || 0);
        const quantity = this.extractQuantity(data.LOT_COUNT || "0");
        totalAmount = unitPrice * quantity;
      }
    }

    // Расчет значений для второго лота (если есть и включен)
    let includeLot2 = data.INCLUDE_LOT_2 === true;
    let unitPrice2 = 0;
    let totalAmount2 = 0;
    let lot2Items = [];

    if (includeLot2 && data.HAS_SECOND_LOT) {
      // Если есть массив позиций из таблицы, используем его
      if (
        data.LOT_2_ITEMS &&
        Array.isArray(data.LOT_2_ITEMS) &&
        data.LOT_2_ITEMS.length > 0
      ) {
        lot2Items = data.LOT_2_ITEMS;
        // Рассчитываем общую сумму как сумму всех позиций
        totalAmount2 = lot2Items.reduce((sum, item) => {
          const price = parseFloat(item.price) || 0;
          const quantity = parseFloat(item.quantity) || 0;
          return sum + price * quantity;
        }, 0);
      } else {
        // Иначе используем старый формат данных
        unitPrice2 = parseFloat(data.UNIT_PRICE_2 || data.UNIT_PRICE || 0);
        const quantity2 = this.extractQuantity(data.LOT_COUNT_2 || "0");
        totalAmount2 = unitPrice2 * quantity2;
      }
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
    const pechatBase64 = this.imageToBase64("pechat.png");

    // Формируем строки количества с единицами измерения
    let lotCount = "";
    let lotCount2 = "";
    let lotUnit = "";
    let lotUnit2 = "";

    if (data.UNIT_1 || data.UNIT_2) {
      if (includeLot1) {
        const quantity = this.extractQuantity(data.LOT_COUNT || "");
        lotCount = `${quantity}`;
        lotUnit = data.UNIT_1 || "";
      }
      if (includeLot2) {
        const quantity2 = this.extractQuantity(data.LOT_COUNT_2 || "");
        lotCount2 = `${quantity2}`;
        lotUnit2 = data.UNIT_2 || "";
      }
    } else {
      // Если кастомные единицы не указаны, используем значение из парсинга
      if (includeLot1) {
        lotCount = data.LOT_COUNT || "";
        // Извлекаем количество отдельно от единицы измерения
        const quantity = this.extractQuantity(data.LOT_COUNT || "");
        const unit = this.extractUnit(data.LOT_COUNT || "");
        lotCount = `${quantity}`;
        lotUnit = unit || "ед.";
      }
      if (includeLot2) {
        lotCount2 = data.LOT_COUNT_2 || "";
        // Извлекаем количество отдельно от единицы измерения
        const quantity2 = this.extractQuantity(data.LOT_COUNT_2 || "");
        const unit2 = this.extractUnit(data.LOT_COUNT_2 || "");
        lotCount2 = `${quantity2}`;
        lotUnit2 = unit2 || "ед.";
      }
    }

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
      lot_count: lotCount,
      lot_unit: lotUnit,
      FREE_DESCRIPTION: data.FREE_DESCRIPTION || "",
      unit_price: unitPrice,
      total_amount: totalAmount,
      total_summary: totalSummaryText,
      total_summary_amount: includeLot1
        ? includeLot2
          ? totalAmount + totalAmount2
          : totalAmount
        : totalAmount2,

      // Второй лот
      lot_description_2: data.LOT_DESCRIPTION_2 || "",
      lot_count_2: lotCount2,
      lot_unit_2: lotUnit2,
      unit_price_2: unitPrice2,
      total_amount_2: totalAmount2,
      lot_number_2: lotNumber2,

      // Флаги для условных блоков
      has_first_lot: includeLot1,
      has_second_lot: includeLot2,

      // Массивы позиций для таблиц
      lot_1_items: lot1Items,
      lot_2_items: lot2Items,

      // Изображения
      LOGO_PATH: logoBase64,
      PECHAT_PATH: pechatBase64,
    };
  }

  /**
   * Формирует строку количества с единицей измерения
   * @param {string} lotCount - исходная строка количества (с единицей)
   * @param {string} customUnit - кастомная единица измерения
   * @returns {string} строка вида "2 ед." или "2 шт."
   */
  formatLotCount(lotCount, customUnit) {
    if (!lotCount) return "";

    const quantity = this.extractQuantity(lotCount);

    // Если указана кастомная единица, используем её
    if (customUnit && customUnit.trim() !== "") {
      return `${quantity} ${customUnit}`;
    }

    // Иначе извлекаем единицу из исходной строки
    const unit = this.extractUnit(lotCount);
    return `${quantity} ${unit}`;
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
      console.log(
        "Внимание: Глобальный браузер не найден. Создается временный экземпляр.",
      );
      browserToUse = await puppeteer.launch({ headless: "new" });
      shouldCloseBrowser = true;
    }

    try {
      console.log("Создание новой страницы для генерации PDF...");
      const page = await browserToUse.newPage();

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
      try {
        await page.close();
        console.log("Страница для PDF успешно закрыта.");
      } catch (e) {
        console.error("Ошибка при закрытии страницы:", e);
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
    unit1 = "",
    unit2 = "",
  ) {
    let data;

    // 1. Проверяем кеш
    if (this.parsingCache.has(url)) {
      console.log(`Использование кешированных данных для URL: ${url}`);
      data = this.parsingCache.get(url);

      // Проверяем, есть ли данные API и используется ли краткое название
      if (
        data.API_DATA &&
        data.API_DATA.shortName &&
        data.COMPANY_NAME !== data.API_DATA.shortName
      ) {
        console.log(
          `Обновление названия компании в кешированных данных: ${data.COMPANY_NAME} -> ${data.API_DATA.shortName}`,
        );
        data.COMPANY_NAME = data.API_DATA.shortName;

        // Обновляем данные в кеше
        this.parsingCache.set(url, data);
      }
    } else {
      // 2. Если в кеше нет, парсим
      console.log(`Кеш не найден. Запуск парсинга для URL: ${url}`);
      const GoszakupkiParser = require("./parser");
      const goszakupkiParser = new GoszakupkiParser(this.browser);
      data = await goszakupkiParser.parsePage(url);

      // 3. Очищаем старый кеш и сохраняем новые данные
      this.parsingCache.clear();
      this.parsingCache.set(url, data);
      console.log(
        `Данные для URL: ${url} сохранены в кеш (старый кеш очищен).`,
      );
    }

    try {
      // 4. Клонируем данные из кеша и добавляем/обновляем информацию из текущего запроса
      const requestSpecificData = {
        ...data,
        UNIT_PRICE: unitPrice,
        UNIT_PRICE_2: unitPrice2,
        INCLUDE_LOT_1: includeLot1,
        INCLUDE_LOT_2: includeLot2,
        FREE_DESCRIPTION: freeDescription,
        UNIT_1: unit1,
        UNIT_2: unit2,
      };

      // Если второй лот включен, но не найден в данных, добавляем флаг
      if (includeLot2 && !requestSpecificData.HAS_SECOND_LOT) {
        console.warn("Второй лот включен, но не найден на странице закупки");
      }

      // 5. Генерируем PDF с обновленными данными
      const result = await this.generatePDF(requestSpecificData, url);

      // 6. Добавляем дополнительные данные для отправки в Telegram
      const extraData = {
        companyShortName: data.COMPANY_NAME || "",
        proposalEndDate: data.PROPOSAL_END_DATE || "",
      };

      return {
        ...result,
        ...extraData,
      };
    } catch (error) {
      console.error("Ошибка при генерации PDF из URL:", error);
      throw error;
    }
  }
}

module.exports = PDFGenerator;
