const puppeteer = require("puppeteer");

async function checkPage3028754() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для проверки страницы 3028754...");

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-gpu",
      ],
    });

    console.log("✅ Браузер запущен");

    const page = await browser.newPage();
    const testUrl = "https://goszakupki.by/single-source/view/3028754";

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
        textContent: null,
        allNumbers: null,
        analysis: {
          containsEd: false,
          containsUslovEd: false,
          containsBYN: false,
          price: null,
        },
        extractedQuantity: null,
      };

      const element = document.querySelector(selector);

      if (element) {
        results.elementExists = true;
        results.textContent = element.textContent.trim();

        console.log(`\n📍 Текст ячейки:`);
        console.log(`"${results.textContent}"`);

        // Анализируем текст
        const text = results.textContent;
        const allNumbers = text.match(/\d+/g);
        results.allNumbers = allNumbers;

        console.log(`\n🔍 Анализ текста:`);
        console.log(`  Все числа: ${allNumbers ? allNumbers.join(", ") : "нет"}`);
        console.log(`  Количество чисел: ${allNumbers ? allNumbers.length : 0}`);

        // Проверяем ключевые слова
        results.analysis.containsEd = text.includes("единица");
        results.analysis.containsUslovEd = text.includes("условная единица");
        results.analysis.containsBYN = text.includes("BYN");

        console.log(`  Содержит "единица": ${results.analysis.containsEd ? "✅ Да" : "❌ Нет"}`);
        console.log(`  Содержит "условная единица": ${results.analysis.containsUslovEd ? "✅ Да" : "❌ Нет"}`);
        console.log(`  Содержит "BYN": ${results.analysis.containsBYN ? "✅ Да" : "❌ Нет"}`);

        // Извлекаем цену
        if (results.analysis.containsBYN) {
          const priceMatch = text.match(/(\d[\d\s]*,\s*\d{2})\s*BYN/);
          if (priceMatch) {
            results.analysis.price = priceMatch[1];
            console.log(`  Цена: ${results.analysis.price} BYN`);
          }
        }

        // Логика извлечения количества (как в текущем парсере)
        let quantity = null;

        if (allNumbers && allNumbers.length > 0) {
          quantity = allNumbers[0]; // По умолчанию первое число

          // Проверяем особые форматы
          if (
            text.includes("единица(ед.)") ||
            text.includes("условная единица")
          ) {
            // Формат: "X единица(ед.), Y ZZZ.ZZ BYN" или "X условная единица, Y ZZZ.ZZ BYN"
            // Если X=1, это может быть описание единицы, а Y - количество
            // Если X>1, это может быть количество
            if (allNumbers.length > 1) {
              // Проверяем: если первое число равно 1 и текст содержит "1 единица(ед.)",
              // то второе число - это количество
              const firstNumber = parseInt(allNumbers[0]);
              if (firstNumber === 1 && text.includes("1 единица")) {
                quantity = allNumbers[1];
                console.log(`\n  ⚠️ Обнаружен формат "1 единица(ед.)"`);
                console.log(`     Первое число (1) - это описание единицы измерения`);
                console.log(`     Второе число (${allNumbers[1]}) - это количество`);
              } else {
                console.log(`\n  ℹ️ Первое число (${firstNumber}) != 1, используем его как количество`);
              }
            }
          } else if (text.includes(" BYN")) {
            // Формат с ценой: количество находится перед ценой
            console.log(`\n  🔍 Ищем последнее число перед ценой`);
            const priceIndex = text.indexOf(" BYN");
            if (priceIndex > 0) {
              const textBeforePrice = text.substring(0, priceIndex);
              const numbersBeforePrice = textBeforePrice.match(/\d+/g);
              if (numbersBeforePrice && numbersBeforePrice.length > 0) {
                quantity = numbersBeforePrice[numbersBeforePrice.length - 1];
                console.log(`     Текст до цены: "${textBeforePrice}"`);
                console.log(`     Числа до цены: ${numbersBeforePrice.join(", ")}`);
                console.log(`     Последнее число: ${quantity}`);
              }
            }
          }
        }

        results.extractedQuantity = quantity;
        console.log(`\n  📦 Извлеченное количество: "${quantity ? quantity + ' ед.' : 'не определено'}"`);

      } else {
        console.log(`❌ Элемент не найден`);
      }

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    console.log(`\nСелектор: ${result.selector}`);
    console.log(`Элемент найден: ${result.elementExists ? "✅ Да" : "❌ Нет"}`);

    if (result.textContent) {
      console.log(`\nПолный текст ячейки:`);
      console.log(`"${result.textContent}"`);

      console.log(`\nВсе числа: ${result.allNumbers ? result.allNumbers.join(", ") : "нет"}`);

      console.log(`\nАнализ:`);
      console.log(`  Содержит "единица": ${result.analysis.containsEd ? "✅ Да" : "❌ Нет"}`);
      console.log(`  Содержит "условная единица": ${result.analysis.containsUslovEd ? "✅ Да" : "❌ Нет"}`);
      console.log(`  Содержит "BYN": ${result.analysis.containsBYN ? "✅ Да" : "❌ Нет"}`);
      if (result.analysis.price) {
        console.log(`  Цена: ${result.analysis.price} BYN`);
      }

      console.log(`\n📦 ИЗВЛЕЧЕННОЕ КОЛИЧЕСТВО:`);
      if (result.extractedQuantity) {
        console.log(`✅ "${result.extractedQuantity} ед."`);
      } else {
        console.log(`❌ Не определено`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("💡 РЕКОМЕНДАЦИЯ");
    console.log("=".repeat(80));

    if (result.extractedQuantity) {
      console.log(`\n✅ Количество успешно извлечено: "${result.extractedQuantity} ед."`);
      console.log(`\nЭто значение будет использоваться в PDF документе.`);
    } else {
      console.log(`\n❌ Количество не извлечено`);
      console.log(`\nВозможные причины:`);
      console.log(`1. Текст ячейки имеет нестандартный формат`);
      console.log(`2. Регулярное выражение не подходит для этой страницы`);
      console.log(`3. Количество находится в другом месте`);
    }

    console.log("\n" + "=".repeat(80));

  } catch (error) {
    console.error("❌ Ошибка при проверке:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Браузер закрыт");
    }

    console.log("\n🏁 Проверка завершена");
  }
}

// Запуск проверки
checkPage3028754().catch(console.error);
