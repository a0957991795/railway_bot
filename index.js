const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: true,
});

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

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
              url: MINI_APP_URL,
            },
          },
        ],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };
}

function detectLanguage(text = "") {
  if (/[ыэёъ]/i.test(text)) {
    return "ru";
  }

  if (/[іїєґ]/i.test(text)) {
    return "ua";
  }

  return "ua";
}

async function sendToGoogleSheets(data) {
  if (!SHEETS_WEBHOOK_URL) {
    console.log("SHEETS_WEBHOOK_URL is missing");
    return;
  }

  try {
    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    console.log("Google Sheets status:", response.status);
    console.log("Google Sheets response:", text);
  } catch (error) {
    console.error("Google Sheets error:", error.message);
  }
}

async function askAI(userText, lang = "ua") {
  if (!OPENAI_API_KEY) {
    return lang === "ru"
      ? "AI временно недоступен."
      : "AI тимчасово недоступний.";
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
- уборка кухни;
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
- прибирання кухні;
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
          content: systemPrompt,
        },
        {
          role: "user",
          content: userText,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI error:", error.message);

    return lang === "ru"
      ? "Сейчас временная ошибка AI. Попробуйте позже."
      : "Зараз тимчасова помилка AI. Спробуйте пізніше.";
  }
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

function buildClientMessage(lang = "ua") {
  if (lang === "ru") {
    return `
✅ Спасибо! Ваша заявка принята.

Менеджер скоро свяжется с вами для уточнения деталей.

⚠️ Стоимость в калькуляторе примерная.
Точную цену подтверждает менеджер после уточнения деталей или оценки объекта на месте.
`;
  }

  return `
✅ Дякуємо! Вашу заявку прийнято.

Менеджер скоро зв'яжеться з вами для уточнення деталей.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта на місці.
`;
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const welcomeText = `
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

  await bot.sendMessage(chatId, welcomeText, getKeyboard("ua"));
});

bot.on("message", async (msg) => {
  try {
    if (msg.text === "/start") {
      return;
    }

    if (msg.web_app_data && msg.web_app_data.data) {
      const data = JSON.parse(msg.web_app_data.data);

      const lang = data.lang || "ua";

      console.log("Mini App data:", data);

      const managerText = buildManagerMessage(data);

      if (MANAGER_CHAT_ID) {
        await bot.sendMessage(MANAGER_CHAT_ID, managerText);
      } else {
        console.log("MANAGER_CHAT_ID is missing");
      }

      await sendToGoogleSheets(data);

      await bot.sendMessage(
        msg.chat.id,
        buildClientMessage(lang),
        getKeyboard(lang)
      );

      return;
    }

    if (!msg.text) {
      return;
    }

    const lang = detectLanguage(msg.text);

    const aiReply = await askAI(msg.text, lang);

    await bot.sendMessage(msg.chat.id, aiReply, getKeyboard(lang));
  } catch (error) {
    console.error("Bot error:", error.message);

    await bot.sendMessage(
      msg.chat.id,
      "Помилка сервера. Спробуйте ще раз пізніше."
    );
  }
});

console.log("Bot started successfully");
console.log("Mini App URL:", MINI_APP_URL);
console.log("Manager chat ID:", MANAGER_CHAT_ID);
