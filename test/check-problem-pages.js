const puppeteer = require("puppeteer");

async function checkProblemPages() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для проверки проблемных страниц...");

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const pages = [
      {
        name: "Single-source (3028316)",
        url: "https://goszakupki.by/single-source/view/3028316",
        expected: "1 ед.",
      },
      {
        name: "Request (3022522)",
        url: "https://goszakupki.by/request/view/3022522",
        expected: "1 ед.",
      },
    ];

    console.log("\n" + "=".repeat(80));
    console.log("🔍 ПРОВЕРКА ПРОБЛЕМНЫХ СТРАНИЦ");
    console.log("=".repeat(80));

    for (const page of pages) {
      console.log(`\n--- ${page.name} (${page.url}) ---`);

      try {
        const testPage = await browser.newPage();
        await testPage.goto(page.url, { waitUntil: "networkidle2", timeout: 30000 });

        const result = await testPage.evaluate(() => {
          const selector = "#lotsList > tbody > tr.lot-row > td.lot-count-price";
          const element = document.querySelector(selector);

          if (!element) {
            return {
              elementExists: false,
              textContent: null,
            };
          }

          const text = element.textContent.trim();
          const allNumbers = text.match(/\d+/g);

          return {
            elementExists: true,
            textContent: text,
            allNumbers: allNumbers,
            innerHTML: element.innerHTML,
          };
        });

        console.log(`✅ Страница загружена`);
        console.log(`   Текст ячейки: "${result.textContent}"`);
        console.log(`   Все числа: ${result.allNumbers ? result.allNumbers.join(", ") : "нет"}`);
        console.log(`   Ожидалось: "${page.expected}"`);

        // Проверяем логику извлечения
        const text = result.textContent;
        const unitMatch = text.match(/(\d+)\s*\(/);
        const numbers = text.match(/\d+/g);

        console.log(`\n   🔍 Анализ извлечения:`);

        if (unitMatch) {
          console.log(`      Найдено число перед скобкой: "${unitMatch[1]}"`);
          console.log(`      Результат извлечения: "${unitMatch[1]} ед."`);
        } else if (numbers && numbers.length > 0) {
          let quantity = numbers[0];
          const firstNum = parseInt(numbers[0]);

          if (firstNum === 1 && text.includes(" условная")) {
            quantity = numbers[0];
            console.log(`      Формат: "1 условная единица" - используем первое число: ${quantity}`);
          } else if (firstNum === 1 && text.includes("единица(ед.)")) {
            if (numbers.length > 1) {
              quantity = numbers[1];
              console.log(`      Формат: "1 единица(ед.)" - используем второе число: ${quantity}`);
            } else {
              console.log(`      Формат: "1 единица(ед.)" - но только одно число: ${quantity}`);
            }
          } else {
            console.log(`      Обычный формат - используем первое число: ${quantity}`);
          }

          console.log(`      Результат извлечения: "${quantity} ед."`);
        } else {
          console.log(`      Не найдены числа`);
        }

        await testPage.close();

      } catch (error) {
        console.error(`   ❌ Ошибка при проверке:`, error.message);
      }
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("💡 ВЫВОДЫ");
    console.log("=".repeat(80));
    console.log(`
Проанализируйте тексты ячеек на проблемных страницах и определите:
1. Какой текст содержится в ячейке
2. Какое число является количеством
3. Как изменить логику извлечения, чтобы получить правильное значение

Возможные проблемы:
- Разный формат на разных типах страниц
- Особые единицы измерения
- Несколько чисел в одной ячейке (количество и цена)
    `);
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Критическая ошибка:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Браузер закрыт");
    }
    console.log("\n🏁 Проверка завершена");
  }
}

// Запуск проверки
checkProblemPages().catch(console.error);
