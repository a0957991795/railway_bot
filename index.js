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
          text: "🧹 Розрахувати вартість і залишити заявку",
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

    if (!data.ok) {
      console.error("Telegram sendMessage error:", data);
    }

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
🔥 <b>Нова заявка з Mini App</b>

🧹 <b>Послуга:</b> ${order.service || "не вказано"}
📐 <b>Площа:</b> ${order.area || "не вказано"} м²
➕ <b>Додаткові послуги:</b> ${order.extras?.length ? order.extras.join(", ") : "немає"}
💰 <b>Орієнтовна ціна:</b> ${order.price || "не вказано"} грн

👤 <b>Імʼя:</b> ${order.name || "не вказано"}
📞 <b>Телефон:</b> ${order.phone || "не вказано"}
📍 <b>Адреса:</b> ${order.address || "не вказано"}
📅 <b>Дата:</b> ${order.date || "не вказано"}
🕒 <b>Час:</b> ${order.time || "не вказано"}
💬 <b>Коментар:</b> ${order.comment || "немає"}

⚠️ <b>Важливо:</b> вартість у додатку є орієнтовною. Точну ціну менеджер підтверджує після уточнення деталей і/або оцінки обʼєкта на місці.

Джерело: Telegram Mini App
`;
}

function buildClientConfirmationMessage(order) {
  return `
✅ <b>Дякуємо! Вашу заявку прийнято.</b>

Менеджер скоро звʼяжеться з вами для уточнення деталей.

🧹 <b>Послуга:</b> ${order.service || "не вказано"}
💰 <b>Орієнтовна вартість:</b> ${order.price || "не вказано"} грн

⚠️ <b>Важливо:</b>
Вартість у додатку є орієнтовною/попередньою.

Точна ціна розраховується менеджером після уточнення деталей і/або оцінки обʼєкта на місці.

Дякуємо за звернення в Premium Cleaning 👋
`;
}

async function getAIResponse(userMessage) {
  if (!OPENAI_API_KEY) {
    return "OpenAI API ключ не підключений.";
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
Ти AI-консультант клінінгової компанії Premium Cleaning.

Головне мовне правило:
- Якщо клієнт пише українською — відповідай українською.
- Якщо клієнт пише російською — відповідай російською.
- Якщо клієнт пише іншою мовою — відповідай мовою клієнта.
- Не змішуй мови в одній відповіді без потреби.

Твоя задача:
- консультувати клієнтів;
- допомагати вибрати послугу;
- пояснювати послуги простими словами;
- якщо клієнт хоче ціну або заявку — направляй його натиснути кнопку "🧹 Розрахувати вартість і залишити заявку".

Послуги:
- генеральне прибирання;
- прибирання після ремонту;
- підтримуюче прибирання;
- хімчистка меблів;
- миття вікон;
- прибирання балкона;
- глибоке прибирання кухні.

Дуже важливе правило по ціні:
- ціна в Mini App є орієнтовною/попередньою;
- точну ціну підтверджує менеджер після уточнення деталей;
- фінальна оцінка може відбуватися на місці, залежно від стану обʼєкта та обсягу робіт;
- не обіцяй фіксовану остаточну ціну.

Стиль:
- коротко;
- ввічливо;
- зрозуміло;
- без тиску.
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
      return "Зараз тимчасова помилка AI. Спробуйте написати пізніше.";
    }

    return data.choices?.[0]?.message?.content || "Не вдалося отримати відповідь.";
  } catch (error) {
    console.error("OpenAI error:", error.message);
    return "Зараз тимчасова помилка AI. Спробуйте написати пізніше.";
  }
}

async function sendStartMessage(chatId) {
  const text = `
Вітаємо! 👋

Я AI-консультант Premium Cleaning.

Ви можете:
— поставити питання щодо послуг;
— розрахувати орієнтовну вартість;
— залишити заявку менеджеру.

Натисніть велику кнопку внизу:

🧹 <b>Розрахувати вартість і залишити заявку</b>

⚠️ Вартість у калькуляторі є орієнтовною. Точну ціну підтверджує менеджер після уточнення деталей і/або оцінки обʼєкта на місці.
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
      await sendMessage(message.chat.id, "Заявка порожня. Спробуйте ще раз.");
      return;
    }

    const order = JSON.parse(rawData);

    const normalizedOrder = {
      name: order.name || "",
      phone: order.phone || "",
      service: order.service || "",
      area: order.area || "",
      extras: Array.isArray(order.extras) ? order.extras : [],
      address: order.address || "",
      date: order.date || "",
      time: order.time || "",
      visit_datetime: order.visit_datetime || "",
      comment: order.comment || "",
      price: order.price || "",
      note:
        "Вартість орієнтовна/попередня. Точна ціна розраховується менеджером після уточнення деталей і/або оцінки обʼєкта на місці.",
      source: "Telegram Mini App",
      status: "Нова",
    };

    const managerText = buildManagerMessage(normalizedOrder);

    if (!MANAGER_CHAT_ID) {
      console.error("MANAGER_CHAT_ID is missing");
    } else {
      const managerResult = await sendMessage(MANAGER_CHAT_ID, managerText);
      console.log("Manager send result:", managerResult);
    }

    await saveToGoogleSheets(normalizedOrder);

    const clientText = buildClientConfirmationMessage(normalizedOrder);

    await sendMessage(message.chat.id, clientText, {
      reply_markup: getMiniAppKeyboard(),
    });
  } catch (error) {
    console.error("Mini App order error:", error.message);

    await sendMessage(
      message.chat.id,
      "❌ Не вдалося обробити заявку. Спробуйте відправити ще раз.",
      {
        reply_markup: getMiniAppKeyboard(),
      }
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
