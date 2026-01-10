/**
 * Тест скрипт для проверки сетевой стабильности и улучшений парсера
 * Проверяет соединение с goszakupki.by и эффективность блокировки ресурсов
 */

const puppeteer = require("puppeteer");
const { performance } = require("perf_hooks");

// Конфигурация тестов
const TEST_URL = "https://goszakupki.by/limited/view/3028907";
const TIMEOUT_SECONDS = 120; // 2 минуты

// Цвета для вывода в консоль
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status) {
  const icon = status ? "✅" : "❌";
  const color = status ? "green" : "red";
  log(`${icon} ${testName}`, color);
}

async function runTests() {
  log("🧪 Начало тестирования сетевых улучшений...", "cyan");
  log(`📊 Тестируемый URL: ${TEST_URL}`, "blue");
  log(`⏱️  Максимальное время ожидания: ${TIMEOUT_SECONDS} секунд`, "blue");
  log("", "reset");

  let browser = null;
  const results = [];

  try {
    // Тест 1: Запуск браузера с улучшенными параметрами
    log("🔧 Тест 1: Запуск браузера с улучшенными параметрами", "yellow");
    const browserStartTime = performance.now();

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-blink-features=AutomationControlled",
        "--disable-sync",
        "--dns-prefetch-disable",
        "--proxy-server='direct://'",
        "--no-proxy-server",
      ],
    });

    const browserLaunchTime = (performance.now() - browserStartTime).toFixed(2);
    logTest(
      `Браузер запущен за ${browserLaunchTime}мс`,
      browserLaunchTime < 10000,
    );
    results.push(browserLaunchTime < 10000);

    const page = await browser.newPage();

    // Настройка таймаутов
    page.setDefaultTimeout(TIMEOUT_SECONDS * 1000);
    page.setDefaultNavigationTimeout(TIMEOUT_SECONDS * 1000);

    // Тест 2: Блокировка ресурсов
    log("🚫 Тест 2: Блокировка тяжелых ресурсов", "yellow");
    let blockedResources = 0;
    let allowedResources = 0;

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      const allowedTypes = [
        "document",
        "script",
        "xhr",
        "fetch",
        "stylesheet",
        "websocket",
        "font",
      ];

      if (allowedTypes.includes(resourceType)) {
        allowedResources++;
        request.continue();
      } else {
        blockedResources++;
        request.abort();
      }
    });

    // Тест 3: Установка User Agent
    log("🤖 Тест 3: Установка User Agent", "yellow");
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.setExtraHTTPHeaders({
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    logTest("User Agent установлен", true);
    results.push(true);

    // Тест 4: Проверка сетевого соединения
    log("🌐 Тест 4: Проверка сетевого соединения", "yellow");
    try {
      const urlObj = new URL(TEST_URL);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      const networkCheck = await page.evaluate(async (testUrl) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(testUrl, {
            method: "HEAD",
            signal: controller.signal,
            cache: "no-cache",
          });

          clearTimeout(timeoutId);
          return { status: response.status, ok: response.ok };
        } catch (error) {
          return { error: error.message };
        }
      }, baseUrl);

      logTest("Сетевое соединение установлено", !networkCheck.error);
      results.push(!networkCheck.error);
    } catch (error) {
      logTest(`Ошибка проверки сети: ${error.message}`, false);
      results.push(false);
    }

    // Тест 5: Загрузка страницы
    log("📄 Тест 5: Загрузка страницы", "yellow");
    const pageLoadStartTime = performance.now();

    const response = await page.goto(TEST_URL, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: TIMEOUT_SECONDS * 1000,
      referer: "https://goszakupki.by/",
    });

    const pageLoadTime = (performance.now() - pageLoadStartTime).toFixed(2);

    if (response && response.ok()) {
      logTest(`Страница загружена за ${pageLoadTime}мс`, pageLoadTime < 10000);
      results.push(pageLoadTime < 10000);
      log(`   📊 Статус ответа: ${response.status()}`, "blue");
    } else {
      logTest(`Не удалось загрузить страницу`, false);
      results.push(false);
    }

    // Тест 6: Проверка блокировки ресурсов
    log("📊 Тест 6: Статистика блокировки ресурсов", "yellow");
    log(
      `   ✅ Разрешено ресурсов: ${allowedResources}`,
      allowedResources > 0 ? "green" : "red",
    );
    log(
      `   🚫 Заблокировано ресурсов: ${blockedResources}`,
      blockedResources > 0 ? "green" : "red",
    );
    logTest(
      "Ресурсы эффективно блокируются",
      blockedResources > allowedResources,
    );
    results.push(blockedResources > allowedResources);

    // Тест 7: Проверка содержимого страницы
    log("🔍 Тест 7: Проверка содержимого страницы", "yellow");
    try {
      const pageTitle = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText);
      const hasContent = bodyText.length > 100;

      logTest(
        `Заголовок страницы получен: "${pageTitle.substring(0, 50)}..."`,
        true,
      );
      logTest(
        `Содержимое страницы загружено (${bodyText.length} символов)`,
        hasContent,
      );
      results.push(true);
      results.push(hasContent);
    } catch (error) {
      logTest(`Ошибка получения содержимого: ${error.message}`, false);
      results.push(false);
      results.push(false);
    }
  } catch (error) {
    log(`❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, "red");
    log(error.stack, "red");
    results.push(false);
  } finally {
    if (browser) {
      await browser.close();
      log("🌐 Браузер закрыт", "cyan");
    }
  }

  // Итоговые результаты
  log("", "reset");
  log("📋 ИТОГОВЫЕ РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ", "cyan");
  log("=".repeat(50), "cyan");

  const passedTests = results.filter(Boolean).length;
  const totalTests = results.length;
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);

  log(`✅ Успешно: ${passedTests}/${totalTests} (${successRate}%)`, "green");
  log(`❌ Провалено: ${totalTests - passedTests}/${totalTests}`, "red");

  if (successRate >= 80) {
    log("", "reset");
    log(
      "🎉 Тестирование пройдено успешно! Сетевые улучшения работают.",
      "green",
    );
    log("💡 Рекомендации:", "yellow");
    log("   - Система готова к производственному использованию", "green");
    log("   - Мониторьте логи для выявления аномальных задержек", "green");
    log(
      "   - При частых ошибках увеличьте таймауты или добавьте больше попыток",
      "yellow",
    );
  } else {
    log("", "reset");
    log("⚠️ Тестирование не пройдено. Требуется доработка.", "yellow");
    log("💡 Рекомендации:", "yellow");
    log("   - Проверьте сетевое подключение", "red");
    log("   - Убедитесь, что goszakupki.by доступен", "red");
    log("   - Рассмотрите увеличение таймаутов", "red");
  }

  process.exit(successRate >= 80 ? 0 : 1);
}

// Запуск тестов
runTests().catch((error) => {
  log(`💥 Необработанная ошибка: ${error.message}`, "red");
  log(error.stack, "red");
  process.exit(1);
});
