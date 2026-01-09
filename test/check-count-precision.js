const puppeteer = require("puppeteer");

async function checkCountPrecision() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для точного поиска количества...");

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
    console.log("🔍 ТОЧНЫЙ ПОИСК КОЛИЧЕСТВА В ТАБЛИЦЕ");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const results = {
        lotsListInfo: null,
        lotRows: [],
        allTables: [],
      };

      // Сначала проверяем таблицу #lotsList
      const lotsList = document.querySelector("#lotsList");
      if (lotsList) {
        console.log("\n📊 Анализ таблицы #lotsList");
        console.log("=".repeat(80));

        const tbody = lotsList.querySelector("tbody");
        if (tbody) {
          const rows = Array.from(tbody.querySelectorAll("tr"));
          console.log(`Найдено строк в tbody: ${rows.length}\n`);

          rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll("td"));
            console.log(`\n--- Строка #${rowIndex + 1} (${cells.length} ячеек) ---`);

            cells.forEach((cell, cellIndex) => {
              const text = cell.textContent.trim();
              const className = cell.className;

              console.log(`  Ячейка #${cellIndex + 1}:`);
              console.log(`    Класс: "${className || '(нет)'}"`);
              console.log(`    Содержимое: "${text}"`);
              console.log(`    Длина текста: ${text.length} символов`);
              console.log(`    HTML: ${cell.innerHTML.substring(0, 100)}...`);

              // Проверяем, является ли это числом
              if (/^\d+$/.test(text) && parseInt(text) > 0 && parseInt(text) < 10000) {
                console.log(`    ⚠️ ЭТО ЧИСЛО: ${text}`);
              }

              // Сохраняем информацию о строке с лотом
              if (rowIndex > 0 && cellIndex === 0 && /^\d+$/.test(text)) {
                const lotData = {
                  rowIndex: rowIndex + 1,
                  number: text,
                  description: "",
                  count: "",
                  price: "",
                  sum: "",
                };

                if (cells[1]) lotData.description = cells[1].textContent.trim();
                if (cells[2]) lotData.count = cells[2].textContent.trim();
                if (cells[3]) lotData.price = cells[3].textContent.trim();
                if (cells[4]) lotData.sum = cells[4].textContent.trim();

                results.lotRows.push(lotData);

                console.log(`\n📦 ДАННЫЕ ЛОТА:`);
                console.log(`    Номер: "${lotData.number}"`);
                console.log(`    Описание: "${lotData.description.substring(0, 50)}..."`);
                console.log(`    Количество (ячейка 3): "${lotData.count}"`);
                console.log(`    Цена (ячейка 4): "${lotData.price}"`);
                console.log(`    Сумма (ячейка 5): "${lotData.sum}"`);
              }
            });
          });
        }
      } else {
        console.log("\n❌ Таблица #lotsList не найдена");
      }

      // Анализируем все таблицы на странице
      console.log("\n\n" + "=".repeat(80));
      console.log("📊 АНАЛИЗ ВСЕХ ТАБЛИЦ НА СТРАНИЦЕ");
      console.log("=".repeat(80));

      const tables = Array.from(document.querySelectorAll("table"));
      console.log(`\nВсего таблиц: ${tables.length}\n`);

      tables.forEach((table, tableIndex) => {
        console.log(`\n--- Таблица #${tableIndex + 1} ---`);

        const rows = Array.from(table.querySelectorAll("tr"));

        rows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td"));

          if (cells.length >= 3) {
            const firstCell = cells[0].textContent.trim();
            const secondCell = cells[1].textContent.trim();
            const thirdCell = cells[2].textContent.trim();
            const fourthCell = cells[3] ? cells[3].textContent.trim() : "";
            const fifthCell = cells[4] ? cells[4].textContent.trim() : "";

            // Проверяем, соответствует ли строка структуре таблицы с лотами
            // Первая ячейка - номер, вторая - описание, третья - количество
            if (/^\d+$/.test(firstCell) && secondCell.length > 10) {
              console.log(`\n🎯 Найдена строка с лотом в таблице #${tableIndex + 1}, строка ${rowIndex + 1}:`);
              console.log(`  Структура: ${cells.length} ячеек`);
              console.log(`  [1] Номер: "${firstCell}"`);
              console.log(`  [2] Описание: "${secondCell.substring(0, 60)}..."`);
              console.log(`  [3] Количество: "${thirdCell}"`);
              if (fourthCell) console.log(`  [4] Цена: "${fourthCell}"`);
              if (fifthCell) console.log(`  [5] Сумма: "${fifthCell}"`);

              // Детальный анализ третьей ячейки (количество)
              console.log(`\n  🔍 Детальный анализ ячейки с количеством:`);
              console.log(`     Текст: "${thirdCell}"`);
              console.log(`     Длина: ${thirdCell.length} символов`);
              console.log(`     Является ли числом: ${/^\d+$/.test(thirdCell) ? "✅ Да" : "❌ Нет"}`);
              console.log(`     Класс ячейки: "${cells[2].className}"`);
              console.log(`     HTML ячейки: ${cells[2].innerHTML}`);

              // Проверяем заголовки таблицы
              console.log(`\n  🔍 Заголовки таблицы:`);
              const headerRows = rows.filter((r, ri) => ri < rowIndex);
              headerRows.forEach((headerRow, hi) => {
                const headerCells = Array.from(headerRow.querySelectorAll("td, th"));
                const headerText = headerCells.map(c => c.textContent.trim()).join(" | ");
                console.log(`     Строка ${hi + 1}: ${headerText}`);
              });
            }
          }
        });
      });

      // Специально ищем ячейку с количеством "2"
      console.log("\n\n" + "=".repeat(80));
      console.log("🔍 ПОИСК ЯЧЕЙКИ СО ЗНАЧЕНИЕМ '2'");
      console.log("=".repeat(80));

      const allTds = Array.from(document.querySelectorAll("td"));
      const tdsWithNumber2 = allTds.filter(td => {
        const text = td.textContent.trim();
        return text === "2" || text === " 2" || text === "2 " || text === " 2 ";
      });

      console.log(`\nНайдено ячеек с текстом '2': ${tdsWithNumber2.length}`);

      tdsWithNumber2.forEach((td, index) => {
        console.log(`\n--- Ячейка #${index + 1} ---`);
        console.log(`  Текст: "${td.textContent.trim()}"`);
        console.log(`  Класс: "${td.className}"`);

        const row = td.closest("tr");
        if (row) {
          const table = row.closest("table");
          if (table) {
            const allRows = Array.from(table.querySelectorAll("tr"));
            const rowIndex = allRows.indexOf(row);
            const allCells = Array.from(row.querySelectorAll("td"));
            const cellIndex = allCells.indexOf(td);

            console.log(`  Позиция в таблице: строка ${rowIndex + 1}, ячейка ${cellIndex + 1}`);
            console.log(`  Всего строк в таблице: ${allRows.length}`);
            console.log(`  Всего ячеек в строке: ${allCells.length}`);

            // Показываем соседние ячейки
            if (cellIndex > 0) {
              console.log(`  Предыдущая ячейка: "${allCells[cellIndex - 1].textContent.trim().substring(0, 40)}..."`);
            }
            if (cellIndex < allCells.length - 1) {
              console.log(`  Следующая ячейка: "${allCells[cellIndex + 1].textContent.trim().substring(0, 40)}..."`);
            }

            // Проверяем, есть ли у таблицы id
            if (table.id) {
              console.log(`  ID таблицы: #${table.id}`);
            }
          }
        }
      });

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    if (result.lotRows.length > 0) {
      console.log(`\n📦 Найдено лотов в #lotsList: ${result.lotRows.length}`);
      result.lotRows.forEach((lot, index) => {
        console.log(`\nЛот #${index + 1}:`);
        console.log(`  Номер: ${lot.number}`);
        console.log(`  Количество: "${lot.count}"`);
        console.log(`  Описание: ${lot.description.substring(0, 50)}...`);
      });
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("💡 АНАЛИЗ ПРОБЛЕМЫ");
    console.log("=".repeat(80));

    console.log("\nЕсли количество '2' не найдено в таблице #lotsList,");
    console.log("возможно она находится в другой таблице или в другой ячейке.");
    console.log("\nРекомендации:");
    console.log("1. Проверьте, не находится ли количество в td:nth-child(3)");
    console.log("2. Проверьте другие таблицы на странице");
    console.log("3. Ищите ячейки с классом, содержащим 'count' или 'quantity'");

  } catch (error) {
    console.error("❌ Ошибка при проверке:", error);
  } finally {
    if (browser) {
      console.log("\n⏸️ Браузер остаётся открытым для визуального осмотра");
      console.log("Нажмите Ctrl+C для завершения");
    }
  }
}

// Запуск проверки
checkCountPrecision().catch(console.error);
