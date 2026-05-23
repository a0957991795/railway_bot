const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const MANAGER_CHAT_ID = (process.env.MANAGER_CHAT_ID || "").trim();
const SHEETS_WEBHOOK_URL = (process.env.SHEETS_WEBHOOK_URL || "").trim();

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

console.log("Starting bot...");
console.log("Mini App URL:", MINI_APP_URL);
console.log("Manager Chat ID:", MANAGER_CHAT_ID || "missing");
console.log("Sheets Webhook:", SHEETS_WEBHOOK_URL ? "exists" : "missing");
console.log("Telegram token length:", TELEGRAM_BOT_TOKEN.length);
console.log("Telegram token starts with:", TELEGRAM_BOT_TOKEN.slice(0, 10));

if (!TELEGRAM_BOT_TOKEN) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: false
});

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

function getKeyboard(lang = "ua") {
  const buttonText =
    lang === "ru"
      ? "🧹 Рассчитать стоимость и оставить заявку"
      : "🧹 Розрахувати вартість та залишити заявку";

  return {
    reply_markup: {
      keyboard: [
        [
          {
            text: buttonText,
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

function startText() {
  return `
Вітаємо! 👋

Я AI-консультант Premium Cleaning.

Ви можете:
— поставити питання щодо послуг;
— розрахувати приблизну вартість;
— залишити заявку менеджеру.

Натисніть велику кнопку нижче:

🧹 Розрахувати вартість та залишити заявку

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.
`;
}

function managerMessage(data) {
  return `
🔥 Нова заявка з Mini App

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
}

function clientMessage(lang = "ua") {
  if (lang === "ru") {
    return `
✅ Спасибо! Ваша заявка принята.

Менеджер скоро свяжется с вами.

⚠️ Стоимость в калькуляторе примерная.
Точную цену подтверждает менеджер после уточнения деталей или оценки объекта на месте.
`;
  }

  return `
✅ Дякуємо! Вашу заявку прийнято.

Менеджер скоро зв'яжеться з вами.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.
`;
}

async function sendToGoogleSheets(data) {
  if (!SHEETS_WEBHOOK_URL) return;

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    console.log("Google Sheets status:", response.status);
    console.log("Google Sheets response:", await response.text());
  } catch (error) {
    console.error("Google Sheets error:", error.message);
  }
}

async function askAI(text, lang = "ua") {
  if (!openai) {
    return lang === "ru"
      ? "AI временно недоступен."
      : "AI тимчасово недоступний.";
  }

  const systemPrompt =
    lang === "ru"
      ? `
Ты AI-консультант клининговой компании Premium Cleaning.
Отвечай только на русском.
Цена в калькуляторе примерная.
Точную цену подтверждает менеджер после уточнения деталей или оценки объекта.
`
      : `
Ти AI-консультант клінінгової компанії Premium Cleaning.
Відповідай тільки українською.
Ціна в калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI error:", error.message);

    return lang === "ru"
      ? "Сейчас временная ошибка AI."
      : "Зараз тимчасова помилка AI.";
  }
}

async function startBot() {
  try {
    const me = await bot.getMe();

    console.log("Telegram token is valid");
    console.log("Bot username:", me.username);

    await bot.startPolling();

    console.log("Bot started successfully");
  } catch (error) {
    console.error("START BOT ERROR:", error.message);
    process.exit(1);
  }
}

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(msg.chat.id, startText(), getKeyboard("ua"));
});

bot.on("message", async (msg) => {
  try {
    if (msg.text === "/start") return;

    if (msg.web_app_data && msg.web_app_data.data) {
      const data = JSON.parse(msg.web_app_data.data);
      const lang = data.lang || "ua";

      if (MANAGER_CHAT_ID) {
        await bot.sendMessage(MANAGER_CHAT_ID, managerMessage(data));
      }

      await sendToGoogleSheets(data);

      await bot.sendMessage(
        msg.chat.id,
        clientMessage(lang),
        getKeyboard(lang)
      );

      return;
    }

    if (!msg.text) return;

    const lang = detectLanguage(msg.text);
    const answer = await askAI(msg.text, lang);

    await bot.sendMessage(msg.chat.id, answer, getKeyboard(lang));
  } catch (error) {
    console.error("BOT MESSAGE ERROR:", error.message);
  }
});

startBot();
