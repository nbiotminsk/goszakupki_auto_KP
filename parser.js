const puppeteer = require("puppeteer");

class GoszakupkiParser {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await puppeteer.launch({
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
      ],
    });
    this.page = await this.browser.newPage();

    // Устанавливаем user-agent
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    // Увеличиваем таймаут ожидания
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);
  }

  async parsePage(url) {
    if (!this.browser) {
      await this.initialize();
    }

    try {
      console.log(`Загрузка страницы: ${url}`);
      await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Ждем загрузки контента
      await this.page.waitForSelector("#print-area", { timeout: 10000 });

      // Извлекаем данные
      const data = await this.page.evaluate(() => {
        // Функция для безопасного извлечения текста
        const safeExtract = (selector) => {
          try {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : "";
          } catch (e) {
            console.error(`Ошибка извлечения для селектора ${selector}:`, e);
            return "";
          }
        };

        // Извлечение основных данных
        const companyName = safeExtract(
          "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(1) > td",
        );
        const unp = safeExtract(
          "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(3) > td",
        );
        const address = safeExtract(
          "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(2) > td",
        );
        const place = safeExtract(
          "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(2) > span",
        );
        const payment = safeExtract(
          "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(4) > span",
        );
        const endDate = safeExtract(
          "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(1) > span",
        );
        const lotDescription = safeExtract(
          "#lotsList > tbody > tr.lot-row > td.lot-description",
        );

        // Извлечение количества с парсингом
        let lotCount = "";
        const lotCountElement = document.querySelector(
          "#lotsList > tbody > tr.lot-row > td.lot-count-price",
        );
        if (lotCountElement) {
          const countText = lotCountElement.textContent.trim();
          // Ищем количество в начале строки (формат: "2 Единица(ед.), 1 652.64 BYN")
          const countMatch = countText.match(/^(\d+)\s+/);
          lotCount = countMatch ? `${countMatch[1]} ед.` : countText;
        }

        return {
          COMPANY_NAME: companyName,
          UNP: unp,
          ADDRESS: address,
          PLACE: place,
          PAYMENT: payment,
          END_DATE: endDate,
          LOT_DESCRIPTION: lotDescription,
          LOT_COUNT: lotCount,
        };
      });

      // Добавляем текущую дату
      const currentDate = new Date().toLocaleDateString("ru-BY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      data.DATE = currentDate;

      console.log("Данные успешно извлечены:", data);
      return data;
    } catch (error) {
      console.error("Ошибка при парсинге страницы:", error);
      throw new Error(`Не удалось распарсить страницу: ${error.message}`);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = GoszakupkiParser;
