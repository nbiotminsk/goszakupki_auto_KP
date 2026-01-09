const puppeteer = require("puppeteer");

async function checkMarketingPageAgain() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для повторной проверки маркетинговой страницы...");

    browser = await puppeteer.launch({
      headless: true,
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
    console.log("🔍 ПРОВЕРКА ТОЧНОГО ТЕКСТА ЯЧЕЙКИ С КОЛИЧЕСТВОМ");
    console.log("=".repeat(80));

    const result = await page.evaluate(() => {
      const selector = "#lotsList > tbody > tr.lot-row > td.lot-count-price";
      const results = {
        selector: selector,
        elementExists: false,
        textContent: null,
        innerHTML: null,
        outerHTML: null,
        analysis: {
          allNumbers: null,
          firstNumber: null,
          secondNumber: null,
          containsEd: false,
          containsUslovEd: false,
          containsBYN: false,
          lastNumberBeforeBYN: null,
        },
      };

      const element = document.querySelector(selector);

      if (element) {
        results.elementExists = true;
        results.textContent = element.textContent.trim();
        results.innerHTML = element.innerHTML;
        results.outerHTML = element.outerHTML;

        console.log(`\n📍 Текст ячейки:`);
        console.log(`"${results.textContent}"`);

        console.log(`\n📍 HTML ячейки:`);
        console.log(`${results.innerHTML}`);

        // Анализируем текст
        const text = results.textContent;

        // Все числа
        const allNumbers = text.match(/\d+/g);
        results.analysis.allNumbers = allNumbers;
        console.log(`\n🔍 Все числа: ${allNumbers ? allNumbers.join(", ") : "нет"}`);

        // Первое число
        const firstNumber = text.match(/^(\d+)/);
        results.analysis.firstNumber = firstNumber ? firstNumber[1] : null;
        console.log(`Первое число: ${results.analysis.firstNumber || "нет"}`);

        // Второе число
        if (allNumbers && allNumbers.length > 1) {
          results.analysis.secondNumber = allNumbers[1];
          console.log(`Второе число: ${results.analysis.secondNumber}`);
        }

        // Проверяем ключевые слова
        results.analysis.containsEd = text.includes("единица");
        results.analysis.containsUslovEd = text.includes("условная единица");
        results.analysis.containsBYN = text.includes("BYN");

        console.log(`\n🔍 Анализ текста:`);
        console.log(`  Содержит "единица": ${results.analysis.containsEd ? "✅ Да" : "❌ Нет"}`);
        console.log(`  Содержит "условная единица": ${results.analysis.containsUslovEd ? "✅ Да" : "❌ Нет"}`);
        console.log(`  Содержит "BYN": ${results.analysis.containsBYN ? "✅ Да" : "❌ Нет"}`);

        // Проверяем логику извлечения
        console.log(`\n🔍 Логика извлечения:`);

        if (results.analysis.containsEd || results.analysis.containsUslovEd) {
          console.log(`  Обнаружен формат "X единица(ед.), Y ZZZ.ZZ BYN"`);
          console.log(`  Первое число - это часть описания единицы`);
          console.log(`  Второе число - это количество перед ценой`);
          if (allNumbers && allNumbers.length > 1) {
            results.analysis.lastNumberBeforeBYN = allNumbers[1];
            console.log(`  ✅ Количество для извлечения: ${allNumbers[1]}`);
          }
        } else if (results.analysis.containsBYN) {
          console.log(`  Обнаружен формат с ценой`);
          const priceIndex = text.indexOf("BYN");
          const textBeforePrice = text.substring(0, priceIndex);
          const numbersBeforePrice = textBeforePrice.match(/\d+/g);

          console.log(`  Текст до цены: "${textBeforePrice}"`);
          console.log(`  Числа до цены: ${numbersBeforePrice ? numbersBeforePrice.join(", ") : "нет"}`);

          if (numbersBeforePrice && numbersBeforePrice.length > 0) {
            results.analysis.lastNumberBeforeBYN = numbersBeforePrice[numbersBeforePrice.length - 1];
            console.log(`  ✅ Последнее число перед ценой: ${numbersBeforePrice[numbersBeforePrice.length - 1]}`);
          }
        } else {
          console.log(`  Обычный формат - первое число`);
          if (allNumbers && allNumbers.length > 0) {
            results.analysis.lastNumberBeforeBYN = allNumbers[0];
            console.log(`  ✅ Количество: ${allNumbers[0]}`);
          }
        }

        // Пробуем различные методы
        console.log(`\n🔍 Тест различных регулярных выражений:`);

        const methods = [
          { name: "/^(\\d+)/", regex: /^(\\d+)/ },
          { name: "/\\\\d+/g", regex: /\\d+/g },
          { name: "/^(\\d+)\\s*ед/", regex: /^(\\d+)\\s*ед/ },
          { name: "/условная\\s*единица.*?(\\d+)/", regex: /условная\\s*единица.*?(\\d+)/ },
        ];

        methods.forEach(method => {
          const match = text.match(method.regex);
          if (match) {
            console.log(`  ${method.name}: найдено "${match.join(", ")}"`);
          } else {
            console.log(`  ${method.name}: не найдено`);
          }
        });

      } else {
        console.log(`❌ Элемент не найден`);
      }

      return results;
    });

    console.log("\n\n" + "=".repeat(80));
    console.log("📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ");
    console.log("=".repeat(80));

    console.log(`\nПолный текст ячейки:`);
    console.log(`"${result.textContent}"`);

    if (result.analysis) {
      console.log(`\nАнализ:`);
      console.log(`  Все числа: ${result.analysis.allNumbers ? result.analysis.allNumbers.join(", ") : "нет"}`);
      console.log(`  Первое число: ${result.analysis.firstNumber || "нет"}`);
      console.log(`  Второе число: ${result.analysis.secondNumber || "нет"}`);
      console.log(`  Содержит "условная единица": ${result.analysis.containsUslovEd ? "✅" : "❌"}`);
      console.log(`  Рекомендуемое количество: ${result.analysis.lastNumberBeforeBYN || "не определено"}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("💡 АНАЛИЗ");
    console.log("=".repeat(80));

    if (result.textContent && result.textContent.includes("1 условная единица")) {
      console.log("\n⚠️ ФАКТ: текст содержит '1 условная единица'");
      console.log("⚠️ ПРОБЛЕМА: логика считает это описанием единицы измерения");
      console.log("⚠️ РЕЗУЛЬТ: извлекается второе число (из цены)");

      console.log("\n💡 РЕШЕНИЕ:");
      console.log("Необходимо проверить, действительно ли '1 условная единица' - это");
      console.log("описание единицы измерения, или это фактическое количество.");
      console.log("\nВозможно, на этой странице:");
      console.log("- '1 условная единица' - это фактическое количество (ед. измерения)");
      console.log("- '2 243.00' - это цена");
    }

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
checkMarketingPageAgain().catch(console.error);
