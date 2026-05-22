const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let offset = 0;

// =====================
// CHECK VARIABLES
// =====================

function checkVariables() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN is missing");
  }

  if (!OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY is missing");
  }

  if (!MANAGER_CHAT_ID) {
    console.error("ERROR: MANAGER_CHAT_ID is missing");
  }

  if (!SHEETS_WEBHOOK_URL) {
    console.error("ERROR: SHEETS_WEBHOOK_URL is missing");
  }
}

// =====================
// TELEGRAM SEND MESSAGE
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
    return null;
  }
}

// =====================
// BIG MINI APP BUTTON
// =====================

function getMiniAppKeyboard() {
  return {
    keyboard: [
      [
        {
          text: "🧹 Рассчитать стоимость и оставить заявку",
          web_app: {
            url: MINI_APP_URL,
          },
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

// =====================
// SAVE TO GOOGLE SHEETS
// =====================

async function saveToGoogleSheets(order) {
  if (!SHEETS_WEBHOOK_URL) {
    console.error("SHEETS_WEBHOOK_URL is missing. Lead was not saved.");
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

    console.log("Google Sheets status:", response.status);
    console.log("Google Sheets response:", text);
  } catch (error) {
    console.error("Google Sheets error:", error.message);
  }
}

// =====================
// AI RESPONSE
// =====================

async function getAIResponse(userMessage) {
  if (!OPENAI_API_KEY) {
    return "OpenAI API ключ не подключён. Проверьте переменную OPENAI_API_KEY в Railway.";
  }

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
- консультировать клиентов по услугам клининга;
- отвечать вежливо, кратко и понятно;
- помогать выбрать услугу;
- собирать заявки;
- если клиент хочет рассчитать стоимость или оформить заявку — скажи ему нажать большую кнопку внизу чата: "🧹 Рассчитать стоимость и оставить заявку".

Услуги компании:
- генеральная уборка;
- уборка после ремонта;
- поддерживающая уборка;
- химчистка мебели;
- мытьё окон.

Для заявки нужны:
- имя;
- телефон;
- услуга;
- адрес;
- удобное время.

Правила:
- не придумывай точные цены;
- говори, что примерная стоимость есть в Mini App;
- точную цену подтверждает менеджер;
- если клиент пишет непонятно, спокойно уточни вопрос;
- не груби;
- не спорь;
- не обещай невозможное.

Стиль:
- дружелюбно;
- уверенно;
- без давления;
- простыми словами.
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
// START MESSAGE
// =====================

async function sendStartMessage(chatId) {
  const text = `
Здравствуйте! 👋

Я AI-консультант Premium Cleaning.

Я могу:
— подсказать по услугам;
— помочь выбрать уборку;
— рассчитать примерную стоимость;
— оформить заявку менеджеру.

Чтобы рассчитать стоимость и оставить заявку, нажмите большую кнопку внизу:

🧹 <b>Рассчитать стоимость и оставить заявку</b>
`;

  await sendMessage(chatId, text, {
    reply_markup: getMiniAppKeyboard(),
  });
}

// =====================
// HANDLE MINI APP ORDER
// =====================

async function handleMiniAppOrder(message) {
  try {
    const rawData = message.web_app_data?.data;

    console.log("Mini App raw data:", rawData);

    if (!rawData) {
      await sendMessage(message.chat.id, "Заявка пустая. Попробуйте отправить ещё раз.");
      return;
    }

    const order = JSON.parse(rawData);

    const orderForSheets = {
      name: order.name || "",
      phone: order.phone || "",
      service: order.service || "",
      area: order.area || "",
      extras: Array.isArray(order.extras) ? order.extras : [],
      address: order.address || "",
      time: order.time || "",
      comment: order.comment || "",
      price: order.price || "",
      source: "Telegram Mini App",
      status: "Новая",
    };

    const managerText = `
🔥 <b>Новая заявка из Mini App</b>

🧹 <b>Услуга:</b> ${orderForSheets.service || "не указано"}
📐 <b>Площадь:</b> ${orderForSheets.area || "не указано"} м²
➕ <b>Доп. услуги:</b> ${
      orderForSheets.extras.length ? orderForSheets.extras.join(", ") : "нет"
    }
💰 <b>Примерная цена:</b> ${orderForSheets.price || "не указано"} грн

👤 <b>Имя:</b> ${orderForSheets.name || "не указано"}
📞 <b>Телефон:</b> ${orderForSheets.phone || "не указано"}
📍 <b>Адрес:</b> ${orderForSheets.address || "не указано"}
🕒 <b>Время:</b> ${orderForSheets.time || "не указано"}
💬 <b>Комментарий:</b> ${orderForSheets.comment || "нет"}

Источник: Telegram Mini App
`;

    if (MANAGER_CHAT_ID) {
      await sendMessage(MANAGER_CHAT_ID, managerText);
    } else {
      console.error("MANAGER_CHAT_ID is missing. Lead was not sent to manager.");
    }

    await saveToGoogleSheets(orderForSheets);

    await sendMessage(
      message.chat.id,
      "✅ Спасибо! Ваша заявка отправлена менеджеру. Скоро с вами свяжутся."
    );
  } catch (error) {
    console.error("Mini App order processing error:", error.message);

    await sendMessage(
      message.chat.id,
      "❌ Не удалось обработать заявку. Проверьте поля и попробуйте отправить ещё раз."
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

  checkVariables();

  while (true) {
    const updates = await getUpdates();

    for (const update of updates) {
      offset = update.update_id + 1;

      const message = update.message;

      if (!message) {
        continue;
      }

      if (message.web_app_data?.data) {
        await handleMiniAppOrder(message);
        continue;
      }

      const chatId = message.chat.id;
      const text = message.text;

      if (!text) {
        continue;
      }

      console.log("New message:", text);

      if (text === "/start") {
        await sendStartMessage(chatId);
        continue;
      }

      const aiReply = await getAIResponse(text);

      await sendMessage(chatId, aiReply, {
        reply_markup: getMiniAppKeyboard(),
      });
    }
  }
}

startBot();
