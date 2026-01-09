const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function savePageHTML() {
  let browser = null;
  try {
    console.log("🚀 Запуск браузера для сохранения HTML...");

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

    // Получаем HTML страницы
    const html = await page.content();

    // Создаем директорию для сохранения, если её нет
    const testDir = path.join(__dirname, "output");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Сохраняем HTML в файл
    const htmlFilePath = path.join(testDir, "marketing-page.html");
    fs.writeFileSync(htmlFilePath, html, "utf8");

    console.log(`✅ HTML сохранен в файл: ${htmlFilePath}`);
    console.log(`📊 Размер файла: ${html.length} символов`);

    // Также сохраняем только таблицы
    const tables = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table"));
      return tables.map((table, index) => {
        return {
          index: index + 1,
          id: table.id || "",
          className: table.className || "",
          rowCount: table.querySelectorAll("tr").length,
          html: table.outerHTML,
        };
      });
    });

    // Сохраняем каждую таблицу в отдельный файл
    tables.forEach((table) => {
      const tableFilePath = path.join(testDir, `table-${table.index}${table.id ? '-' + table.id : ''}.html`);
      fs.writeFileSync(tableFilePath, table.html, "utf8");
      console.log(`✅ Таблица #${table.index} сохранена: ${tableFilePath}`);
      console.log(`   ID: ${table.id || '(нет)'}`);
      console.log(`   Строк: ${table.rowCount}`);
    });

    console.log(`\n📁 Все файлы сохранены в директории: ${testDir}`);
    console.log(`\n💡 Теперь вы можете открыть HTML файлы в браузере для анализа структуры`);

  } catch (error) {
    console.error("❌ Ошибка при сохранении HTML:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("\n✅ Браузер закрыт");
    }
  }
}

// Запуск скрипта
savePageHTML().catch(console.error);
