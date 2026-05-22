const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;
const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

const MINI_APP_URL = "https://mmmm.a0957991795.workers.dev";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let offset = 0;

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
    console.log("sendMessage response:", data);

    return data;
  } catch (error) {
    console.error("sendMessage error:", error.message);
    return null;
  }
}

async function saveToGoogleSheets(order) {
  if (!SHEETS_WEBHOOK_URL) {
    console.error("SHEETS_WEBHOOK_URL is missing");
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

function buildManagerMessage(order) {
  return `
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

⚠️ <b>Важно:</b> ${order.note || "Стоимость примерная. Точная цена рассчитывается менеджером после уточнения деталей и осмотра объекта."}

Источник: Telegram Mini App
`;
}

async function getAIResponse(userMessage) {
  if (!OPENAI_API_KEY) {
    return "OpenAI API ключ не подключён.";
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
- консультировать клиентов;
- помогать выбрать услугу;
- если клиент хочет цену или заявку — направляй его нажать кнопку "🧹 Рассчитать стоимость и оставить заявку".

Важно:
- стоимость в Mini App примерная;
- точную стоимость подтверждает менеджер после уточнения деталей и осмотра объекта;
- не обещай фиксированную цену;
- отвечай коротко, понятно и вежливо.
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
      return "Сейчас временная ошибка AI. Попробуйте написать позже.";
    }

    return data.choices?.[0]?.message?.content || "Не удалось получить ответ.";
  } catch (error) {
    console.error("OpenAI error:", error.message);
    return "Сейчас временная ошибка AI. Попробуйте написать позже.";
  }
}

async function sendStartMessage(chatId) {
  const text = `
Здравствуйте! 👋

Я AI-консультант Premium Cleaning.

Вы можете:
— задать вопрос по услугам;
— рассчитать примерную стоимость;
— оставить заявку менеджеру.

Нажмите большую кнопку внизу:

🧹 <b>Рассчитать стоимость и оставить заявку</b>

⚠️ Стоимость в калькуляторе примерная. Точную цену подтверждает менеджер после уточнения деталей.
`;

  await sendMessage(chatId, text, {
    reply_markup: getMiniAppKeyboard(),
  });
}

async function handleMiniAppOrder(message) {
  try {
    const rawData = message.web_app_data?.data;

    console.log("Mini App raw data:", rawData);

    if (!rawData) {
      await sendMessage(message.chat.id, "Заявка пустая. Попробуйте ещё раз.");
      return;
    }

    const order = JSON.parse(rawData);

    const managerText = buildManagerMessage(order);

    if (!MANAGER_CHAT_ID) {
      console.error("MANAGER_CHAT_ID is missing");
    } else {
      const managerResult = await sendMessage(MANAGER_CHAT_ID, managerText);
      console.log("Manager send result:", managerResult);
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
      "❌ Не удалось обработать заявку. Попробуйте отправить ещё раз."
    );
  }
}

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

async function startBot() {
  console.log("Bot started");
  console.log("MANAGER_CHAT_ID:", MANAGER_CHAT_ID);
  console.log("SHEETS_WEBHOOK_URL:", SHEETS_WEBHOOK_URL);
  console.log("MINI_APP_URL:", MINI_APP_URL);

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

      await sendMessage(chatId, aiReply, {
        reply_markup: getMiniAppKeyboard(),
      });
    }
  }
}

startBot();
