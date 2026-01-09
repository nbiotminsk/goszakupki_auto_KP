const puppeteer = require("puppeteer");

async function checkSingleSourcePage() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для проверки single-source страницы...");

    browser = await puppeteer.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const page = await browser.newPage();
    const testUrl = "https://goszakupki.by/single-source/view/3028316";

    console.log(`📄 Загрузка страницы: ${testUrl}`);
    await page.goto(testUrl, { waitUntil: "networkidle2", timeout: 30000 });

    console.log("✅ Страница загружена");
    console.log("\n" + "=".repeat(80));
    console.log("🔍 ПРОВЕРКА ИЗВЛЕЧЕНИЯ КОЛИЧЕСТВА");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const selector = "#lotsList > tbody > tr.lot-row > td.lot-count-price";
      const results = {
        selector: selector,
        elementExists: false,
        elementContent: null,
        elementHTML: null,
        extractedValue: null,
        analysis: [],
      };

      console.log(`\n📍 Проверка селектора: "${selector}"`);

      // Проверяем элемент
      const lotCountElement = document.querySelector(selector);

      if (lotCountElement) {
        results.elementExists = true;
        results.elementContent = lotCountElement.textContent.trim();
        results.elementHTML = lotCountElement.innerHTML;

        console.log(`✅ Элемент найден`);
        console.log(`   Полный текст: "${results.elementContent}"`);
        console.log(`   HTML: ${results.elementHTML.substring(0, 200)}...`);

        // Анализируем текст для извлечения количества
        const text = results.elementContent;
        console.log(`\n🔍 Анализ текста для извлечения количества:`);

        // Пробуем различные методы извлечения
        const methods = [
          {
            name: "Первая цифра (текущий метод)",
            regex: /^(\d+)/,
            result: text.match(/^(\d+)/)
          },
          {
            name: "Все числа в тексте",
            regex: /\d+/g,
            result: text.match(/\d+/g)
          },
          {
            name: "Число перед 'ед.'",
            regex: /(\d+)\s*ед/i,
            result: text.match(/(\d+)\s*ед/i)
          },
          {
            name: "Число перед 'шт'",
            regex: /(\d+)\s*шт/i,
            result: text.match(/(\d+)\s*шт/i)
          },
          {
            name: "Число до запятой",
            regex: /^(\d+),/,
            result: text.match(/^(\d+),/)
          },
          {
            name: "Число до пробела или запятой",
            regex: /^(\d+)[,\s]/,
            result: text.match(/^(\d+)[,\s]/)
          }
        ];

        methods.forEach((method, index) => {
          console.log(`\n${index + 1}. ${method.name}`);
          console.log(`   Регулярное выражение: ${method.regex.toString()}`);

          if (method.result) {
            if (Array.isArray(method.result)) {
              console.log(`   ✅ Найдено: ${method.result.join(", ")}`);

              // Если это метод с группой захвата
              if (method.result.length > 1) {
                console.log(`   Значение для извлечения: "${method.result[1]}"`);
                results.analysis.push({
                  method: method.name,
                  regex: method.regex.toString(),
                  allMatches: method.result,
                  extractedValue: method.result[1],
                  isCurrent: method.name === "Первая цифра (текущий метод)"
                });
              } else {
                console.log(`   Все совпадения: ${method.result.join(", ")}`);
                results.analysis.push({
                  method: method.name,
                  regex: method.regex.toString(),
                  allMatches: method.result,
                  extractedValue: method.result[0],
                  isCurrent: method.name === "Первая цифра (текущий метод)"
                });
              }
            } else {
              console.log(`   ✅ Найдено: ${method.result}`);
              results.analysis.push({
                method: method.name,
                regex: method.regex.toString(),
                allMatches: [method.result],
                extractedValue: method.result[1] || method.result[0],
                isCurrent: method.name === "Первая цифра (текущий метод)"
              });
            }
          } else {
            console.log(`   ❌ Не найдено`);
          }
        });

        // Текущее извлечение (как в парсере)
        const countMatch = text.match(/^(\d+)/);
        results.extractedValue = countMatch ? `${countMatch[1]} ед.` : text;

        console.log(`\n` + "=".repeat(80));
        console.log(`📊 ТЕКУЩЕЕ ИЗВЛЕЧЕНИЕ В ПАРСЕРЕ`);
        console.log("=".repeat(80));
        console.log(`Регулярное выражение: /^(\d+)/`);
        console.log(`Найдено: ${countMatch ? `"${countMatch[1]}"` : "нет"}`);
        console.log(`Результат: "${results.extractedValue}"`);

      } else {
        console.log(`❌ Элемент не найден`);

        // Ищем альтернативные элементы
        console.log(`\n` + "=".repeat(80));
        console.log(`🔍 ПОИСК АЛЬТЕРНАТИВНЫХ ЯЧЕЕК`);
        console.log("=".repeat(80));

        const lotsList = document.querySelector("#lotsList");
        if (lotsList) {
          console.log(`✅ Таблица #lotsList найдена`);

          const tbody = lotsList.querySelector("tbody");
          if (tbody) {
            const rows = Array.from(tbody.querySelectorAll("tr"));
            console.log(`Найдено строк: ${rows.length}\n`);

            rows.forEach((row, rowIndex) => {
              const cells = Array.from(row.querySelectorAll("td"));
              console.log(`--- Строка ${rowIndex + 1} (${cells.length} ячеек) ---`);

              cells.forEach((cell, cellIndex) => {
                const text = cell.textContent.trim();
                const className = cell.className;

                console.log(`  [${cellIndex + 1}] Класс: "${className || '(нет)'}"`);
                console.log(`       Текст: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

                // Проверяем, может ли это быть ячейка с количеством
                if (text.includes("22") || /22/.test(text)) {
                  console.log(`       ⚠️ СОДЕРЖИТ ЧИСЛО 22!`);
                }
              });
            });
          }
        }
      }

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    console.log(`\nСелектор: ${result.selector}`);
    console.log(`Элемент найден: ${result.elementExists ? "✅ Да" : "❌ Нет"}`);

    if (result.elementContent) {
      console.log(`\nПолное содержимое ячейки:`);
      console.log(`"${result.elementContent}"`);
      console.log(`\nТекущее извлечение в парсере:`);
      console.log(`"${result.extractedValue}"`);
    }

    if (result.analysis.length > 0) {
      console.log(`\n\n` + "=".repeat(80));
      console.log(`💡 АНАЛИЗ МЕТОДОВ ИЗВЛЕЧЕНИЯ`);
      console.log("=".repeat(80));

      result.analysis.forEach((method, index) => {
        console.log(`\n${index + 1}. ${method.method}`);
        if (method.isCurrent) {
          console.log(`   ⚠️ ТЕКУЩИЙ МЕТОД`);
        }
        console.log(`   Regex: ${method.regex}`);
        console.log(`   Найденные значения: ${method.allMatches.join(", ")}`);
        console.log(`   Извлеченное значение: "${method.extractedValue}"`);
      });
    }

    console.log(`\n\n` + "=".repeat(80));
    console.log(`💡 РЕКОМЕНДАЦИЯ`);
    console.log("=".repeat(80));

    if (result.elementContent && result.elementContent.includes("22")) {
      console.log(`\n✅ В тексте ячейки найдено число "22"`);
      console.log(`\nНеобходимо изменить регулярное выражение для корректного извлечения.`);

      // Находим лучший метод
      const bestMethod = result.analysis.find(m => m.extractedValue === "22");
      if (bestMethod) {
        console.log(`\nРекомендуемый метод: ${bestMethod.method}`);
        console.log(`Regex: ${bestMethod.regex}`);
        console.log(`Извлеченное значение: "${bestMethod.extractedValue}"`);
      }
    } else {
      console.log(`\n❌ В тексте ячейки не найдено число "22"`);
      console.log(`\nВозможные причины:`);
      console.log(`1. Число находится в другой ячейке`);
      console.log(`2. Текст содержит "22" в другом контексте (например, в цене)`);
      console.log(`3. Необходим другой селектор для получения количества`);
    }

    console.log(`\n\n` + "=".repeat(80));

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
checkSingleSourcePage().catch(console.error);
