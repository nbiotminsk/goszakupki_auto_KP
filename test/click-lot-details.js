const puppeteer = require("puppeteer");

async function clickLotDetailsAndFindQuantity() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для клика по деталям лота...");

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
    console.log("🖱️ КЛИК ПО КНОПКЕ РАЗВЕРТЫВАНИЯ ДЕТАЛЕЙ ЛОТА");
    console.log("=".repeat(80));

    // Ждем загрузки элемента
    await page.waitForSelector("#lot-exp-1", { timeout: 5000 });
    console.log("✅ Кнопка развертывания лота найдена");

    // Кликаем на кнопку
    await page.click("#lot-exp-1");
    console.log("✅ Клик выполнен");

    // Ждем загрузки данных
    await page.waitForTimeout(2000);
    console.log("✅ Подождали 2 секунды для загрузки");

    console.log("\n" + "=".repeat(80));
    console.log("🔍 АНАЛИЗ ТАБЛИЦ ПОСЛЕ РАЗВЕРТЫВАНИЯ");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const results = {
        allTables: [],
        tablesWithQuantity2: [],
      };

      // Анализируем все таблицы
      const tables = Array.from(document.querySelectorAll("table"));
      console.log(`\n📊 Найдено таблиц: ${tables.length}\n`);

      tables.forEach((table, tableIndex) => {
        console.log(`\n--- Таблица #${tableIndex + 1} ---`);

        const tableInfo = {
          index: tableIndex + 1,
          id: table.id || "",
          className: table.className || "",
          rowCount: 0,
          headers: [],
          hasQuantity2: false,
          rows: [],
        };

        const rows = Array.from(table.querySelectorAll("tr"));
        tableInfo.rowCount = rows.length;

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td, th"));
          const cellTexts = cells.map(cell => cell.textContent.trim());

          // Если это первая строка, сохраняем заголовки
          if (rowIndex === 0) {
            tableInfo.headers = cellTexts;
            console.log(`Заголовки: ${cellTexts.join(" | ")}`);

            // Проверяем, есть ли заголовок с "Кол-во"
            const hasQuantityHeader = cellTexts.some(header =>
              header.toLowerCase().includes("кол-") ||
              header.toLowerCase().includes("количе")
            );
            tableInfo.hasQuantityHeader = hasQuantityHeader;
            if (hasQuantityHeader) {
              console.log(`✅ Найден заголовок количества`);
            }
          }

          // Проверяем, содержит ли эта строка количество "2"
          cells.forEach((cell, cellIndex) => {
            const text = cell.textContent.trim();

            // Ищем ячейку с количеством "2"
            if (text === "2") {
              console.log(`\n🎯 НАЙДЕНО КОЛИЧЕСТВО "2":`);
              console.log(`   Таблица: #${tableIndex + 1}`);
              console.log(`   Строка: ${rowIndex + 1}`);
              console.log(`   Колонка: ${cellIndex + 1}`);
              console.log(`   Класс ячейки: "${cell.className}"`);
              console.log(`   Полная строка: ${cellTexts.join(" | ")}`);

              tableInfo.hasQuantity2 = true;

              // Формируем селектор
              let tableSelector = "";
              if (table.id) {
                tableSelector = `#${table.id}`;
              } else {
                const parent = table.closest("div");
                if (parent) {
                  const siblings = Array.from(parent.children);
                  const tableIndexInParent = siblings.indexOf(table) + 1;
                  tableSelector = `div:nth-of-type(${tableIndexInParent}) table`;
                }
              }

              results.tablesWithQuantity2.push({
                tableIndex: tableIndex + 1,
                tableId: table.id || "",
                tableSelector: tableSelector,
                fullSelector: `${tableSelector} > tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(${cellIndex + 1})`,
                rowIndex: rowIndex + 1,
                colIndex: cellIndex + 1,
                value: text,
                rowTexts: cellTexts,
              });
            }
          });

          // Сохраняем информацию о строке
          tableInfo.rows.push(cellTexts);
        });

        results.allTables.push(tableInfo);
      });

      // Ищем таблицу с количеством "2" более гибко
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ГИБКИЙ ПОИСК ТАБЛИЦЫ СО СТРУКТУРОЙ: № | Наименование | Кол-во | Цена | Сумма");
      console.log("=".repeat(80));

      results.allTables.forEach((tableInfo, tableIndex) => {
        tableInfo.rows.forEach((row, rowIndex) => {
          // Проверяем, соответствует ли строка ожидаемой структуре
          if (row.length >= 4) {
            const firstCell = row[0];
            const secondCell = row[1];
            const thirdCell = row[2];
            const fourthCell = row[3];

            // Проверяем: первая ячейка - номер, вторая - описание (длинная),
            // третья - количество (число), четвертая - цена (с запятой и точкой)
            const isNumber = /^\d+$/.test(firstCell);
            const isDescription = secondCell.length > 20;
            const isQuantity = /^\d+$/.test(thirdCell) && parseInt(thirdCell) > 0;
            const isPrice = fourthCell.includes(",") && fourthCell.includes(".");

            if (isNumber && isDescription && isQuantity && isPrice) {
              console.log(`\n✅ НАЙДЕНА ТАБЛИЦА С ТАКОЙ СТРУКТУРОЙ!`);
              console.log(`   Таблица: #${tableIndex + 1}`);
              console.log(`   Строка: ${rowIndex + 1}`);
              console.log(`   Колонки: ${row.length}`);
              console.log(`   [1] Номер: "${firstCell}"`);
              console.log(`   [2] Описание: "${secondCell.substring(0, 50)}..."`);
              console.log(`   [3] Количество: "${thirdCell}"`);
              console.log(`   [4] Цена: "${fourthCell}"`);
              if (row.length > 4) {
                console.log(`   [5] Сумма: "${row[4]}"`);
              }

              // Если это не уже найденная таблица, добавляем в результаты
              const table = results.allTables[tableIndex];
              const isNewTable = !results.tablesWithQuantity2.some(t =>
                t.tableIndex === tableIndex + 1 &&
                t.rowIndex === rowIndex + 1
              );

              if (isNewTable) {
                let tableSelector = "";
                if (table.id) {
                  tableSelector = `#${table.id}`;
                } else {
                  // Пытаемся найти уникальный селектор
                  const parent = tableInfo.dom?.closest("div");
                  if (parent) {
                    const siblings = Array.from(parent.children);
                    const tableIndexInParent = siblings.indexOf(table) + 1;
                    tableSelector = `div:nth-of-type(${tableIndexInParent}) table`;
                  } else {
                    tableSelector = `table:nth-child(${tableIndex + 1})`;
                  }
                }

                results.tablesWithQuantity2.push({
                  tableIndex: tableIndex + 1,
                  tableId: table.id || "",
                  tableSelector: tableSelector,
                  fullSelector: `${tableSelector} > tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(3)`,
                  rowIndex: rowIndex + 1,
                  colIndex: 3,
                  value: thirdCell,
                  rowTexts: row,
                  structure: "№ | Наименование | Кол-во | Цена | Сумма",
                });
              }
            }
          }
        });
      });

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    if (result.tablesWithQuantity2.length > 0) {
      console.log(`\n✅ Найдено ${result.tablesWithQuantity2.length} таблиц с количеством!`);

      result.tablesWithQuantity2.forEach((table, index) => {
        console.log(`\n${"─".repeat(80)}`);
        console.log(`🎯 Таблица #${index + 1}`);
        console.log(`${"─".repeat(80)}`);
        console.log(`Таблица в документе: #${table.tableIndex}`);
        console.log(`ID таблицы: ${table.tableId || "(нет)"}`);
        console.log(`Селектор таблицы: ${table.tableSelector}`);
        console.log(`Полный селектор ячейки с количеством:`);
        console.log(`   ${table.fullSelector}`);
        console.log(`\nДанные:`);
        console.log(`  Значение: ${table.value}`);
        console.log(`  Позиция: строка ${table.rowIndex}, колонка ${table.colIndex}`);
        console.log(`  Структура: ${table.structure || "Обычная"}`);
        if (table.rowTexts) {
          console.log(`  Полная строка:`);
          table.rowTexts.forEach((text, i) => {
            const truncated = text.length > 40 ? text.substring(0, 40) + "..." : text;
            console.log(`    [${i + 1}] ${truncated}`);
          });
        }
      });

      console.log(`\n\n${"=".repeat(80)}`);
      console.log("💡 РЕКОМЕНДАЦИЯ");
      console.log(`${"=".repeat(80)}`);
      console.log(`\nДля получения количества используйте селектор:`);
      console.log(`\n${result.tablesWithQuantity2[0].fullSelector}`);
      console.log(`\nИли универсальный селектор:`);
      console.log(`\n${result.tablesWithQuantity2[0].tableSelector} > tbody > tr > td:nth-child(3)`);
    } else {
      console.log(`\n❌ Таблицы с количеством не найдены после развертывания.`);
      console.log(`\nВозможные причины:`);
      console.log(`1. Таблица загружается динамически (нужно подождать дольше)`);
      console.log(`2. Таблица находится в iframe`);
      console.log(`3. Таблица в другом месте (например, в документе Word)`);
    }

  } catch (error) {
    console.error("❌ Ошибка:", error);
  } finally {
    if (browser) {
      console.log("\n⏸️ Браузер остаётся открытым для визуального осмотра");
      console.log("Нажмите Ctrl+C для завершения");
    }
  }
}

// Запуск скрипта
clickLotDetailsAndFindQuantity().catch(console.error);
