const puppeteer = require("puppeteer");

async function findTableWithQuantity2() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для поиска таблицы с количеством '2'...");

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
    console.log("🔍 ПОИСК ТАБЛИЦЫ С КОЛИЧЕСТВОМ '2'");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const results = {
        tablesWithQuantity: [],
        tableStructure: [],
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
          hasQuantity: false,
          quantityValue: "",
          quantityPosition: { row: -1, col: -1 },
          selector: "",
          rows: [],
        };

        const rows = Array.from(table.querySelectorAll("tr"));
        tableInfo.rowCount = rows.length;

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td, th"));
          const cellTexts = cells.map(cell => cell.textContent.trim());

          // Сохраняем информацию о строке
          const rowData = {
            index: rowIndex + 1,
            cells: cellTexts.map((text, cellIndex) => ({
              index: cellIndex,
              text: text,
              tag: cells[cellIndex].tagName,
              className: cells[cellIndex].className,
              isNumber: /^\d+$/.test(text),
              isSmallNumber: /^\d+$/.test(text) && parseInt(text) < 10000,
            })),
          };

          tableInfo.rows.push(rowData);

          // Если это первая строка, сохраняем заголовки
          if (rowIndex === 0) {
            tableInfo.headers = cellTexts;
            console.log(`Заголовки: ${cellTexts.join(" | ")}`);

            // Проверяем, есть ли заголовок "Кол-во" или "Количество"
            const hasQuantityHeader = cellTexts.some(header =>
              header.toLowerCase().includes("кол-") ||
              header.toLowerCase().includes("количе") ||
              header.toLowerCase().includes("quantity")
            );
            tableInfo.hasQuantityHeader = hasQuantityHeader;

            if (hasQuantityHeader) {
              console.log(`✅ Найден заголовок количества`);
              // Находим позицию заголовка количества
              const quantityColIndex = cellTexts.findIndex(header =>
                header.toLowerCase().includes("кол-") ||
                header.toLowerCase().includes("количе")
              );
              tableInfo.quantityColIndex = quantityColIndex;
              console.log(`   Позиция: колонка ${quantityColIndex + 1}`);
            }
          }

          // Проверяем, не содержит ли эта строка количество '2'
          cells.forEach((cell, cellIndex) => {
            const text = cell.textContent.trim();

            // Ищем ячейку с числом, которое может быть количеством
            if (/^\d+$/.test(text) && parseInt(text) > 0 && parseInt(text) < 10000) {
              // Проверяем контекст: не является ли это частью цены (напр., "2 243.00")
              const rowText = row.textContent;

              // Если это не часть цены (не рядом с "BYN" или валютой)
              if (!rowText.includes("BYN") || !cell.nextSibling ||
                  (cell.nextSibling && !cell.nextSibling.textContent.includes("."))) {

                // Это может быть количество, проверяем контекст
                console.log(`\n🔍 Найдена ячейка с числом "${text}":`);
                console.log(`   Таблица: #${tableIndex + 1}`);
                console.log(`   Строка: ${rowIndex + 1}`);
                console.log(`   Колонка: ${cellIndex + 1}`);
                console.log(`   Класс: "${cell.className}"`);
                console.log(`   Полное содержимое строки:`);

                const cellTextsInRow = cells.map(c => {
                  const t = c.textContent.trim();
                  return t.length > 30 ? t.substring(0, 30) + "..." : t;
                });
                console.log(`     ${cellTextsInRow.join(" | ")}`);

                // Проверяем, соответствует ли это ожидаемой структуре
                // Номер | Описание | Количество | Цена | Сумма
                if (cells.length >= 3) {
                  const firstCell = cells[0].textContent.trim();
                  const secondCell = cells[1].textContent.trim();
                  const thirdCell = cells[2].textContent.trim();
                  const fourthCell = cells[3] ? cells[3].textContent.trim() : "";
                  const fifthCell = cells[4] ? cells[4].textContent.trim() : "";

                  const isNumber = /^\d+$/.test(firstCell);
                  const isDescription = secondCell.length > 10;
                  const isCount = cellIndex === 2 && /^\d+$/.test(thirdCell);
                  const isPrice = fourthCell.includes(",") && fourthCell.includes(".");
                  const isSum = fifthCell.includes(",") && fifthCell.includes(".");

                  if (isNumber && isDescription && isCount) {
                    console.log(`\n✅ НАЙДЕНА ТАБЛИЦА С КОЛИЧЕСТВОМ!`);
                    console.log(`   Номер: "${firstCell}"`);
                    console.log(`   Описание: "${secondCell.substring(0, 50)}..."`);
                    console.log(`   Количество (колонка 3): "${thirdCell}"`);
                    if (fourthCell) console.log(`   Цена (колонка 4): "${fourthCell}"`);
                    if (fifthCell) console.log(`   Сумма (колонка 5): "${fifthCell}"`);

                    tableInfo.hasQuantity = true;
                    tableInfo.quantityValue = thirdCell;
                    tableInfo.quantityPosition = { row: rowIndex + 1, col: cellIndex + 1 };

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
                    tableInfo.selector = `${tableSelector} > tbody > tr:nth-child(${rowIndex + 1}) > td:nth-child(${cellIndex + 1})`;

                    results.tablesWithQuantity.push({
                      tableIndex: tableIndex + 1,
                      tableId: table.id || "",
                      tableSelector: tableSelector,
                      fullSelector: tableInfo.selector,
                      rowIndex: rowIndex + 1,
                      colIndex: cellIndex + 1,
                      value: thirdCell,
                      description: secondCell,
                      number: firstCell,
                    });
                  }
                }
              }
            }
          });
        });

        results.tableStructure.push(tableInfo);
      });

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    if (result.tablesWithQuantity.length > 0) {
      console.log(`\n✅ Найдено таблиц с количеством: ${result.tablesWithQuantity.length}\n`);

      result.tablesWithQuantity.forEach((table, index) => {
        console.log(`\n${"─".repeat(80)}`);
        console.log(`🎯 Таблица #${index + 1}`);
        console.log(`${"─".repeat(80)}`);
        console.log(`Таблица в документе: #${table.tableIndex}`);
        console.log(`ID таблицы: ${table.tableId || "(нет)"}`);
        console.log(`Селектор таблицы: ${table.tableSelector}`);
        console.log(`Полный селектор ячейки с количеством:`);
        console.log(`   ${table.fullSelector}`);
        console.log(`\nДанные:`);
        console.log(`  Номер: ${table.number}`);
        console.log(`  Описание: ${table.description.substring(0, 60)}...`);
        console.log(`  Количество: ${table.value}`);
        console.log(`  Позиция: строка ${table.rowIndex}, колонка ${table.colIndex}`);
      });

      console.log(`\n\n${"=".repeat(80)}`);
      console.log("💡 РЕКОМЕНДАЦИЯ");
      console.log(`${"=".repeat(80)}`);
      console.log(`\nДля получения количества используйте селектор:`);
      console.log(`\n${result.tablesWithQuantity[0].fullSelector}`);
      console.log(`\nИли общий селектор для таблицы:`);
      console.log(`\n${result.tablesWithQuantity[0].tableSelector} > tbody > tr > td:nth-child(3)`);

    } else {
      console.log(`\n❌ Таблицы с количеством не найдены.`);
      console.log(`\nВозможные причины:`);
      console.log(`1. Количество находится в другой структуре (не в таблице)`);
      console.log(`2. Количество содержит не только число (напр., "2 шт.")`);
      console.log(`3. Таблица генерируется динамически`);
    }

    // Выводим структуру всех таблиц
    console.log(`\n\n${"=".repeat(80)}`);
    console.log("📋 СТРУКТУРА ВСЕХ ТАБЛИЦ");
    console.log(`${"=".repeat(80)}\n`);

    result.tableStructure.forEach((tableInfo, index) => {
      console.log(`\n--- Таблица #${tableInfo.index} ---`);
      console.log(`ID: ${tableInfo.id || "(нет)"}`);
      console.log(`Класс: ${tableInfo.className || "(нет)"}`);
      console.log(`Строк: ${tableInfo.rowCount}`);
      console.log(`Заголовки: ${tableInfo.headers.join(" | ")}`);
      console.log(`Есть заголовок количества: ${tableInfo.hasQuantityHeader ? "✅ Да" : "❌ Нет"}`);
      if (tableInfo.hasQuantity) {
        console.log(`Количество найдено: "${tableInfo.quantityValue}" (строка ${tableInfo.quantityPosition.row}, колонка ${tableInfo.quantityPosition.col})`);
      }
    });

  } catch (error) {
    console.error("❌ Ошибка при поиске:", error);
  } finally {
    if (browser) {
      console.log("\n⏸️ Браузер остаётся открытым для визуального осмотра");
      console.log("Нажмите Ctrl+C для завершения");
    }
  }
}

// Запуск скрипта
findTableWithQuantity2().catch(console.error);
