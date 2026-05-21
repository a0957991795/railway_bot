const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let offset = 0;

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });
}

async function saveToGoogleSheets(order) {

  if (!SHEETS_WEBHOOK_URL) {
    console.log("SHEETS_WEBHOOK_URL missing");
    return;
  }

  try {

    const response = await fetch(SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });

    const text = await response.text();

    console.log("Sheets response:", text);

  } catch (error) {

    console.error("Google Sheets Error:", error.message);

  }
}

async function getAIResponse(userMessage) {

  try {

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
Ты AI-консультант клининговой компании Premium Cleaning.

Твоя задача:
- консультировать клиентов;
- отвечать вежливо;
- помогать выбрать услуги;
- собирать заявки.

Услуги:
- генеральная уборка;
- уборка после ремонта;
- поддерживающая уборка;
- химчистка мебели;
- мытьё окон.

Если клиент хочет заказать услугу — попроси:
- имя;
- телефон;
- адрес;
- удобное время.

Отвечай кратко и понятно.
`
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    const data = await response.json();

    return data.choices[0].message.content;

  } catch (error) {

    console.error("OpenAI Error:", error.message);

    return "Ошибка AI ответа.";

  }
}

async function handleUpdates() {

  try {

    const response = await fetch(
      `${TELEGRAM_API}/getUpdates?timeout=30&offset=${offset}`
    );

    const data = await response.json();

    if (!data.ok) {
      console.log(data);
      return;
    }

    for (const update of data.result) {

      offset = update.update_id + 1;

      const message = update.message;

      if (!message) continue;

      // MINI APP DATA

      if (message.web_app_data?.data) {

        const order = JSON.parse(message.web_app_data.data);

        const managerText = `
🔥 <b>Новая заявка из Mini App</b>

🧹 Услуга: ${order.service}
📐 Площадь: ${order.area} м²
➕ Доп. услуги: ${order.extras?.join(", ") || "нет"}
💰 Цена: ${order.price} грн

👤 Имя: ${order.name}
📞 Телефон: ${order.phone}
📍 Адрес: ${order.address}
🕒 Время: ${order.time}
💬 Комментарий: ${order.comment || "нет"}
`;

        await sendMessage(MANAGER_CHAT_ID, managerText);

        await saveToGoogleSheets(order);

        await sendMessage(
          message.chat.id,
          "✅ Спасибо! Ваша заявка отправлена менеджеру."
        );

        continue;
      }

      const text = message.text;

      if (!text) continue;

      console.log("Message:", text);

      if (text === "/start") {

        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: "Добро пожаловать в Premium Cleaning 👋",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🧹 Открыть Mini App",
                    web_app: {
                      url: "https://YOUR_MINI_APP_URL.pages.dev"
                    }
                  }
                ]
              ]
            }
          }),
        });

        continue;
      }

      const aiReply = await getAIResponse(text);

      await sendMessage(message.chat.id, aiReply);

    }

  } catch (error) {

    console.error("Polling Error:", error.message);

  }
}

console.log("Bot started...");

setInterval(handleUpdates, 2000);
