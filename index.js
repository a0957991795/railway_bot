const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const OpenAI = require("openai");

const app = express();

app.use(express.json());

const bot = new TelegramBot(
  process.env.TELEGRAM_BOT_TOKEN,
  { polling: true }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MINI_APP_URL =
  "https://mmmm.a0957991795.workers.dev";

const MANAGER_CHAT_ID =
  process.env.MANAGER_CHAT_ID;

function detectLanguage(text = "") {

  const ru =
    /[ыэёъ]/i.test(text);

  if (ru) {
    return "ru";
  }

  return "ua";
}

function getKeyboard(lang = "ua") {

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

bot.onText(/\/start/, async (msg) => {

  const chatId = msg.chat.id;

  const text = `
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

  await bot.sendMessage(
    chatId,
    text,
    getKeyboard("ua")
  );
});

bot.on("message", async (msg) => {

  try {

    if (msg.text === "/start") {
      return;
    }

    if (msg.web_app_data) {

      const data =
        JSON.parse(msg.web_app_data.data);

      const managerText = `
🔥 НОВА ЗАЯВКА

🧹 Послуга:
${data.service}

📐 Площа:
${data.area} м²

➕ Додаткові послуги:
${data.extras.length
  ? data.extras.join(", ")
  : "Немає"}

💰 Приблизна ціна:
${data.price} грн

👤 Ім'я:
${data.name}

📞 Телефон:
${data.phone}

📍 Адреса:
${data.address}

📅 Дата:
${data.date}

🕒 Час:
${data.time}

💬 Коментар:
${data.comment || "-"}

⚠️ Ціна приблизна.
Точну вартість підтверджує менеджер.
`;

      if (MANAGER_CHAT_ID) {

        await bot.sendMessage(
          MANAGER_CHAT_ID,
          managerText
        );
      }

      const lang =
        data.lang || "ua";

      const successText =
        lang === "ru"
          ? `
✅ Спасибо! Ваша заявка отправлена менеджеру.

Скоро с вами свяжутся.

⚠️ Стоимость в калькуляторе примерная.
Точную цену подтверждает менеджер
после уточнения деталей или оценки объекта.
`
          : `
✅ Дякуємо! Вашу заявку відправлено менеджеру.

Незабаром з вами зв'яжуться.

⚠️ Вартість у калькуляторі приблизна.
Точну ціну підтверджує менеджер
після уточнення деталей або оцінки об'єкта.
`;

      await bot.sendMessage(
        msg.chat.id,
        successText,
        getKeyboard(lang)
      );

      return;
    }

    if (!msg.text) {
      return;
    }

    const lang =
      detectLanguage(msg.text);

    const systemPrompt =
      lang === "ru"
        ? `
Ты AI-консультант клининговой компании Premium Cleaning.

Отвечай только на русском языке.

Помогай клиенту выбрать услуги.

Всегда отвечай кратко и понятно.

Напоминай:
стоимость примерная,
точную цену подтверждает менеджер.
`
        : `
Ти AI-консультант клінінгової компанії Premium Cleaning.

Відповідай лише українською мовою.

Допомагай клієнту обрати послуги.

Відповідай коротко та зрозуміло.

Нагадуй:
вартість приблизна,
точну ціну підтверджує менеджер.
`;

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: msg.text,
          },
        ],
      });

    const answer =
      completion.choices[0]
      .message.content;

    await bot.sendMessage(
      msg.chat.id,
      answer,
      getKeyboard(lang)
    );

  } catch (error) {

    console.log(error);

    await bot.sendMessage(
      msg.chat.id,
      "Ошибка сервера."
    );
  }
});

app.get("/", (req, res) => {

  res.send("Bot working");
});

app.listen(
  process.env.PORT || 3000,
  () => {
    console.log("Server started");
  }
);
