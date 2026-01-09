const TelegramBot = require("node-telegram-bot-api");

class TelegramSender {
  constructor(botToken = null) {
    // Получаем токен из аргументов или из переменных окружения
    this.token = botToken || process.env.TELEGRAM_BOT_TOKEN;

    if (!this.token) {
      console.warn("⚠️ Токен Telegram бота не найден. Функционал отправки будет недоступен.");
      this.bot = null;
      this.enabled = false;
    } else {
      try {
        this.bot = new TelegramBot(this.token, { polling: false });
        this.enabled = true;
        console.log("✅ Telegram бот инициализирован");
      } catch (error) {
        console.error("❌ Ошибка при инициализации Telegram бота:", error);
        this.bot = null;
        this.enabled = false;
      }
    }
  }

  /**
   * Проверяет, доступен ли функционал отправки в Telegram
   */
  isAvailable() {
    return this.enabled && this.bot !== null;
  }

  /**
   * Отправляет PDF файл и сообщение со ссылкой на закупку
   * @param {string} chatId - ID чата или группы в Telegram
   * @param {string} filePath - Путь к PDF файлу
   * @param {string} fileName - Имя файла для отображения
   * @param {string} url - Ссылка на закупку
   * @param {string} caption - Текст сообщения (опционально)
   */
  async sendPDFWithLink(chatId, filePath, fileName, url, caption = "") {
    if (!this.isAvailable()) {
      throw new Error("Telegram бот недоступен. Проверьте токен бота.");
    }

    try {
      // Формируем текст сообщения
      const message = caption.trim()
        ? `${caption}\n\n🔗 [Ссылка на закупку](${url})`
        : `🔗 [Ссылка на закупку](${url})`;

      // Отправляем документ с подписью
      const options = {
        caption: message,
        parse_mode: "Markdown",
      };

      await this.bot.sendDocument(chatId, filePath, options, {
        filename: fileName,
      });

      console.log(`✅ PDF файл отправлен в Telegram (чат: ${chatId})`);
      return {
        success: true,
        message: "Файл успешно отправлен в Telegram",
      };
    } catch (error) {
      console.error("❌ Ошибка при отправке в Telegram:", error);

      // Определяем тип ошибки
      let errorMessage = "Не удалось отправить файл в Telegram";

      if (error.response && error.response.body) {
        const errorData = JSON.parse(error.response.body);
        if (errorData.description) {
          errorMessage = errorData.description;

          // Проверяем распространенные ошибки
          if (errorData.description.includes("chat not found")) {
            errorMessage = "Чат не найден. Проверьте правильность Chat ID";
          } else if (errorData.description.includes("bot was blocked")) {
            errorMessage = "Бот был заблокирован пользователем";
          } else if (errorData.description.includes("user is deactivated")) {
            errorMessage = "Пользователь деактивирован";
          }
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Отправляет только текстовое сообщение со ссылкой
   * @param {string} chatId - ID чата или группы в Telegram
   * @param {string} url - Ссылка на закупку
   * @param {string} message - Текст сообщения
   */
  async sendLink(chatId, url, message = "") {
    if (!this.isAvailable()) {
      throw new Error("Telegram бот недоступен. Проверьте токен бота.");
    }

    try {
      const fullMessage = message.trim()
        ? `${message}\n\n🔗 [Ссылка на закупку](${url})`
        : `🔗 [Ссылка на закупку](${url})`;

      await this.bot.sendMessage(chatId, fullMessage, {
        parse_mode: "Markdown",
      });

      console.log(`✅ Ссылка отправлена в Telegram (чат: ${chatId})`);
      return {
        success: true,
        message: "Ссылка успешно отправлена в Telegram",
      };
    } catch (error) {
      console.error("❌ Ошибка при отправке в Telegram:", error);
      throw new Error("Не удалось отправить сообщение в Telegram");
    }
  }

  /**
   * Проверяет доступность чата
   * @param {string} chatId - ID чата для проверки
   */
  async checkChat(chatId) {
    if (!this.isAvailable()) {
      throw new Error("Telegram бот недоступен. Проверьте токен бота.");
    }

    try {
      await this.bot.getChat(chatId);
      return {
        success: true,
        message: "Чат доступен для отправки сообщений",
      };
    } catch (error) {
      console.error("❌ Ошибка при проверке чата:", error);
      throw new Error("Чат недоступен. Проверьте правильность Chat ID");
    }
  }

  /**
   * Получает информацию о боте
   */
  async getBotInfo() {
    if (!this.isAvailable()) {
      throw new Error("Telegram бот недоступен. Проверьте токен бота.");
    }

    try {
      const me = await this.bot.getMe();
      return {
        success: true,
        id: me.id,
        username: me.username,
        first_name: me.first_name,
      };
    } catch (error) {
      console.error("❌ Ошибка при получении информации о боте:", error);
      throw new Error("Не удалось получить информацию о боте");
    }
  }
}

module.exports = TelegramSender;
