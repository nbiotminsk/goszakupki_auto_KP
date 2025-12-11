const puppeteer = require("puppeteer");
const https = require('https');

class GoszakupkiParser {
  constructor(browserInstance = null) {
    if (!browserInstance) {
      throw new Error(
        "Экземпляр браузера должен быть предоставлен конструктору GoszakupkiParser.",
      );
    }
    this.browser = browserInstance;
  }

  // Функция для получения данных о компании через API налоговой службы
  async getCompanyDataFromAPI(unp) {
    return new Promise((resolve, reject) => {
      if (!unp || unp.trim() === '') {
        resolve(null);
        return;
      }

      // Очищаем УНП от лишних символов
      const cleanUnp = unp.replace(/[^\d]/g, '');
      
      if (cleanUnp.length !== 9) {
        console.log(`Некорректный УНП: ${unp} (очищенный: ${cleanUnp})`);
        resolve(null);
        return;
      }

      const url = `https://grp.nalog.gov.by/api/grp-public/data?unp=${cleanUnp}&charset=UTF-8&type=json`;
      
      console.log(`Запрос данных о компании по УНП ${cleanUnp}...`);
      
      const request = https.get(url, { 
        rejectUnauthorized: false // Отключаем проверку сертификата для обхода возможных проблем с SSL
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.row && jsonData.row.vunp) {
              console.log(`Получены данные для УНП ${cleanUnp}: ${jsonData.row.vnaimp}`);
              resolve({
                unp: jsonData.row.vunp,
                fullName: jsonData.row.vnaimp,
                shortName: jsonData.row.vnaimk,
                address: jsonData.row.vpadres,
                registrationDate: jsonData.row.dreg,
                taxOfficeCode: jsonData.row.nmns,
                taxOfficeName: jsonData.row.vmns,
                statusCode: jsonData.row.ckodsost,
                statusName: jsonData.row.vkods,
                statusChangeDate: jsonData.row.dlikv
              });
            } else {
              console.log(`Данные для УНП ${cleanUnp} не найдены`);
              resolve(null);
            }
          } catch (error) {
            console.error(`Ошибка парсинга JSON для УНП ${cleanUnp}:`, error);
            resolve(null);
          }
        });
      });
      
      request.on('error', (error) => {
        console.error(`Ошибка запроса к API для УНП ${cleanUnp}:`, error);
        resolve(null);
      });
      
      request.setTimeout(5000, () => {
        request.destroy();
        console.error(`Таймаут запроса к API для УНП ${cleanUnp}`);
        resolve(null);
      });
    });
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
        
        // Определяем тип страницы для применения соответствующих селекторов
        const isRequestViewPage = window.location.href.includes('/request/view/');
        const isTenderViewPage = window.location.href.includes('/tender/view/');
        const isContractViewPage = window.location.href.includes('/contract/view/');

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
            // УНП в Беларуси - это 9-значное число, исключаем УНП 101223447
            if (/^\d{9}$/.test(text) && text.length === 9 && text !== '101223447') {
              return text;
            }
          }
          
          // Для страниц типа request/view/ ищем УНП в тексте с меткой "УНП"
          if (isRequestViewPage) {
            const tds = Array.from(document.querySelectorAll('td'));
            for (const td of tds) {
              const text = td.textContent.trim();
              // Ищем ячейку, содержащую "УНП" и 9-значное число
              if (text.includes('УНП') && /УНП\s+(\d{9})/.test(text)) {
                const match = text.match(/УНП\s+(\d{9})/);
                if (match) return match[1];
              }
            }
            
            // Если не нашли в тексте с меткой, ищем в ячейках с информацией об организации
            for (const td of tds) {
              const text = td.textContent.trim();
              // Если ячейка содержит информацию об организации (содержит "РУП", "ОАО" и т.д. или кавычки)
              // и содержит УНП, извлекаем УНП
              if ((text.includes('РУП') || text.includes('ОАО') || text.includes('ООО') || 
                   text.includes('ЗАО') || text.includes('ИП') || text.includes('ГУ') ||
                   text.includes('"') || text.includes('«') || text.includes('»')) &&
                  text.includes('УНП')) {
                const match = text.match(/УНП\s+(\d{9})/);
                if (match) return match[1];
              }
            }
            
            // Если не нашли в тексте с меткой, ищем отдельную ячейку с 9-значным числом
            // но исключаем номера закупок (обычно они в контексте с другими цифрами) и УНП 101223447
            for (const td of tds) {
              const text = td.textContent.trim();
              // УНП - это 9-значное число, но не должно быть частью другого текста, исключаем УНП 101223447
              if (/^\d{9}$/.test(text) && text.length === 9 && text !== '101223447') {
                // Проверяем, что это не номер закупки (ищем контекст)
                const parentRow = td.closest('tr');
                if (parentRow) {
                  const rowText = parentRow.textContent;
                  // Если в строке есть слова "номер", "закупки", "лот", то это не УНП
                  if (!rowText.includes('номер') && 
                      !rowText.includes('закупки') && 
                      !rowText.includes('лот') &&
                      !rowText.includes('№')) {
                    return text;
                  }
                } else {
                  // Дополнительная проверка: исключаем номер закупки по контексту
                  const allTds = Array.from(document.querySelectorAll('td'));
                  let isTenderNumber = false;
                  for (const otherTd of allTds) {
                    const otherText = otherTd.textContent.trim();
                    if (otherText.includes('№ закупки в ГИАС:') && 
                        otherText.includes(text)) {
                      // Это номер закупки, а не УНП
                      isTenderNumber = true;
                      break;
                    }
                  }
                  if (!isTenderNumber) {
                    return text;
                  }
                }
              }
            }
          }
          
          // Если не нашли в тексте с меткой, ищем везде с фильтрацией
          const tds = Array.from(document.querySelectorAll('td'));
          for (const td of tds) {
            const text = td.textContent.trim();
            // УНП в Беларуси - это 9-значное число, но не должно быть частью другого текста, исключаем УНП 101223447
            if (/^\d{9}$/.test(text) && 
                text.length === 9 &&
                text !== '101223447' &&
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
          
          // Для страниц типа request/view/ ищем название организации в ячейках таблицы
          if (isRequestViewPage) {
            // Сначала ищем в ячейках, содержащих информацию об организации-заказчике
            const tds = Array.from(document.querySelectorAll('td'));
            for (const td of tds) {
              const text = td.textContent.trim();
              // Ищем название организации - это текст, который:
              // 1. Содержит "РУП", "ОАО", "ООО" и т.д. или кавычки
              // 2. Не содержит "Размещение", "приглашения", "процедуре", "закупки", "Открыть", "Запрос"
              // 3. Не является УНП (9 цифр)
              // 4. Не является адресом (содержит "г." и индекс)
              // 5. Достаточно длинный (более 20 символов)
              // 6. Не содержит email или URL
              // 7. Не содержит "УНП" или "пл." (признаки контактной информации)
              // 8. Не содержит "каб." (признак адреса)
              // 9. Не содержит "info@" (признак email)
              if ((text.includes('РУП') || text.includes('ОАО') || text.includes('ООО') || 
                   text.includes('ЗАО') || text.includes('ИП') || text.includes('ГУ') ||
                   text.includes('"') || text.includes('«') || text.includes('»')) &&
                  !text.includes('Размещение') && 
                  !text.includes('приглашения') && 
                  !text.includes('процедуре') &&
                  !text.includes('закупки') &&
                  !text.includes('Открыть') &&
                  !text.includes('Запрос') &&
                  !/^\d{9}$/.test(text) &&
                  !text.includes('г. ') &&
                  !text.includes('@') &&
                  !text.includes('http') &&
                  !text.includes('УНП') &&
                  !text.includes('пл.') &&
                  !text.includes('каб.') &&
                  !text.includes('info@') &&
                  text.length > 20) {
                // Если текст содержит кавычки, извлекаем только название организации
                if (text.includes('"') || text.includes('«') || text.includes('»')) {
                  const orgMatch = text.match(/["«]([^"»]+)["»]/);
                  if (orgMatch) {
                    return orgMatch[1].trim();
                  }
                }
                return text;
              }
            }
            
            // Если не нашли организацию-заказчика, ищем в первой строке таблицы
            const firstRowTds = Array.from(document.querySelectorAll('tr:first-child td'));
            for (const td of firstRowTds) {
              const text = td.textContent.trim();
              // Ищем название организации в первой строке
              if (text.length > 20 && 
                  !text.includes('Размещение') && 
                  !text.includes('приглашения') && 
                  !text.includes('процедуре') &&
                  !text.includes('закупки') &&
                  !text.includes('Открыть') &&
                  !text.includes('Запрос') &&
                  !/^\d{9}$/.test(text) &&
                  !text.includes('г. ') &&
                  !text.includes('@') &&
                  !text.includes('http')) {
                return text;
              }
            }
          }
          
          // Если не нашли в первой ячейке, ищем везде с фильтрацией
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
          
          // Для страниц типа request/view/ ищем адрес в ячейках таблицы
          if (isRequestViewPage) {
            const tds = Array.from(document.querySelectorAll('td'));
            for (const td of tds) {
              const text = td.textContent.trim();
              // Ищем адрес - это текст, который:
              // 1. Содержит "г." (город) и индекс (6 цифр)
              // 2. Не содержит email или URL
              // 3. Не является названием организации (слишком длинный и содержит кавычки)
              if (text.includes('г. ') && 
                  /\d{6}/.test(text) &&
                  !text.includes('@') &&
                  !text.includes('http')) {
                // Если текст содержит кавычки, это может быть смешанная ячейка с названием организации и адресом
                if (text.includes('"') || text.includes('«') || text.includes('»')) {
                  // Извлекаем только адресную часть
                  const addressMatch = text.match(/(\d{6}[^"»]*)/);
                  if (addressMatch) {
                    return addressMatch[1].trim();
                  }
                } else {
                  return text;
                }
              }
            }
            
            // Если не нашли адрес в ячейках с индексом, ищем в ячейках с информацией об организации
            for (const td of tds) {
              const text = td.textContent.trim();
              // Если ячейка содержит информацию об организации (содержит "РУП", "ОАО" и т.д. или кавычки)
              // и содержит адрес, извлекаем адрес
              if ((text.includes('РУП') || text.includes('ОАО') || text.includes('ООО') || 
                   text.includes('ЗАО') || text.includes('ИП') || text.includes('ГУ') ||
                   text.includes('"') || text.includes('«') || text.includes('»')) &&
                  text.includes('г. ') && /\d{6}/.test(text)) {
                // Извлекаем только адресную часть
                const addressMatch = text.match(/(\d{6}[^"»]*)/);
                if (addressMatch) {
                  return addressMatch[1].trim();
                }
              }
            }
          }
          
          // Если не нашли во второй ячейке, ищем везде с фильтрацией
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

        // Для страниц типа request/view/ сначала используем конкретные селекторы
        let companyName, unp, address;
        
        if (isRequestViewPage) {
          // Используем селектор, указанный пользователем для названия организации
          companyName = safeExtract("body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(1) > td");
          unp = safeExtract("body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(3) > td");
          address = safeExtract("body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(2) > td");

          // Очистка названия компании от лишних данных (адрес, УНП и т.д.)
          if (companyName && companyName.includes('\n')) {
            companyName = companyName.split('\n')[0].trim();
          }
        } else {
          // Для других типов страниц используем стандартные селекторы
          companyName = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(1) > td");
          unp = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(3) > td");
          address = safeExtract("#print-area > div:nth-child(3) > table > tbody > tr:nth-child(2) > td");
        }

        // Ищем только УНП на странице, название компании и адрес получим из API
        if (!unp && !isRequestViewPage) {
          unp = findUNP();
        }
        
        // Название компании и адрес не парсим со страницы, получим из API
        companyName = "";
        address = "";

        // Если УНП не найден, пробуем старый селектор
        if (!unp) {
          unp = safeExtract(
            "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(3) > td",
          );
        }
        
        // Название компании и адрес не ищем по старым селекторам, получим из API

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
          pageType: isRequestViewPage ? "request/view" : (isTenderViewPage ? "tender/view" : (isContractViewPage ? "contract/view" : "unknown")),
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
          DATE: date,
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
        console.log(`Тип страницы: ${data.DEBUG_INFO.pageType}`);
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
      
      // Получаем данные из API налоговой службы по УНП
      if (data.UNP && data.UNP.trim() !== '') {
        console.log(`Получение информации по УНП: ${data.UNP}`);
        try {
          const apiData = await this.getCompanyDataFromAPI(data.UNP);
          if (apiData) {
            console.log("Данные из API получены успешно");
            
            // Добавляем данные из API в результат
            data.API_DATA = apiData;
            
            // Всегда используем краткое название компании из API (VNAIMK)
            // Если краткое название отсутствует, используем полное
            if (apiData.shortName) {
              data.COMPANY_NAME = apiData.shortName;
              console.log(`Используется краткое название из API: ${data.COMPANY_NAME}`);
            } else if (apiData.fullName) {
              data.COMPANY_NAME = apiData.fullName;
              console.log(`Используется полное название из API: ${data.COMPANY_NAME}`);
            }
            
            // Всегда используем адрес из API
            data.ADDRESS = apiData.address || '';
            console.log(`Используется адрес из API: ${data.ADDRESS}`);
            
            // Если УНП из страницы отличается от УНП из API, используем правильный
            if (apiData.unp && data.UNP !== apiData.unp) {
              console.log(`УНП исправлен: ${data.UNP} -> ${apiData.unp}`);
              data.UNP = apiData.unp;
            }
          } else {
            console.log("Не удалось получить данные из API налоговой службы");
          }
        } catch (error) {
          console.error("Ошибка при получении данных из API:", error);
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
