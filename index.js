const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://white-voice-f39b.a0957991795.workers.dev/";

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let offset = 0;

// =====================
// SEND MESSAGE
// =====================

async function sendMessage(chatId, text, extra = {}) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...extra,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram sendMessage error:", data);
    }

    return data;
  } catch (error) {
    console.error("sendMessage error:", error.message);
  }
}

// =====================
// SAVE TO GOOGLE SHEETS
// =====================

async function saveToGoogleSheets(order) {
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
      body: JSON.stringify(order),
    });

    const text = await response.text();
    console.log("Google Sheets response:", text);
  } catch (error) {
    console.error("Google Sheets error:", error.message);
  }
}

// =====================
// AI RESPONSE
// =====================

async function getAIResponse(userMessage) {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
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
- отвечать вежливо и понятно;
- помогать выбрать услугу;
- собирать заявки;
- если клиент хочет рассчитать стоимость или оформить заявку — предложи открыть Mini App.

Услуги:
- генеральная уборка;
- уборка после ремонта;
- поддерживающая уборка;
- химчистка мебели;
- мытьё окон.

Для заявки нужно собрать:
- имя;
- телефон;
- услугу;
- адрес;
- удобное время.

Не придумывай точную цену, если клиент спрашивает стоимость. Скажи, что примерную стоимость можно рассчитать через Mini App, а точную подтвердит менеджер.
Отвечай кратко, дружелюбно и без давления.
`,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.5,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return "Сейчас временная ошибка AI. Попробуйте написать ещё раз через минуту.";
    }

    return data.choices?.[0]?.message?.content || "Не удалось получить ответ AI.";
  } catch (error) {
    console.error("OpenAI error:", error.message);
    return "Сейчас временная ошибка AI. Попробуйте написать ещё раз через минуту.";
  }
}

// =====================
// SEND START WITH MINI APP BUTTON
// =====================

async function sendStartMessage(chatId) {
  return sendMessage(chatId, "Добро пожаловать в Premium Cleaning 👋\n\nВы можете написать вопрос или открыть Mini App для расчёта стоимости и заявки.", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🧹 Открыть Mini App",
            web_app: {
              url: MINI_APP_URL,
            },
          },
        ],
      ],
    },
  });
}

// =====================
// HANDLE MINI APP ORDER
// =====================

async function handleMiniAppOrder(message) {
  try {
    const order = JSON.parse(message.web_app_data.data);

    const managerText = `
🔥 <b>Новая заявка из Mini App</b>

🧹 <b>Услуга:</b> ${order.service || "не указано"}
📐 <b>Площадь:</b> ${order.area || "не указано"} м²
➕ <b>Доп. услуги:</b> ${order.extras?.length ? order.extras.join(", ") : "нет"}
💰 <b>Примерная цена:</b> ${order.price || "не указано"} грн

👤 <b>Имя:</b> ${order.name || "не указано"}
📞 <b>Телефон:</b> ${order.phone || "не указано"}
📍 <b>Адрес:</b> ${order.address || "не указано"}
🕒 <b>Время:</b> ${order.time || "не указано"}
💬 <b>Комментарий:</b> ${order.comment || "нет"}

Источник: Telegram Mini App
`;

    if (MANAGER_CHAT_ID) {
      await sendMessage(MANAGER_CHAT_ID, managerText);
    } else {
      console.log("MANAGER_CHAT_ID is missing");
    }

    await saveToGoogleSheets(order);

    await sendMessage(
      message.chat.id,
      "✅ Спасибо! Ваша заявка отправлена менеджеру. Скоро с вами свяжутся."
    );
  } catch (error) {
    console.error("Mini App order error:", error.message);

    await sendMessage(
      message.chat.id,
      "Не удалось обработать заявку. Попробуйте отправить ещё раз."
    );
  }
}

// =====================
// GET UPDATES
// =====================

async function getUpdates() {
  try {
    const response = await fetch(
      `${TELEGRAM_API}/getUpdates?timeout=30&offset=${offset}`
    );

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram getUpdates error:", data);
      return [];
    }

    return data.result || [];
  } catch (error) {
    console.error("getUpdates error:", error.message);
    return [];
  }
}

// =====================
// MAIN LOOP
// =====================

async function startBot() {
  console.log("Bot started");
  console.log("Mini App URL:", MINI_APP_URL);

  if (!TELEGRAM_BOT_TOKEN) console.error("TELEGRAM_BOT_TOKEN is missing");
  if (!OPENAI_API_KEY) console.error("OPENAI_API_KEY is missing");
  if (!MANAGER_CHAT_ID) console.error("MANAGER_CHAT_ID is missing");
  if (!SHEETS_WEBHOOK_URL) console.error("SHEETS_WEBHOOK_URL is missing");

  while (true) {
    const updates = await getUpdates();

    for (const update of updates) {
      offset = update.update_id + 1;

      const message = update.message;

      if (!message) continue;

      if (message.web_app_data?.data) {
        await handleMiniAppOrder(message);
        continue;
      }

      const chatId = message.chat.id;
      const text = message.text;

      if (!text) continue;

      console.log("New message:", text);

      if (text === "/start") {
        await sendStartMessage(chatId);
        continue;
      }

      const aiReply = await getAIResponse(text);

      await sendMessage(chatId, aiReply);
    }
  }
}

startBot();
