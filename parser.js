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

      // Сначала переходим по URL с обработкой возможных редиректов
      const response = await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Проверяем статус ответа
      console.log(`Статус ответа: ${response.status()}`);

      // Ждем некоторого времени для возможных редиректов
      await this.page.waitForTimeout(5000);

      // Проверяем текущий URL (возможно, произошел редирект)
      const currentUrl = this.page.url();
      console.log(`Текущий URL: ${currentUrl}`);

      // Проверяем, не является ли страница ошибкой
      const isErrorPage = await this.page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body.innerText.toLowerCase();
        return (
          title.includes("ошибка") ||
          title.includes("error") ||
          bodyText.includes("страница не найдена") ||
          bodyText.includes("page not found")
        );
      });

      if (isErrorPage) {
        throw new Error("Страница недоступна или произошла ошибка загрузки");
      }

      // Пробуем найти данные используя различные подходы
      const data = await this.page.evaluate(() => {
        // Функция для безопасного извлечения текста
        const safeExtract = (selector) => {
          try {
            const element = document.querySelector(selector);
            return element ? element.textContent.trim() : "";
          } catch (e) {
            return "";
          }
        };

        // Проверяем наличие основного селектора
        const hasPrintArea = !!document.querySelector("#print-area");

        // Проверяем тип страницы
        const isMarketingPage = window.location.href.includes("/marketing/");

        if (hasPrintArea) {
          console.log("Использую оригинальные селекторы с #print-area");
          // Извлечение основных данных по оригинальным селекторам
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
        } else if (isMarketingPage) {
          console.log("Использую селекторы для страницы /marketing");
          // Извлечение данных для страницы /marketing
          const companyName = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(1) > td",
          );
          const address = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(2) > td",
          );
          const unp = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(3) > td",
          );

          // Для остальных полей используем оригинальные селекторы
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
        } else {
          console.log("Ищу данные используя универсальные методы");

          // Универсальный поиск данных
          const bodyText = document.body.innerText;

          // Поиск УНП с помощью регулярных выражений
          let unp = "";
          const unpMatches = bodyText.match(/УНП[^:]*:\s*(\d+)/g);
          if (unpMatches && unpMatches.length > 0) {
            const unpNumber = unpMatches[0].match(/(\d+)/);
            unp = unpNumber ? unpNumber[1] : "";
          }

          // Поиск организации (ищем первую крупную строку текста)
          const allElements = document.querySelectorAll("*");
          let companyName = "";

          // Ищем возможное название организации в заголовках или крупных элементах
          const possibleOrgSelectors = [
            "h1",
            "h2",
            "h3",
            ".title",
            ".organization",
            ".company",
            '[class*="org"]',
            '[class*="company"]',
            "td:first-child",
            "th",
          ];

          for (const selector of possibleOrgSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent.trim();
              if (
                text &&
                text.length > 5 &&
                text.length < 100 &&
                !text.includes("УНП") &&
                !text.includes("Адрес") &&
                !text.toLowerCase().includes("закуп") &&
                !text.toLowerCase().includes("лот") &&
                !text.match(/\d{4}/)
              ) {
                companyName = text;
                break;
              }
            }
            if (companyName) break;
          }

          // Поиск адреса
          let address = "";
          const addressMatches = bodyText.match(/Адрес[^:]*:\s*([^\n\r]+)/i);
          if (addressMatches) {
            address = addressMatches[1].trim();
          }

          // Поиск в таблицах
          const tables = document.querySelectorAll("table");
          let tableData = {};

          tables.forEach((table, index) => {
            const rows = table.querySelectorAll("tr");
            rows.forEach((row) => {
              const cells = row.querySelectorAll("td, th");
              if (cells.length >= 2) {
                const key = cells[0].textContent.trim().toLowerCase();
                const value = cells[1].textContent.trim();

                if (key.includes("уни")) tableData.unp = value;
                if (key.includes("адрес")) tableData.address = value;
                if (key.includes("организ")) tableData.companyName = value;
                if (key.includes("место")) tableData.place = value;
                if (key.includes("платеж")) tableData.payment = value;
                if (key.includes("окончан")) tableData.endDate = value;
              }
            });
          });

          // Комбинируем результаты
          if (!companyName && tableData.companyName)
            companyName = tableData.companyName;
          if (!unp && tableData.unp) unp = tableData.unp;
          if (!address && tableData.address) address = tableData.address;

          // Для остальных полей используем универсальные селекторы или оставляем пустыми
          const place =
            tableData.place ||
            safeExtract(
              "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(2) > span",
            ) ||
            "";

          const payment =
            tableData.payment ||
            safeExtract(
              "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(4) > span",
            ) ||
            "";

          const endDate =
            tableData.endDate ||
            safeExtract(
              "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(1) > span",
            ) ||
            "";

          const lotDescription =
            safeExtract(
              "#lotsList > tbody > tr.lot-row > td.lot-description",
            ) ||
            safeExtract(".description") ||
            safeExtract('[class*="description"]') ||
            "";

          let lotCount = "";
          const lotCountElement = document.querySelector(
            "#lotsList > tbody > tr.lot-row > td.lot-count-price",
          );
          if (lotCountElement) {
            const countText = lotCountElement.textContent.trim();
            const countMatch = countText.match(/^(\d+)/);
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
        }
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

      // Делаем скриншот для отладки
      try {
        const screenshotPath = `error-screenshot-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Скриншот ошибки сохранен: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log("Не удалось сделать скриншот:", screenshotError.message);
      }

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
