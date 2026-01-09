const puppeteer = require("puppeteer");

async function analyzePageStructure() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для анализа структуры страницы...");

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
    console.log("🔍 АНАЛИЗ СТРУКТУРЫ СТРАНИЦЫ");
    console.log("=".repeat(80));

    const analysis = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        title: document.title,
        tables: [],
        allTds: [],
        lotRows: [],
      };

      // Анализируем все таблицы на странице
      const tables = Array.from(document.querySelectorAll("table"));
      console.log(`\n📊 Найдено таблиц: ${tables.length}\n`);

      tables.forEach((table, tableIndex) => {
        console.log(`\n--- Таблица #${tableIndex + 1} ---`);

        const tableInfo = {
          index: tableIndex + 1,
          rowHeaders: [],
          rowCount: 0,
          columnCount: 0,
          preview: [],
          selector: "",
          rows: [],
        };

        const rows = Array.from(table.querySelectorAll("tr"));
        tableInfo.rowCount = rows.length;

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td, th"));
          if (cells.length > tableInfo.columnCount) {
            tableInfo.columnCount = cells.length;
          }

          const rowData = cells.map((cell, cellIndex) => {
            return {
              index: cellIndex,
              tag: cell.tagName,
              text: cell.textContent.trim().substring(0, 50),
              className: cell.className,
              fullText: cell.textContent.trim(),
            };
          });

          tableInfo.rows.push(rowData);

          // Если это первая строка, сохраняем заголовки
          if (rowIndex === 0) {
            tableInfo.rowHeaders = cells.map(cell => cell.textContent.trim());
            console.log("Заголовки:", tableInfo.rowHeaders.join(" | "));
          }

          // Показываем первые 3 строки каждой таблицы
          if (rowIndex < 3) {
            const rowPreview = cells.map(cell =>
              `[${cell.tagName}] ${cell.textContent.trim().substring(0, 30)}`
            ).join(" | ");
            tableInfo.preview.push(rowPreview);
            console.log(`Строка ${rowIndex + 1}:`, rowPreview);
          }
        });

        // Пытаемся найти CSS селектор для таблицы
        if (table.id) {
          tableInfo.selector = `#${table.id}`;
        } else {
          const parent = table.closest("div");
          if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(table) + 1;
            tableInfo.selector = `div:nth-of-type(${index}) table`;
          }
        }

        results.tables.push(tableInfo);
      });

      // Ищем строки с информацией о лотах
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ПОИСК СТРОК С ИНФОРМАЦИЕЙ О ЛОТАХ");
      console.log("=".repeat(80));

      // Ищем строки, содержащие цифры и описание
      const allRows = Array.from(document.querySelectorAll("tr"));
      allRows.forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll("td"));

        if (cells.length >= 3) {
          // Проверяем, может ли это быть строка с лотом
          const cellTexts = cells.map(cell => cell.textContent.trim());

          // Если первая ячейка содержит номер (например, "1")
          const firstCellText = cellTexts[0];
          const isNumber = /^\d+$/.test(firstCellText);

          // Если вторая ячейка содержит описание
          const secondCellText = cellTexts[1];
          const isDescription = secondCellText.length > 10;

          // Если третья ячейка содержит количество (цифра)
          const thirdCellText = cellTexts[2];
          const isCount = /^\d+$/.test(thirdCellText);

          if (isNumber && isDescription && isCount) {
            console.log(`\n--- Найдена строка с лотом #${index + 1} ---`);
            console.log(`Номер: "${firstCellText}"`);
            console.log(`Описание: "${secondCellText.substring(0, 80)}..."`);
            console.log(`Количество: "${thirdCellText}"`);

            if (cells[3]) {
              console.log(`Цена: "${cellTexts[3]}"`);
            }
            if (cells[4]) {
              console.log(`Сумма: "${cellTexts[4]}"`);
            }

            // Сохраняем информацию о строке
            results.lotRows.push({
              rowIndex: index + 1,
              number: firstCellText,
              description: secondCellText,
              count: thirdCellText,
              price: cellTexts[3] || "",
              sum: cellTexts[4] || "",
              cells: cellTexts,
            });
          }
        }
      });

      // Анализируем все ячейки с классом, содержащим "count"
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ПОИСК ЯЧЕЕК С КЛАССОМ 'COUNT'");
      console.log("=".repeat(80));

      const countTds = Array.from(document.querySelectorAll("td[class*='count']"));
      console.log(`\nНайдено ячеек с классом 'count': ${countTds.length}`);

      countTds.forEach((td, index) => {
        console.log(`\nЯчейка #${index + 1}:`);
        console.log(`  Класс: "${td.className}"`);
        console.log(`  Текст: "${td.textContent.trim()}"`);

        // Пытаемся найти родительскую таблицу
        const table = td.closest("table");
        if (table) {
          const rows = Array.from(table.querySelectorAll("tr"));
          const parentRow = td.closest("tr");
          if (parentRow) {
            const rowIndex = rows.indexOf(parentRow);
            console.log(`  Таблица: ${rows.length} строк, позиция строки: ${rowIndex + 1}`);
          }
        }
      });

      // Ищем ячейки, содержащие только цифры (возможное количество)
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ПОИСК ЯЧЕЕК, СОДЕРЖАЩИХ ТОЛЬКО ЦИФРЫ");
      console.log("=".repeat(80));

      const numberTds = Array.from(document.querySelectorAll("td")).filter(td => {
        const text = td.textContent.trim();
        return /^\d+$/.test(text) && parseInt(text) < 10000; // Исключаем слишком большие числа
      });

      console.log(`\nНайдено ячеек с только цифрами: ${numberTds.length}`);

      numberTds.forEach((td, index) => {
        if (index < 10) { // Показываем только первые 10
          console.log(`\nЯчейка #${index + 1}:`);
          console.log(`  Текст: "${td.textContent.trim()}"`);
          console.log(`  Класс: "${td.className}"`);

          // Ищем соседние ячейки для контекста
          const row = td.closest("tr");
          if (row) {
            const cells = Array.from(row.querySelectorAll("td"));
            const cellIndex = cells.indexOf(td);
            console.log(`  Позиция в строке: ${cellIndex + 1} из ${cells.length}`);

            // Показываем соседние ячейки
            if (cellIndex > 0) {
              console.log(`  Предыдущая ячейка: "${cells[cellIndex - 1].textContent.trim().substring(0, 30)}"`);
            }
            if (cellIndex < cells.length - 1) {
              console.log(`  Следующая ячейка: "${cells[cellIndex + 1].textContent.trim().substring(0, 30)}"`);
            }
          }
        }
      });

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ АНАЛИЗА");
    console.log("=".repeat(80));
    console.log(`URL: ${analysis.url}`);
    console.log(`Найдено таблиц: ${analysis.tables.length}`);
    console.log(`Найдено строк с лотами: ${analysis.lotRows.length}`);

    if (analysis.lotRows.length > 0) {
      console.log("\n📦 СТРОКИ С ЛОТАМИ:");
      analysis.lotRows.forEach((lot, index) => {
        console.log(`\nЛот #${index + 1}:`);
        console.log(`  Номер: ${lot.number}`);
        console.log(`  Количество: ${lot.count}`);
        console.log(`  Описание: ${lot.description.substring(0, 60)}...`);
      });
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("💡 РЕКОМЕНДАЦИИ ПО CSS СЕЛЕКТОРАМ");
    console.log("=".repeat(80));

    if (analysis.lotRows.length > 0) {
      console.log("\nДля маркетинговой страницы используйте следующие селекторы:");
      console.log("1. Для количества:");
      console.log(`   - Поиск по позиции в строке: table tr td:nth-child(3)`);
      console.log(`   - Более точный селектор будет определен после анализа DOM`);

      console.log("\n2. Для описания:");
      console.log(`   - table tr td:nth-child(2)`);

      console.log("\n3. Полная строка с лотом:");
      const lotRow = analysis.lotRows[0];
      console.log(`   - Строка содержит ${lotRow.cells.length} ячеек`);
    }

  } catch (error) {
    console.error("❌ Ошибка при анализе страницы:", error);
  } finally {
    if (browser) {
      console.log("\n⏸️ Браузер остаётся открытым для визуального осмотра");
      console.log("Нажмите Ctrl+C для завершения");

      // Оставляем браузер открытым для осмотра
      // await browser.close();
    }
  }
}

// Запуск анализа
analyzePageStructure().catch(console.error);
