const puppeteer = require("puppeteer");
const GoszakupkiParser = require("../parser");

async function testMarketingPage() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для теста маркетинговой страницы...");

    browser = await puppeteer.launch({
      headless: false, // Показываем браузер для визуального контроля
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const parser = new GoszakupkiParser(browser);
    const testUrl = "https://goszakupki.by/marketing/view/3030091";

    console.log(`📄 Парсинг страницы: ${testUrl}`);
    console.log("=" .repeat(80));

    const data = await parser.parsePage(testUrl);

    console.log("=" .repeat(80));
    console.log("✅ Парсинг завершен успешно!");
    console.log("\n📊 Результаты парсинга:");
    console.log("-".repeat(80));
    console.log(`Название компании: ${data.COMPANY_NAME}`);
    console.log(`УНП: ${data.UNP}`);
    console.log(`Адрес: ${data.ADDRESS}`);
    console.log(`Место поставки: ${data.PLACE}`);
    console.log(`Условия оплаты: ${data.PAYMENT}`);
    console.log(`Дата окончания: ${data.END_DATE}`);
    console.log(`Описание лота 1: ${data.LOT_DESCRIPTION}`);
    console.log(`📦 Количество лота 1: ${data.LOT_COUNT}`);
    console.log(`Описание лота 2: ${data.LOT_DESCRIPTION_2}`);
    console.log(`📦 Количество лота 2: ${data.LOT_COUNT_2}`);
    console.log(`Дата: ${data.DATE}`);
    console.log("-".repeat(80));

    if (data.DEBUG_INFO) {
      console.log("\n🔍 Отладочная информация:");
      console.log("-".repeat(80));
      console.log(`Тип страницы: ${data.DEBUG_INFO.pageType}`);
      console.log(`Всего ячеек TD: ${data.DEBUG_INFO.allTdsCount}`);
      console.log(`Релевантных ячеек TD: ${data.DEBUG_INFO.relevantTdsCount}`);
      console.log(`Ячеек в правильной таблице: ${data.DEBUG_INFO.correctTableTdsCount}`);
      console.log(`Название компании найдено: ${data.DEBUG_INFO.companyNameFound ? '✅ Да' : '❌ Нет'} (источник: ${data.DEBUG_INFO.dataSource.companyName})`);
      console.log(`УНП найдено: ${data.DEBUG_INFO.unpFound ? '✅ Да' : '❌ Нет'} (источник: ${data.DEBUG_INFO.dataSource.unp})`);
      console.log(`Адрес найден: ${data.DEBUG_INFO.addressFound ? '✅ Да' : '❌ Нет'} (источник: ${data.DEBUG_INFO.dataSource.address})`);

      if (data.DEBUG_INFO.sampleIrrelevantTds && data.DEBUG_INFO.sampleIrrelevantTds.length > 0) {
        console.log("\nПримеры отфильтрованных ячеек:");
        data.DEBUG_INFO.sampleIrrelevantTds.forEach((sample, index) => {
          console.log(`  ${index + 1}. ${sample}`);
        });
      }
      console.log("-".repeat(80));
    }

    if (data.API_DATA) {
      console.log("\n📡 Данные из API налоговой службы:");
      console.log("-".repeat(80));
      console.log(`Полное название: ${data.API_DATA.fullName}`);
      console.log(`Краткое название: ${data.API_DATA.shortName}`);
      console.log(`Адрес: ${data.API_DATA.address}`);
      console.log(`Дата регистрации: ${data.API_DATA.registrationDate}`);
      console.log(`Статус: ${data.API_DATA.statusName}`);
      console.log("-".repeat(80));
    }

    // Проверяем результат количества
    console.log("\n🎯 Проверка поля количества:");
    console.log("-".repeat(80));
    if (data.LOT_COUNT && data.LOT_COUNT.trim() !== "") {
      console.log(`✅ Количество успешно извлечено: "${data.LOT_COUNT}"`);
    } else {
      console.log("❌ Ошибка: количество не извлечено (пустая строка)");
      console.log("💡 Возможные причины:");
      console.log("   1. Неверный CSS селектор для маркетинговой страницы");
      console.log("   2. Структура HTML страницы изменилась");
      console.log("   3. Элемент с количеством находится в другом месте");
    }
    console.log("-".repeat(80));

  } catch (error) {
    console.error("❌ Ошибка при тестировании:", error);
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
testMarketingPage().catch(console.error);
