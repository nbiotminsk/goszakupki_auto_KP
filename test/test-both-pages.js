const puppeteer = require("puppeteer");
const GoszakupkiParser = require("../parser");

async function testBothPages() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для тестирования обеих страниц...");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const parser = new GoszakupkiParser(browser);

    const pages = [
      {
        name: "Marketing",
        url: "https://goszakupki.by/marketing/view/3030091",
        expected: "1 ед.",
      },
      {
        name: "Single-source",
        url: "https://goszakupki.by/single-source/view/3028316",
        expected: "22 ед.",
      },
    ];

    console.log("\n" + "=".repeat(80));
    console.log("📄 ПАРСИНГ ОБЕИХ СТРАНИЦ");
    console.log("=".repeat(80));

    const results = [];

    for (const page of pages) {
      console.log(`\n--- ${page.name} (${page.url}) ---`);

      try {
        const data = await parser.parsePage(page.url);

        console.log(`✅ Парсинг завершен`);
        console.log(`   Описание: ${data.LOT_DESCRIPTION.substring(0, 50)}...`);
        console.log(`   📦 Количество: "${data.LOT_COUNT}"`);
        console.log(`   Ожидалось: "${page.expected}"`);

        const isCorrect = data.LOT_COUNT === page.expected;

        results.push({
          name: page.name,
          url: page.url,
          actual: data.LOT_COUNT,
          expected: page.expected,
          isCorrect: isCorrect,
          description: data.LOT_DESCRIPTION,
          unp: data.UNP,
        });

        if (isCorrect) {
          console.log(`   ✅ Количество верное!`);
        } else {
          console.log(`   ❌ Количество НЕВЕРНОЕ!`);
          console.log(`   💡 Разница: "${data.LOT_COUNT}" != "${page.expected}"`);
        }
      } catch (error) {
        console.error(`   ❌ Ошибка при парсинге:`, error.message);

        results.push({
          name: page.name,
          url: page.url,
          actual: "ERROR",
          expected: page.expected,
          isCorrect: false,
          error: error.message,
        });
      }
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    results.forEach((result, index) => {
      console.log(`\n${"─".repeat(80)}`);
      console.log(`${index + 1}. ${result.name}`);
      console.log(`${"─".repeat(80)}`);
      console.log(`URL: ${result.url}`);
      console.log(`УНП: ${result.unp || "не найден"}`);
      console.log(`Описание: ${result.description || "не найдено"}`);

      if (result.error) {
        console.log(`\n❌ Ошибка: ${result.error}`);
      } else {
        console.log(`\nКоличество:`);
        console.log(`  Получено: "${result.actual}"`);
        console.log(`  Ожидалось: "${result.expected}"`);
        console.log(`  Результат: ${result.isCorrect ? "✅ ВЕРНО" : "❌ НЕВЕРНО"}`);
      }
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📈 СТАТИСТИКА");
    console.log("=".repeat(80));

    const correctCount = results.filter((r) => r.isCorrect).length;
    const totalCount = results.length;

    console.log(`\nВсего тестов: ${totalCount}`);
    console.log(`Успешных: ${correctCount}`);
    console.log(`Ошибок: ${totalCount - correctCount}`);
    console.log(`Успешность: ${((correctCount / totalCount) * 100).toFixed(1)}%`);

    if (correctCount === totalCount) {
      console.log(`\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!`);
    } else {
      console.log(`\n⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ`);
    }

    console.log("\n" + "=".repeat(80));

  } catch (error) {
    console.error("\n❌ Критическая ошибка:", error);
  } finally {
    if (browser) {
      console.log("\n🔄 Закрытие браузера...");
      await browser.close();
      console.log("✅ Браузер закрыт");
    }

    console.log("\n🏁 Тест завершен");
  }
}

// Запуск теста
testBothPages().catch(console.error);
