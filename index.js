const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: false
});

function getKeyboard(lang = "ua") {
  return {
    reply_markup: {
      keyboard: [
        [
          {
            text:
              lang === "ru"
                ? "🧹 Рассчитать стоимость и оставить заявку"
                : "🧹 Розрахувати вартість та залишити заявку",
            web_app: {
              url: MINI_APP_URL
            }
          }
        ]
      ],
      resize_keyboard: true,
      persistent: true
    }
  };
}

function detectLanguage(text = "") {
  if (/[ыэёъ]/i.test(text)) return "ru";
  return "ua";
}

function getWelcomeText() {
  return `
Вітаємо! 👋

Я AI-консультант Premium Cleaning.

Ви можете:
— поставити питання щодо послуг;
— розрахувати приблизну вартість;
— залишити заявку менеджеру.

👇 Натисніть кнопку нижче:

🧹 Розрахувати вартість та залишити заявку

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.
`;
}

function getClientSuccessMessage(lang = "ua") {
  if (lang === "ru") {
    return `
✅ Спасибо! Ваша заявка принята.

Менеджер скоро свяжется с вами.

⚠️ Стоимость в калькуляторе примерная.
Точную цену менеджер подтверждает после уточнения деталей или оценки объекта на месте.
`;
  }

  return `
✅ Дякуємо! Вашу заявку прийнято.

Менеджер скоро зв'яжеться з вами.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну менеджер підтверджує після уточнення деталей або оцінки об'єкта на місці.
`;
}

async function sendToGoogleSheets(data) {
  if (!SHEETS_WEBHOOK_URL) return;

  try {
    await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.log("Google Sheets error:", error.message);
  }
}

async function startBot() {
  await bot.deleteWebHook({
    drop_pending_updates: true
  });

  bot.startPolling();

  console.log("Bot started with polling");
}

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.message);
});

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    getWelcomeText(),
    getKeyboard("ua")
  );
});

bot.on("message", async (msg) => {
  try {
    if (msg.text === "/start") return;

    if (msg.web_app_data && msg.web_app_data.data) {
      const data = JSON.parse(msg.web_app_data.data);
      const lang = data.lang || "ua";

      const managerText = `
🔥 Нова заявка

🧹 Послуга: ${data.service || "-"}
📐 Площа: ${data.area || "-"} м²

➕ Додаткові послуги:
${data.extras && data.extras.length ? data.extras.join(", ") : "Немає"}

💰 Орієнтовна ціна: ${data.price || "-"} грн

👤 Ім'я: ${data.name || "-"}
📞 Телефон: ${data.phone || "-"}
📍 Адреса: ${data.address || "-"}

📅 Дата: ${data.date || "-"}
🕒 Час: ${data.time || "-"}

💬 Коментар:
${data.comment || "Без коментаря"}

⚠️ Ціна приблизна.
Точну вартість підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.
`;

      if (MANAGER_CHAT_ID) {
        await bot.sendMessage(MANAGER_CHAT_ID, managerText);
      }

      await sendToGoogleSheets(data);

      await bot.sendMessage(
        msg.chat.id,
        getClientSuccessMessage(lang),
        getKeyboard(lang)
      );

      return;
    }

    if (!msg.text) return;

    const lang = detectLanguage(msg.text);

    const systemPrompt =
      lang === "ru"
        ? `
Ты AI-консультант Premium Cleaning.
Отвечай только на русском языке.
Если клиент хочет заявку — предложи нажать кнопку снизу.
Стоимость примерная. Точную цену подтверждает менеджер.
`
        : `
Ти AI-консультант Premium Cleaning.
Відповідай тільки українською мовою.
Якщо клієнт хоче заявку — запропонуй натиснути кнопку знизу.
Вартість приблизна. Точну ціну підтверджує менеджер.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: msg.text
        }
      ]
    });

    await bot.sendMessage(
      msg.chat.id,
      completion.choices[0].message.content,
      getKeyboard(lang)
    );
  } catch (error) {
    console.log("Bot error:", error.message);
  }
});

startBot();
