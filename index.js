const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: false
});

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY
    })
  : null;

function detectLanguage(text = "") {
  if (/[ыэёъ]/i.test(text)) {
    return "ru";
  }

  return "ua";
}

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
      one_time_keyboard: false
    }
  };
}

function getWelcomeText() {
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

function buildManagerMessage(data) {
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

Джерело: Telegram Mini App
`;
}

async function sendToGoogleSheets(data) {
  if (!SHEETS_WEBHOOK_URL) {
    console.log("⚠️ SHEETS_WEBHOOK_URL is missing");
    return;
  }

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const text = await response.text();

    console.log("Google Sheets status:", response.status);
    console.log("Google Sheets response:", text);
  } catch (error) {
    console.error("Google Sheets error:", error.message);
  }
}

async function askAI(userText, lang = "ua") {
  if (!openai) {
    return lang === "ru"
      ? "AI сейчас временно недоступен. Но вы можете нажать кнопку ниже и оставить заявку."
      : "AI зараз тимчасово недоступний. Але ви можете натиснути кнопку нижче та залишити заявку.";
  }

  const systemPrompt =
    lang === "ru"
      ? `
Ты AI-консультант клининговой компании Premium Cleaning.

Отвечай только на русском языке.

Задачи:
- консультировать клиента по услугам;
- помогать выбрать уборку;
- если клиент хочет цену или заявку — предложи нажать кнопку "🧹 Рассчитать стоимость и оставить заявку".

Услуги:
- генеральная уборка;
- поддерживающая уборка;
- уборка после ремонта;
- мойка окон;
- химчистка мебели;
- чистка кухни;
- чистка духовки;
- чистка холодильника.

Важно:
- стоимость в калькуляторе примерная;
- точную цену подтверждает менеджер после уточнения деталей или оценки объекта на месте.

Отвечай коротко, понятно и вежливо.
`
      : `
Ти AI-консультант клінінгової компанії Premium Cleaning.

Відповідай тільки українською мовою.

Завдання:
- консультувати клієнта щодо послуг;
- допомагати вибрати прибирання;
- якщо клієнт хоче ціну або заявку — запропонуй натиснути кнопку "🧹 Розрахувати вартість та залишити заявку".

Послуги:
- генеральне прибирання;
- підтримуюче прибирання;
- прибирання після ремонту;
- миття вікон;
- хімчистка меблів;
- чистка кухні;
- чистка духовки;
- чистка холодильника.

Важливо:
- вартість у калькуляторі приблизна;
- точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.

Відповідай коротко, зрозуміло та ввічливо.
`;

  try {
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
          content: userText
        }
      ]
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI error:", error.message);

    return lang === "ru"
      ? "Сейчас временная ошибка AI. Попробуйте позже или оставьте заявку через кнопку ниже."
      : "Зараз тимчасова помилка AI. Спробуйте пізніше або залиште заявку через кнопку нижче.";
  }
}

bot.onText(/\/start/, async (msg) => {
  console.log("Received /start from:", msg.chat.id);

  await bot.sendMessage(
    msg.chat.id,
    getWelcomeText(),
    getKeyboard("ua")
  );
});

bot.on("message", async (msg) => {
  try {
    if (msg.text === "/start") {
      return;
    }

    if (msg.web_app_data && msg.web_app_data.data) {
      console.log("Mini App data received:", msg.web_app_data.data);

      const data = JSON.parse(msg.web_app_data.data);
      const lang = data.lang || "ua";

      if (MANAGER_CHAT_ID) {
        await bot.sendMessage(
          MANAGER_CHAT_ID,
          buildManagerMessage(data)
        );
      } else {
        console.log("⚠️ MANAGER_CHAT_ID is missing");
      }

      await sendToGoogleSheets(data);

      await bot.sendMessage(
        msg.chat.id,
        getClientSuccessMessage(lang),
        getKeyboard(lang)
      );

      return;
    }

    if (!msg.text) {
      return;
    }

    console.log("Received message:", msg.text);

    const lang = detectLanguage(msg.text);
    const aiReply = await askAI(msg.text, lang);

    await bot.sendMessage(
      msg.chat.id,
      aiReply,
      getKeyboard(lang)
    );
  } catch (error) {
    console.error("Bot message error:", error.message);

    try {
      await bot.sendMessage(
        msg.chat.id,
        "Помилка сервера. Спробуйте ще раз пізніше."
      );
    } catch (sendError) {
      console.error("Error sending error message:", sendError.message);
    }
  }
});

bot.on("polling_error", (error) => {
  console.error("Polling error:", error.message);
});

async function startBot() {
  try {
    console.log("Starting bot...");
    console.log("Mini App URL:", MINI_APP_URL);
    console.log("Manager Chat ID:", MANAGER_CHAT_ID || "missing");
    console.log("Sheets Webhook:", SHEETS_WEBHOOK_URL ? "exists" : "missing");

    await bot.deleteWebHook({
      drop_pending_updates: true
    });

    console.log("Webhook deleted");

    await bot.startPolling();

    console.log("✅ Bot started with polling");
  } catch (error) {
    console.error("Start bot error:", error.message);
    process.exit(1);
  }
}

startBot();
