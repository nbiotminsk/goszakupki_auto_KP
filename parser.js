const puppeteer = require("puppeteer");

class GoszakupkiParser {
  constructor(browserInstance = null) {
    if (!browserInstance) {
      throw new Error(
        "Экземпляр браузера должен быть предоставлен конструктору GoszakupkiParser.",
      );
    }
    this.browser = browserInstance;
  }

  async parsePage(url) {
    let context = null;
    let page = null;

    try {
      console.log("Создание нового инкогнито контекста для парсинга...");
      context = await this.browser.createIncognitoBrowserContext();
      page = await context.newPage();

      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      page.setDefaultNavigationTimeout(45000);

      console.log(`Загрузка страницы: ${url}`);
      const response = await page.goto(url, { waitUntil: "domcontentloaded" });

      if (!response.ok()) {
        throw new Error(
          `Не удалось загрузить страницу, статус: ${response.status()}`,
        );
      }

      console.log(`Страница успешно загружена, статус: ${response.status()}`);

      await page.waitForSelector("body", { timeout: 15000 });

      const data = await page.evaluate(() => {
        const safeExtract = (selector) => {
          const element = document.querySelector(selector);
          return element ? element.textContent.trim() : "";
        };

        const companyName = safeExtract(
          "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(1) > td",
        );
        const unp = safeExtract(
          "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(3) > td",
        );
        const address = safeExtract(
          "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(2) > td",
        );

        // Извлекаем PLACE, PAYMENT и END_DATE с правильными селекторами
        const place =
          safeExtract(
            "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(2) > span",
          ) ||
          safeExtract(
            "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(4) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(4) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(5) > td",
          );

        const payment =
          safeExtract(
            "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(4) > span",
          ) ||
          safeExtract(
            "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(5) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(5) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(6) > td",
          );

        const endDate =
          safeExtract(
            "#lot-inf-1 > td:nth-child(3) > ul:nth-child(1) > li:nth-child(1) > span",
          ) ||
          safeExtract(
            "#print-area > div:nth-child(3) > table > tbody > tr:nth-child(6) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(6) > td",
          ) ||
          safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(7) > td",
          );
        const lotDescription = safeExtract(
          "#lotsList tr.lot-row td.lot-description",
        );

        let lotCount = "";
        const lotCountElement = document.querySelector(
          "#lotsList > tbody > tr.lot-row > td.lot-count-price",
        );
        if (lotCountElement) {
          const countText = lotCountElement.textContent.trim();
          const countMatch = countText.match(/^(\d+)/);
          lotCount = countMatch ? `${countMatch[1]} ед.` : countText;
        }

        const hasSecondLot =
          document.querySelectorAll("#lotsList tr.lot-row").length > 1;
        let lotDescription2 = "";
        let lotCount2 = "";

        if (hasSecondLot) {
          lotDescription2 = safeExtract(
            "#lotsList > tbody > tr:nth-of-type(3) > td.lot-description",
          );
          const lotCountElement2 = document.querySelector(
            "#lotsList > tbody > tr:nth-of-type(3) > td.lot-count-price",
          );
          if (lotCountElement2) {
            const countText2 = lotCountElement2.textContent.trim();
            const countMatch2 = countText2.match(/^(\d+)/);
            lotCount2 = countMatch2 ? `${countMatch2[1]} ед.` : countText2;
          }
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
          LOT_DESCRIPTION_2: lotDescription2,
          LOT_COUNT_2: lotCount2,
          HAS_SECOND_LOT: hasSecondLot,
        };
      });

      const currentDate = new Date().toLocaleDateString("ru-BY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      data.DATE = currentDate;

      console.log("Данные успешно извлечены:", data);
      return data;
    } catch (error) {
      console.error(`Ошибка при парсинге URL ${url}:`, error);
      if (page && !page.isClosed()) {
        try {
          const screenshotPath = `error-screenshot-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Скриншот ошибки сохранен в ${screenshotPath}`);
        } catch (screenshotError) {
          console.error("Не удалось сделать скриншот:", screenshotError);
        }
      }
      throw new Error(`Не удалось распарсить страницу: ${error.message}`);
    } finally {
      if (context) {
        try {
          await context.close();
          console.log("Инкогнито контекст парсера успешно закрыт.");
        } catch (e) {
          console.error(
            "Произошла ошибка при закрытии инкогнито контекста:",
            e,
          );
        }
      }
    }
  }
}

module.exports = GoszakupkiParser;
