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

function keyboard() {
  return {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🧹 Розрахувати вартість та залишити заявку",
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

async function askAI(message) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `
Ти AI-консультант клінінгової компанії Premium Cleaning.

ПРАВИЛА МОВИ:
- Якщо клієнт пише українською — відповідай українською.
- Якщо клієнт пише російською — відповідай російською.
- Не змішуй мови.

ПОСЛУГИ:
- генеральне прибирання;
- підтримуюче прибирання;
- прибирання після ремонту;
- миття вікон;
- хімчистка меблів;
- чистка кухні;
- чистка духовки;
- чистка холодильника.

ТВОЄ ЗАВДАННЯ:
- консультувати клієнта;
- допомагати вибрати послугу;
- якщо клієнт хоче розрахунок або заявку — кажи натиснути кнопку:
"🧹 Розрахувати вартість та залишити заявку"

ВАЖЛИВО:
- ціна в калькуляторі приблизна;
- точну вартість підтверджує менеджер після уточнення деталей або оцінки об'єкта.
`,
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
    return "Тимчасова помилка. Спробуйте пізніше.";
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
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта.
`;

  bot.sendMessage(chatId, welcomeText, keyboard());
});

bot.on("message", async (msg) => {
  try {
    if (!msg.text) return;

    if (msg.text === "/start") return;

    if (msg.web_app_data) {
      const data = JSON.parse(msg.web_app_data.data);

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

⚠️ Ціна приблизна.
Точну вартість підтверджує менеджер після уточнення деталей або оцінки об'єкта.
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

      await bot.sendMessage(
        msg.chat.id,
        `
✅ Дякуємо! Вашу заявку прийнято.

Менеджер скоро зв'яжеться з вами.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей або оцінки об'єкта.
`,
        keyboard()
      );

      return;
    }

    const reply = await askAI(msg.text);

    bot.sendMessage(msg.chat.id, reply, keyboard());
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
