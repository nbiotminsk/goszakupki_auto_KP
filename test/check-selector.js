const puppeteer = require("puppeteer");

async function checkSelector() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для проверки селектора...");

    browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const page = await browser.newPage();
    const testUrl = "https://goszakupki.by/marketing/view/3030091";

    console.log(`📄 Загрузка страницы: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: "networkidle2", timeout: 30000 });

    console.log("✅ Страница загружена");
    console.log("\n" + "=".repeat(80));
    console.log("🔍 ПРОВЕРКА СЕЛЕКТОРА");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const selector = "#lotsList > tbody > tr.lot-row > td.lot-count-price";
      const results = {
        selector: selector,
        elementExists: false,
        elementContent: null,
        lotsListExists: false,
        tbodyExists: false,
        lotRowExists: false,
        lotCountPriceExists: false,
        alternatives: [],
      };

      console.log(`\n📍 Проверка селектора: "${selector}"`);

      // Проверяем каждый уровень селектора отдельно
      const lotsList = document.querySelector("#lotsList");
      if (lotsList) {
        results.lotsListExists = true;
        console.log("✅ Элемент #lotsList найден");

        const tbody = lotsList.querySelector("tbody");
        if (tbody) {
          results.tbodyExists = true;
          console.log("✅ Элемент tbody найден");

          const lotRows = tbody.querySelectorAll("tr.lot-row");
          if (lotRows.length > 0) {
            results.lotRowExists = true;
            console.log(`✅ Найдено tr.lot-row: ${lotRows.length}`);

            // Проверяем ячейки с количеством
            lotRows.forEach((row, index) => {
              const lotCountPrice = row.querySelector("td.lot-count-price");
              if (lotCountPrice) {
                results.lotCountPriceExists = true;
                results.elementExists = true;
                results.elementContent = lotCountPrice.textContent.trim();
                console.log(`✅ Лот #${index + 1}: найден td.lot-count-price`);
                console.log(`   Содержимое: "${results.elementContent}"`);
              } else {
                console.log(`❌ Лот #${index + 1}: НЕ найден td.lot-count-price`);
              }
            });
          } else {
            console.log("❌ Элемент tr.lot-row НЕ найден");
          }
        } else {
          console.log("❌ Элемент tbody НЕ найден");
        }
      } else {
        console.log("❌ Элемент #lotsList НЕ найден");
      }

      // Ищем альтернативные селекторы
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ПОИСК АЛЬТЕРНАТИВНЫХ СЕЛЕКТОРОВ");
      console.log("=".repeat(80));

      // 1. Ищем все таблицы
      const tables = Array.from(document.querySelectorAll("table"));
      console.log(`\n📊 Найдено таблиц: ${tables.length}`);

      tables.forEach((table, index) => {
        console.log(`\n--- Таблица #${index + 1} ---`);

        // Ищем строки, похожие на лоты
        const rows = Array.from(table.querySelectorAll("tr"));
        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td"));

          if (cells.length >= 3) {
            const firstCell = cells[0].textContent.trim();
            const secondCell = cells[1].textContent.trim();
            const thirdCell = cells[2].textContent.trim();

            // Проверяем, соответствует ли строка структуре лота
            if (/^\d+$/.test(firstCell) && secondCell.length > 10 && /^\d+$/.test(thirdCell)) {
              console.log(`\n🎯 Найден лот в строке ${rowIndex + 1} таблицы #${index + 1}:`);
              console.log(`   Номер: "${firstCell}"`);
              console.log(`   Описание: "${secondCell.substring(0, 50)}..."`);
              console.log(`   Количество (td:nth-child(3)): "${thirdCell}"`);

              // Формируем селектор для этой строки
              let tableSelector = "";
              if (table.id) {
                tableSelector = `#${table.id}`;
              } else {
                // Находим путь к таблице
                const parent = table.closest("div");
                if (parent) {
                  const siblings = Array.from(parent.children);
                  const tableIndex = siblings.indexOf(table) + 1;
                  tableSelector = `div:nth-of-type(${tableIndex}) table`;
                }
              }

              results.alternatives.push({
                tableIndex: index + 1,
                rowIndex: rowIndex + 1,
                tableSelector: tableSelector,
                fullSelector: `${tableSelector} > tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(3)`,
                count: thirdCell,
                description: secondCell
              });
            }
          }
        });
      });

      // 2. Проверяем селектор, который мы пытались использовать для маркетинга
      const marketingSelector = "body > div > div > div:nth-child(4) > table > tbody > tr:nth-child(6) > td";
      console.log(`\n\n--- Проверка маркетинг-селектора ---`);
      console.log(`Селектор: "${marketingSelector}"`);
      const marketingElement = document.querySelector(marketingSelector);
      if (marketingElement) {
        console.log(`✅ Найден! Содержимое: "${marketingElement.textContent.trim()}"`);
        results.alternatives.push({
          type: "marketing-specific",
          selector: marketingSelector,
          content: marketingElement.textContent.trim()
        });
      } else {
        console.log(`❌ Не найден`);
      }

      // 3. Проверяем селектор по классу
      const countPriceTds = Array.from(document.querySelectorAll("td[class*='count'], td[class*='price']"));
      console.log(`\n\n--- Ячейки с классами count/price ---`);
      console.log(`Найдено: ${countPriceTds.length}`);

      countPriceTds.forEach((td, index) => {
        if (index < 5) {
          console.log(`${index + 1}. Класс: "${td.className}", Содержимое: "${td.textContent.trim()}"`);

          // Пытаемся найти селектор для этой ячейки
          const row = td.closest("tr");
          if (row) {
            const table = row.closest("table");
            if (table) {
              const allRows = Array.from(table.querySelectorAll("tr"));
              const rowIndex = allRows.indexOf(row) + 1;
              const allCells = Array.from(row.querySelectorAll("td"));
              const cellIndex = allCells.indexOf(td) + 1;

              let tableSelector = "";
              if (table.id) {
                tableSelector = `#${table.id}`;
              } else {
                const parent = table.closest("div");
                if (parent) {
                  const siblings = Array.from(parent.children);
                  const tableIndex = siblings.indexOf(table) + 1;
                  tableSelector = `div:nth-of-type(${tableIndex}) table`;
                }
              }

              const fullSelector = `${tableSelector} > tbody > tr:nth-child(${rowIndex}) > td:nth-child(${cellIndex})`;
              console.log(`   Селектор: ${fullSelector}`);

              results.alternatives.push({
                type: "by-class",
                selector: fullSelector,
                className: td.className,
                content: td.textContent.trim()
              });
            }
          }
        }
      });

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    console.log(`\nСелектор: ${result.selector}`);
    console.log(`Элемент найден: ${result.elementExists ? "✅ Да" : "❌ Нет"}`);

    if (result.elementContent) {
      console.log(`Содержимое: "${result.elementContent}"`);
    }

    console.log(`\nПошаговая проверка:`);
    console.log(`  #lotsList: ${result.lotsListExists ? "✅" : "❌"}`);
    console.log(`  tbody: ${result.tbodyExists ? "✅" : "❌"}`);
    console.log(`  tr.lot-row: ${result.lotRowExists ? "✅" : "❌"}`);
    console.log(`  td.lot-count-price: ${result.lotCountPriceExists ? "✅" : "❌"}`);

    if (result.alternatives.length > 0) {
      console.log(`\n\n" + "=".repeat(80)`);
      console.log(`💡 АЛЬТЕРНАТИВНЫЕ СЕЛЕКТОРЫ`);
      console.log("=".repeat(80));

      result.alternatives.forEach((alt, index) => {
        console.log(`\n${index + 1}. ${alt.type || "Таблица"} #${alt.tableIndex || "?"}`);
        if (alt.fullSelector) {
          console.log(`   Селектор: ${alt.fullSelector}`);
          console.log(`   Количество: "${alt.count || alt.content}"`);
          if (alt.description) {
            console.log(`   Описание: "${alt.description.substring(0, 40)}..."`);
          }
        } else if (alt.selector) {
          console.log(`   Селектор: ${alt.selector}`);
          console.log(`   Содержимое: "${alt.content}"`);
        }
      });
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("🎯 РЕКОМЕНДАЦИЯ");
    console.log("=".repeat(80));

    if (result.elementExists) {
      console.log("\n✅ Селектор работает! Можно использовать:");
      console.log(`   ${result.selector}`);
    } else if (result.alternatives.length > 0) {
      console.log("\n💡 Рекомендуемый селектор:");
      const firstAlt = result.alternatives.find(alt => alt.count && /^\d+$/.test(alt.count));
      if (firstAlt && firstAlt.fullSelector) {
        console.log(`   ${firstAlt.fullSelector}`);
        console.log(`   Количество: "${firstAlt.count}"`);
      } else if (result.alternatives.length > 0) {
        const alt = result.alternatives[0];
        console.log(`   ${alt.fullSelector || alt.selector}`);
      }
    } else {
      console.log("\n❌ Не удалось найти подходящий селектор.");
      console.log("💡 Рекомендация: проанализировать DOM-структуру страницы вручную.");
    }

  } catch (error) {
    console.error("❌ Ошибка при проверке селектора:", error);
  } finally {
    if (browser) {
      console.log("\n⏸️ Браузер остаётся открытым для визуального осмотра");
      console.log("Нажмите Ctrl+C для завершения");
    }
  }
}

// Запуск проверки
checkSelector().catch(console.error);
