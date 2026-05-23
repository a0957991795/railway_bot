import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

const bot = new TelegramBot(TOKEN, {
  polling: true
});

const miniAppUrl = "https://mmmm.a0957991795.workers.dev";

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  const text = `
👋 Вітаємо!

Я AI-консультант Premium Cleaning.

Ви можете:
— поставити питання по послугах;
— розрахувати приблизну вартість;
— залишити заявку менеджеру.

👇 Натисніть кнопку нижче:

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер після уточнення деталей.
`;

  await bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "🧹 Розрахувати вартість і залишити заявку",
            web_app: {
              url: miniAppUrl
            }
          }
        ]
      ],
      resize_keyboard: true
    }
  });
});

app.post("/web-data", async (req, res) => {
  try {
    const data = req.body;

    const message = `
🔥 Нова заявка

🧹 Послуга: ${data.service}
📐 Площа: ${data.area} м²
💰 Приблизна ціна: ${data.price} грн

👤 Ім'я: ${data.name}
📞 Телефон: ${data.phone}
📍 Адреса: ${data.address}
📅 Дата: ${data.date}
🕒 Час: ${data.time}

💬 Коментар:
${data.comment || "Немає"}
`;

    await bot.sendMessage(MANAGER_CHAT_ID, message);

    await bot.sendMessage(
      data.chatId,
      `✅ Дякуємо! Ваша заявка відправлена менеджеру.

📌 Вартість у калькуляторі приблизна.
Точну ціну менеджер підтвердить після уточнення деталей або оцінки на місці.`
    );

    res.sendStatus(200);

  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Bot is working");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started");
});
