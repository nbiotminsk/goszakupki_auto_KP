const puppeteer = require("puppeteer");

async function analyzeAll4Pages() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для анализа всех 4 страниц...");

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
        name: "Single-source (3028754)",
        url: "https://goszakupki.by/single-source/view/3028754",
        expectedQuantity: "12",
      },
      {
        name: "Single-source (3028316)",
        url: "https://goszakupki.by/single-source/view/3028316",
        expectedQuantity: "1",
      },
      {
        name: "Marketing (3025562)",
        url: "https://goszakupki.by/marketing/view/3025562",
        expectedQuantity: "12",
      },
      {
        name: "Request (3022522)",
        url: "https://goszakupki.by/request/view/3022522",
        expectedQuantity: "1",
      },
    ];

    console.log("\n" + "=".repeat(80));
    console.log("🔍 АНАЛИЗ ВСЕХ ЧЕТЫРЁХ СТРАНИЦ");
    console.log("=".repeat(80));

    const results = [];

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
        console.log(`   Ожидаемое количество: "${page.expectedQuantity}"`);

        // Анализируем формат
        const text = result.textContent;
        const unitMatch = text.match(/(\d+)\s*\(/);
        const numbers = text.match(/\d+/g);

        let analysis = {
          format: "неизвестно",
          quantity: null,
          rule: "",
        };

        if (unitMatch) {
          // Формат: "X (ед.), цена BYN"
          analysis.format = "число перед скобкой";
          analysis.quantity = unitMatch[1];
          analysis.rule = `Число перед скобкой = ${unitMatch[1]}`;
        } else if (numbers && numbers.length > 0) {
          analysis.format = "простой формат";
          analysis.quantity = numbers[0];
          analysis.rule = `Первое число = ${numbers[0]}`;
        }

        const isCorrect = analysis.quantity === page.expectedQuantity;

        console.log(`   Формат: ${analysis.format}`);
        console.log(`   Правило: ${analysis.rule}`);
        console.log(`   Извлеченное количество: "${analysis.quantity}"`);
        console.log(`   Результат: ${isCorrect ? "✅ ВЕРНО" : "❌ НЕВЕРНО"}`);

        results.push({
          name: page.name,
          url: page.url,
          text: result.textContent,
          allNumbers: result.allNumbers,
          expectedQuantity: page.expectedQuantity,
          extractedQuantity: analysis.quantity,
          isCorrect: isCorrect,
          format: analysis.format,
          rule: analysis.rule,
        });

        await testPage.close();

      } catch (error) {
        console.error(`   ❌ Ошибка при проверке:`, error.message);
        results.push({
          name: page.name,
          url: page.url,
          text: "ERROR",
          error: error.message,
        });
      }
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 СВОДНАЯ ТАБЛИЦА");
    console.log("=".repeat(80));

    console.log(
      `\n${"№".padEnd(4)} ${"Страница".padEnd(30)} ${"Текст".padEnd(50)} ${"Ожидалось".padEnd(12)} ${"Извлечено".padEnd(12)} ${"Результат"}`,
    );
    console.log(
      `${"─".repeat(4)} ${"─".repeat(30)} ${"─".repeat(50)} ${"─".repeat(12)} ${"─".repeat(12)} ${"─".repeat(9)}`,
    );

    results.forEach((result, index) => {
      const textShort = result.text ? result.text.substring(0, 48) + "..." : "ERROR";
      console.log(
        `${(index + 1).toString().padEnd(4)} ${result.name.padEnd(30)} ${textShort.padEnd(50)} ${
          result.expectedQuantity.padEnd(12)
        } ${result.extractedQuantity.padEnd(12)} ${result.isCorrect ? "✅" : "❌"}`,
      );
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("💡 АНАЛИЗ ФОРМАТОВ");
    console.log("=".repeat(80));

    const correctResults = results.filter(r => r.isCorrect);
    const incorrectResults = results.filter(r => !r.isCorrect);

    console.log(`\n✅ ВЕРНЫЕ результаты (${correctResults.length}):`);
    correctResults.forEach(r => {
      console.log(`   ${r.name}`);
      console.log(`      Текст: "${r.text}"`);
      console.log(`      Формат: ${r.format}`);
      console.log(`      Правило: ${r.rule}`);
      console.log(`      Количество: ${r.extractedQuantity}`);
    });

    if (incorrectResults.length > 0) {
      console.log(`\n❌ НЕВЕРНЫЕ результаты (${incorrectResults.length}):`);
      incorrectResults.forEach(r => {
        console.log(`   ${r.name}`);
        console.log(`      Текст: "${r.text}"`);
        console.log(`      Ожидалось: ${r.expectedQuantity}`);
        console.log(`      Получено: ${r.extractedQuantity}`);
        console.log(`      Формат: ${r.format}`);
        console.log(`      Правило: ${r.rule}`);
      });

      console.log(`\n` + "=".repeat(80));
      console.log("🎯 ПРАВИЛА ДЛЯ ИСПРАВЛЕНИЯ");
      console.log("=".repeat(80));
      console.log(`
На основе анализа всех страниц выявлены следующие правила:

1. Если текст содержит скобку "(": число перед ней = количество
   Пример: "12 месяц(мес)" → количество = 12

2. Формат "X единица(ед.), Y ZZZ.ZZ BYN":
   - Если X = 1 и цена Y начинается с числа > 0:
     Тогда количество = X (1) для marketing/view
     Тогда количество = Y для single-source/view
   - Если X > 1:
     Тогда количество = X

3. Формат "X условная единица(усл. ед.), Y ZZZ.ZZ BYN":
   Тогда количество = X

Нужно учесть тип страницы для правильного извлечения!
      `);
    }

    const correctCount = results.filter(r => r.isCorrect).length;
    console.log(`\n` + "=".repeat(80));
    console.log(`📈 СТАТИСТИКА: ${correctCount}/${results.length} верных результатов`);
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Критическая ошибка:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Браузер закрыт");
    }

    console.log("\n🏁 Анализ завершен");
  }
}

// Запуск анализа
analyzeAll4Pages().catch(console.error);
