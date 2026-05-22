// index.js

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const app = express();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

const managerChatId = process.env.MANAGER_CHAT_ID;
const sheetsWebhook = process.env.SHEETS_WEBHOOK_URL;

function keyboard(lang = "ua") {
  const text =
    lang === "ru"
      ? "🧹 Рассчитать стоимость и оставить заявку"
      : "🧹 Розрахувати вартість та залишити заявку";

  return {
    reply_markup: {
      keyboard: [
        [
          {
            text,
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
  const ruLetters = /[ыэъё]/i.test(text);

  if (ruLetters) return "ru";

  return "ua";
}

async function askAI(message, lang = "ua") {
  try {
    const systemPrompt =
      lang === "ru"
        ? `
Ты AI-консультант клининговой компании Premium Cleaning.

Отвечай ТОЛЬКО на русском языке.

Услуги:
- генеральная уборка;
- поддерживающая уборка;
- уборка после ремонта;
- мойка окон;
- химчистка мебели;
- уборка кухни;
- чистка духовки;
- чистка холодильника.

Твоя задача:
- консультировать клиента;
- помогать выбрать услугу;
- предлагать нажать кнопку:
"🧹 Рассчитать стоимость и оставить заявку"

Важно:
- стоимость в калькуляторе примерная;
- точную цену подтверждает менеджер после уточнения деталей.
`
        : `
Ти AI-консультант клінінгової компанії Premium Cleaning.

Відповідай ТІЛЬКИ українською мовою.

Послуги:
- генеральне прибирання;
- підтримуюче прибирання;
- прибирання після ремонту;
- миття вікон;
- хімчистка меблів;
- чистка кухні;
- чистка духовки;
- чистка холодильника.

Твоє завдання:
- консультувати клієнта;
- допомагати вибрати послугу;
- пропонувати натиснути кнопку:
"🧹 Розрахувати вартість та залишити заявку"

Важливо:
- вартість у калькуляторі приблизна;
- точну ціну підтверджує менеджер після уточнення деталей.
`;

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
          content: message,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (e) {
    console.log(e);

    return lang === "ru"
      ? "Временная ошибка. Попробуйте позже."
      : "Тимчасова помилка. Спробуйте пізніше.";
  }
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
Точну ціну підтверджує менеджер після уточнення деталей.
`;

  bot.sendMessage(chatId, welcomeText, keyboard("ua"));
});

bot.on("message", async (msg) => {
  try {
    if (!msg.text && !msg.web_app_data) return;

    if (msg.text === "/start") return;

    if (msg.web_app_data) {
      const data = JSON.parse(msg.web_app_data.data);

      const lang = data.lang || "ua";

      const managerText = `
🔥 Нова заявка з Mini App

🧹 Послуга: ${data.service}
📐 Площа: ${data.area || "-"} м²

➕ Додаткові послуги:
${data.extras.length ? data.extras.join(", ") : "Немає"}

💰 Орієнтовна ціна: ${data.price} грн

👤 Ім'я: ${data.name}
📞 Телефон: ${data.phone}
📍 Адреса: ${data.address}

📅 Дата: ${data.date}
🕒 Час: ${data.time}

💬 Коментар:
${data.comment || "-"}

🌐 Мова клієнта: ${lang}

⚠️ Ціна приблизна.
Точну вартість підтверджує менеджер після уточнення деталей.
`;

      if (managerChatId) {
        await bot.sendMessage(managerChatId, managerText);
      }

      if (sheetsWebhook) {
        try {
          await fetch(sheetsWebhook, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });
        } catch (e) {
          console.log("Sheets error", e);
        }
      }

      const clientMessage =
        lang === "ru"
          ? `
✅ Спасибо! Ваша заявка отправлена менеджеру.

Скоро с вами свяжутся.

⚠️ Стоимость в калькуляторе примерная.
Точную цену подтверждает менеджер после уточнения деталей или оценки объекта.
`
          : `
✅ Дякуємо! Вашу заявку відправлено менеджеру.

Незабаром з вами зв'яжуться.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта.
`;

      await bot.sendMessage(
        msg.chat.id,
        clientMessage,
        keyboard(lang)
      );

      return;
    }

    const lang = detectLanguage(msg.text);

    const reply = await askAI(msg.text, lang);

    bot.sendMessage(
      msg.chat.id,
      reply,
      keyboard(lang)
    );

  } catch (e) {
    console.log(e);
  }
});

app.get("/", (req, res) => {
  res.send("Bot working");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
