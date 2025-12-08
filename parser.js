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

        // Более надежные селекторы для извлечения данных
        // Ищем ячейки таблицы по текстовым меткам или контексту
        const findTdByText = (searchText) => {
          const tds = Array.from(document.querySelectorAll('td'));
          for (const td of tds) {
            if (td.textContent.includes(searchText)) {
              // Ищем ячейку в той же строке, но в другой колонке
              const row = td.closest('tr');
              if (row) {
                const tdsInRow = Array.from(row.querySelectorAll('td'));
                // Возвращаем следующую ячейку в строке, если она есть
                if (tdsInRow.length > 1) {
                  const currentIndex = tdsInRow.indexOf(td);
                  if (currentIndex < tdsInRow.length - 1) {
                    return tdsInRow[currentIndex + 1].textContent.trim();
                  }
                }
              }
            }
          }
          return "";
        };

        // Функция для проверки релевантности содержимого ячейки
        const isRelevantContent = (text) => {
          // Исключаем служебную информацию и документы
          const excludePatterns = [
            'Документы и (или) сведения',
            'посредством их размещения',
            'электронной торговой площадке',
            'подписанием ЭЦП',
            'поставщиками',
            'подрядчиками',
            'исполнителями',
            'Примечание',
            'Уважаемые',
            'Информация',
            'Объявление',
            'Извещение',
            'Приобретение товаров (работ, услуг)',
            'ориентировочная стоимость',
            'годовой (общей) потребности',
            'государственной закупки',
            'составляет не более',
            'базовых величин'
          ];

          for (const pattern of excludePatterns) {
            if (text.includes(pattern)) {
              return false;
            }
          }

          return true;
        };

        // Функция для проверки, находится ли ячейка в нужной таблице
        const isInCorrectTable = (td) => {
          // Проверяем, что ячейка находится в таблице с информацией об организации
          const printArea = td.closest('#print-area');
          if (!printArea) return false;
          
          // Ищем родительский div внутри print-area
          const parentDiv = td.closest('div');
          if (!parentDiv) return false;
          
          // Получаем все div внутри print-area
          const allDivs = Array.from(printArea.querySelectorAll('div'));
          const divIndex = allDivs.indexOf(parentDiv);
          
          // Нам нужен третий div (индекс 2), который содержит информацию об организации
          return divIndex === 2; // 0-based индекс
        };

        // Ищем ячейки с УНП (обычно это 9-значное число)
        const findUNP = () => {
          // Сначала ищем в правильной таблице
          const correctTableTds = Array.from(document.querySelectorAll('#print-area > div:nth-child(3) table td'));
          for (const td of correctTableTds) {
            const text = td.textContent.trim();
            // УНП в Беларуси - это 9-значное число
            if (/^\d{9}$/.test(text) && text.length === 9) {
              return text;
            }
          }
          
          // Если не нашли в правильной таблице, ищем везде с фильтрацией
          const tds = Array.from(document.querySelectorAll('td'));
          for (const td of tds) {
            const text = td.textContent.trim();
            // УНП в Беларуси - это 9-значное число, но не должно быть частью другого текста
            if (/^\d{9}$/.test(text) && 
                text.length === 9 &&
                isRelevantContent(text)) {
              return text;
            }
          }
          return "";
        };

        // Ищем название компании (обычно это самая длинная текстовая строка в таблице)
        const findCompanyName = () => {
          // Сначала ищем в правильной таблице
          const correctTableTds = Array.from(document.querySelectorAll('#print-area > div:nth-child(3) table td'));
          let longestText = "";
          for (const td of correctTableTds) {
            const text = td.textContent.trim();
            // Название компании - самая длинная строка, не содержащая УНП или адрес
            if (!/^\d{9}$/.test(text) && 
                !text.includes('г. ') && 
                text.length > longestText.length && 
                text.length > 20) {
              longestText = text;
            }
          }
          
          // Если нашли в правильной таблице, возвращаем результат
          if (longestText) {
            return longestText;
          }
          
          // Если не нашли в правильной таблице, ищем везде с фильтрацией
          const tds = Array.from(document.querySelectorAll('td'));
          for (const td of tds) {
            const text = td.textContent.trim();
            // Пропускаем ячейки с УНП, адресами и служебной информацией
            if (!/^\d{9}$/.test(text) && 
                !text.includes('г. ') && 
                isRelevantContent(text) &&
                text.length > longestText.length && 
                text.length > 20) {
              longestText = text;
            }
          }
          return longestText;
        };

        // Ищем адрес (обычно содержит "г." и индекс)
        const findAddress = () => {
          // Сначала ищем в правильной таблице
          const correctTableTds = Array.from(document.querySelectorAll('#print-area > div:nth-child(3) table td'));
          for (const td of correctTableTds) {
            const text = td.textContent.trim();
            // Адрес обычно содержит "г." (город) и индекс
            if (text.includes('г. ') && /\d{6}/.test(text)) {
              return text;
            }
          }
          
          // Если не нашли в правильной таблице, ищем везде с фильтрацией
          const tds = Array.from(document.querySelectorAll('td'));
          for (const td of tds) {
            const text = td.textContent.trim();
            // Адрес обычно содержит "г." (город) и индекс, но не содержит служебной информации
            if (text.includes('г. ') && 
                /\d{6}/.test(text) &&
                isRelevantContent(text)) {
              return text;
            }
          }
          return "";
        };

        // Сначала пробуем найти данные в конкретных таблицах
        let companyName = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(1) > td");
        let unp = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(3) > td");
        let address = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(2) > td");

        // Если не нашли в конкретной таблице, пробуем общие функции поиска
        if (!companyName) {
          companyName = findCompanyName();
        }
        if (!unp) {
          unp = findUNP();
        }
        if (!address) {
          address = findAddress();
        }

        // Если и общие функции не сработали, пробуем старые селекторы
        if (!companyName) {
          companyName = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(1) > td",
          );
        }
        if (!unp) {
          unp = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(3) > td",
          );
        }
        if (!address) {
          address = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(2) > td",
          );
        }

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

        // Добавляем отладочную информацию
        const allTds = Array.from(document.querySelectorAll('td'));
        const relevantTds = allTds.filter(td => isRelevantContent(td.textContent.trim()));
        const correctTableTds = Array.from(document.querySelectorAll('#print-area > div:nth-child(3) table td'));
        
        // Определяем источник данных
        const dataSource = {
          companyName: safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(1) > td") ? "specific_table" : 
                        (companyName && correctTableTds.some(td => td.textContent.trim() === companyName) ? "correct_table" : "general_search"),
          unp: safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(3) > td") ? "specific_table" : 
               (unp && correctTableTds.some(td => td.textContent.trim() === unp) ? "correct_table" : "general_search"),
          address: safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(2) > td") ? "specific_table" : 
                  (address && correctTableTds.some(td => td.textContent.trim() === address) ? "correct_table" : "general_search")
        };
        
        const debugInfo = {
          allTdsCount: allTds.length,
          relevantTdsCount: relevantTds.length,
          correctTableTdsCount: correctTableTds.length,
          companyNameFound: !!companyName,
          unpFound: !!unp,
          addressFound: !!address,
          dataSource: dataSource,
          sampleIrrelevantTds: allTds
            .filter(td => !isRelevantContent(td.textContent.trim()))
            .slice(0, 3)
            .map(td => td.textContent.trim().substring(0, 50) + '...'),
        };

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
          DEBUG_INFO: debugInfo,
        };
      });

      const currentDate = new Date().toLocaleDateString("ru-BY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      data.DATE = currentDate;

      console.log("Данные успешно извлечены:", data);
      
      // Выводим отладочную информацию
      if (data.DEBUG_INFO) {
        console.log("Отладочная информация:", data.DEBUG_INFO);
        console.log(`Всего ячеек TD: ${data.DEBUG_INFO.allTdsCount}`);
        console.log(`Релевантных ячеек TD: ${data.DEBUG_INFO.relevantTdsCount}`);
        console.log(`Ячеек в правильной таблице: ${data.DEBUG_INFO.correctTableTdsCount}`);
        console.log(`Название компании найдено: ${data.DEBUG_INFO.companyNameFound ? 'Да' : 'Нет'} (источник: ${data.DEBUG_INFO.dataSource.companyName})`);
        console.log(`УНП найдено: ${data.DEBUG_INFO.unpFound ? 'Да' : 'Нет'} (источник: ${data.DEBUG_INFO.dataSource.unp})`);
        console.log(`Адрес найден: ${data.DEBUG_INFO.addressFound ? 'Да' : 'Нет'} (источник: ${data.DEBUG_INFO.dataSource.address})`);
        
        if (data.DEBUG_INFO.sampleIrrelevantTds && data.DEBUG_INFO.sampleIrrelevantTds.length > 0) {
          console.log("Примеры отфильтрованных ячеек:");
          data.DEBUG_INFO.sampleIrrelevantTds.forEach((sample, index) => {
            console.log(`  ${index + 1}. ${sample}`);
          });
        }
      }
      
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
