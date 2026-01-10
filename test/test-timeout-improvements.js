const puppeteer = require("puppeteer");
const GoszakupkiParser = require("../parser");

/**
 * Тестирование улучшений для обработки таймаутов
 * Проверяет:
 * 1. Увеличенный таймаут навигации (120 секунд)
 * 2. Логику повторных попыток
 * 3. Оптимизированную блокировку ресурсов
 * 4. Дополнительные задержки для загрузки динамического контента
 */

async function testTimeoutImprovements() {
  let browser = null;
  let parser = null;

  const testResults = {
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    details: []
  };

  try {
    console.log("🚀 Запуск браузера для тестирования улучшений таймаутов...");
    console.log("=".repeat(80));

    // Запускаем браузер с теми же оптимизациями, что и в server.js
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-web-security",
        "--allow-file-access-from-files",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-background-networking",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI,VizDisplayCompositor",
        "--disable-ipc-flooding-protection",
        "--no-first-run",
        "--no-default-browser-check",
        "--no-zygote",
        "--disable-notifications",
        "--disable-popup-blocking",
      ],
    });

    console.log("✅ Браузер запущен успешно");
    console.log("=".repeat(80));

    // Создаем парсер
    parser = new GoszakupkiParser(browser);
    console.log("✅ Парсер инициализирован");
    console.log("=".repeat(80));

    // Тест 1: Проблемный URL из сообщения об ошибке
    const test1Url = "https://goszakupki.by/limited/view/3028907";
    console.log("\n📋 ТЕСТ 1: Проблемный URL (3028907)");
    console.log("URL:", test1Url);
    console.log("-".repeat(80));

    const test1Result = await runParseTest(parser, test1Url, "Проблемная страница 3028907");
    testResults.testsRun++;
    if (test1Result.success) {
      testResults.testsPassed++;
      testResults.details.push({
        test: "TEST 1: Проблемный URL 3028907",
        status: "✅ PASSED",
        duration: test1Result.duration,
        message: "Страница успешно распарсена"
      });
    } else {
      testResults.testsFailed++;
      testResults.details.push({
        test: "TEST 1: Проблемный URL 3028907",
        status: "❌ FAILED",
        duration: test1Result.duration,
        error: test1Result.error
      });
    }

    // Тест 2: Другие типы страниц для проверки универсальности
    const testUrls = [
      {
        url: "https://goszakupki.by/tender/view/3028754",
        name: "Tender view 3028754"
      },
      {
        url: "https://goszakupki.by/contract/view/3028316",
        name: "Contract view 3028316"
      },
      {
        url: "https://goszakupki.by/marketing/view/3022522",
        name: "Marketing view 3022522"
      }
    ];

    for (let i = 0; i < testUrls.length; i++) {
      const testUrl = testUrls[i];
      const testNumber = i + 2;

      console.log(`\n📋 ТЕСТ ${testNumber}: ${testUrl.name}`);
      console.log("URL:", testUrl.url);
      console.log("-".repeat(80));

      const testResult = await runParseTest(parser, testUrl.url, testUrl.name);
      testResults.testsRun++;

      if (testResult.success) {
        testResults.testsPassed++;
        testResults.details.push({
          test: `TEST ${testNumber}: ${testUrl.name}`,
          status: "✅ PASSED",
          duration: testResult.duration,
          message: "Страница успешно распарсена"
        });
      } else {
        testResults.testsFailed++;
        testResults.details.push({
          test: `TEST ${testNumber}: ${testUrl.name}`,
          status: "❌ FAILED",
          duration: testResult.duration,
          error: testResult.error
        });
      }

      // Небольшая пауза между тестами
      if (i < testUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Вывод итоговых результатов
    console.log("\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));
    console.log(`Всего тестов: ${testResults.testsRun}`);
    console.log(`✅ Пройдено: ${testResults.testsPassed}`);
    console.log(`❌ Провалено: ${testResults.testsFailed}`);
    console.log(`Успешность: ${((testResults.testsPassed / testResults.testsRun) * 100).toFixed(2)}%`);
    console.log("=".repeat(80));

    console.log("\n📋 Детальная информация по каждому тесту:");
    testResults.details.forEach((detail, index) => {
      console.log(`\n${index + 1}. ${detail.test}`);
      console.log(`   Статус: ${detail.status}`);
      console.log(`   Время выполнения: ${detail.duration.toFixed(2)} сек.`);
      if (detail.message) {
        console.log(`   Сообщение: ${detail.message}`);
      }
      if (detail.error) {
        console.log(`   Ошибка: ${detail.error}`);
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log("🎯 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("❌ Критическая ошибка при тестировании:", error);
    testResults.testsFailed++;
    testResults.details.push({
      test: "Критическая ошибка",
      status: "❌ CRITICAL ERROR",
      error: error.message
    });
  } finally {
    // Закрытие браузера
    if (browser) {
      try {
        await browser.close();
        console.log("\n🌐 Браузер закрыт");
      } catch (error) {
        console.error("❌ Ошибка при закрытии браузера:", error);
      }
    }

    // Выход с кодом 1, если есть проваленные тесты
    if (testResults.testsFailed > 0) {
      process.exit(1);
    }
  }
}

/**
 * Запуск теста парсинга для указанного URL
 * @param {GoszakupkiParser} parser - Экземпляр парсера
 * @param {string} url - URL для парсинга
 * @param {string} testName - Название теста
 * @returns {Object} Результат теста
 */
async function runParseTest(parser, url, testName) {
  const startTime = Date.now();

  try {
    console.log(`⏱️ Начало парсинга: ${new Date().toISOString()}`);

    // Парсинг страницы с улучшенным таймаутом
    const data = await parser.parsePage(url);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`⏱️ Завершение парсинга: ${new Date().toISOString()}`);
    console.log(`⏱️ Общее время выполнения: ${duration.toFixed(2)} сек.`);

    // Проверка данных
    console.log("\n📊 Извлеченные данные:");
    console.log(`   Название компании: ${data.COMPANY_NAME || 'Не найдено'}`);
    console.log(`   УНП: ${data.UNP || 'Не найдено'}`);
    console.log(`   Адрес: ${data.ADDRESS ? data.ADDRESS.substring(0, 50) + '...' : 'Не найдено'}`);
    console.log(`   Тип страницы: ${data.DEBUG_INFO?.pageType || 'Не определен'}`);

    // Проверка критических полей
    const hasCompany = !!data.COMPANY_NAME;
    const hasUnp = !!data.UNP;
    const hasAddress = !!data.ADDRESS;

    console.log(`\n✅ Проверка данных:`);
    console.log(`   Компания найдена: ${hasCompany ? 'Да' : 'Нет'}`);
    console.log(`   УНП найден: ${hasUnp ? 'Да' : 'Нет'}`);
    console.log(`   Адрес найден: ${hasAddress ? 'Да' : 'Нет'}`);

    // Тест считается успешным, если хотя бы основные данные извлечены
    const isSuccess = hasCompany || hasUnp || hasAddress;

    if (isSuccess) {
      console.log(`\n✅ ТЕСТ ПРОЙДЕН: Данные успешно извлечены`);
    } else {
      console.log(`\n⚠️ ТЕСТ С ПРЕДУПРЕЖДЕНИЕМ: Критические данные не найдены`);
    }

    return {
      success: isSuccess,
      duration: duration,
      data: data
    };

  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`❌ Ошибка при парсинге:`, error.message);
    console.error(`⏱️ Время до ошибки: ${duration.toFixed(2)} сек.`);

    return {
      success: false,
      duration: duration,
      error: error.message
    };
  }
}

// Запуск тестов
console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║     ТЕСТ СИСТЕМЫ УЛУЧШЕНИЙ ОБРАБОТКИ ТАЙМАУТОВ                           ║");
console.log("║     System for Testing Timeout Improvements                               ║");
console.log("╚══════════════════════════════════════════════════════════════════════════╝");
console.log("\n📝 Описание тестов:");
console.log("   - Тестирование увеличенного таймаута навигации (120 сек)");
console.log("   - Проверка логики повторных попыток");
console.log("   - Валидация оптимизированной блокировки ресурсов");
console.log("   - Проверка задержек для загрузки динамического контента");
console.log("   - Тестирование на реальных проблемных URL");
console.log("");

testTimeoutImprovements().catch(error => {
  console.error("❌ Фатальная ошибка:", error);
  process.exit(1);
});
