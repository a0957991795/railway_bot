import OpenAI from "openai";

// =====================
// VARIABLES
// =====================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MANAGER_CHAT_ID = process.env.MANAGER_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is missing");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let offset = 0;

// Простая память диалогов
const dialogs = new Map();

// =====================
// TELEGRAM FUNCTIONS
// =====================

async function sendMessage(chatId, text) {
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
// AI FUNCTION
// =====================

async function askAI(chatId, userText) {
  const history = dialogs.get(chatId) || [];

  history.push({
    role: "user",
    content: userText,
  });

  const systemPrompt = `
Ты — AI-консультант клининговой компании Premium Cleaning в Днепре.

Компания оказывает услуги:
- генеральная уборка квартир и домов;
- уборка после ремонта;
- уборка после пожара;
- химчистка мебели;
- уборка коттеджей;
- поддерживающая уборка;
- мытьё кухни, санузлов, окон, техники.

Твоя задача:
1. Вежливо консультировать клиента.
2. Объяснять услуги простыми словами.
3. Помогать выбрать подходящую услугу.
4. Собирать заявку.

Для заявки нужно получить:
- имя клиента;
- телефон;
- услуга;
- адрес;
- удобное время.

Если клиент пишет непонятно или абракадабру — спокойно уточни, чем помочь.

Если клиент готов заказать уборку — задай недостающие вопросы.

Когда собраны имя, телефон, услуга, адрес и время — напиши:
ЗАЯВКА_ГОТОВА
и ниже кратко оформи заявку.

Тон общения:
- вежливый;
- дружелюбный;
- уверенный;
- без давления;
- без грубости.

Не придумывай точные цены, если их нет. Лучше скажи, что менеджер уточнит стоимость после деталей.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...history.slice(-12),
      ],
      temperature: 0.5,
    });

    const aiText = completion.choices[0].message.content;

    history.push({
      role: "assistant",
      content: aiText,
    });

    dialogs.set(chatId, history.slice(-12));

    return aiText;
  } catch (error) {
    console.error("OpenAI error:", error.message);
    return "Извините, сейчас временная ошибка с AI. Попробуйте написать ещё раз через минуту.";
  }
}

// =====================
// LEAD DETECTION
// =====================

async function checkAndSendLead(chatId, aiText, user) {
  if (!aiText.includes("ЗАЯВКА_ГОТОВА")) {
    return;
  }

  if (!MANAGER_CHAT_ID) {
    console.log("MANAGER_CHAT_ID is missing, lead not sent");
    return;
  }

  const cleanLead = aiText.replace("ЗАЯВКА_ГОТОВА", "").trim();

  const username = user?.username ? `@${user.username}` : "без username";
  const firstName = user?.first_name || "не указано";

  const managerText = `
🔥 <b>Новая заявка с Telegram-бота</b>

👤 Клиент: ${firstName}
🔗 Username: ${username}
🆔 Chat ID: ${chatId}

${cleanLead}
`;

  await sendMessage(MANAGER_CHAT_ID, managerText);
}

// =====================
// MAIN LOOP
// =====================

async function startBot() {
  console.log("Bot started on Railway");
  console.log("Telegram token starts with:", TELEGRAM_BOT_TOKEN.slice(0, 10));

  while (true) {
    const updates = await getUpdates();

    for (const update of updates) {
      offset = update.update_id + 1;

      const message = update.message;

      if (!message || !message.text) {
        continue;
      }

      const chatId = message.chat.id;
      const userText = message.text;
      const user = message.from;

      console.log("New message:", {
        chatId,
        text: userText,
      });

      if (userText === "/start") {
        await sendMessage(
          chatId,
          "Здравствуйте! Я AI-консультант Premium Cleaning. Помогу подобрать уборку и оформить заявку. Напишите, какая уборка вам нужна."
        );
        continue;
      }

      const aiText = await askAI(chatId, userText);

      await sendMessage(chatId, aiText.replace("ЗАЯВКА_ГОТОВА", "").trim());

      await checkAndSendLead(chatId, aiText, user);
    }
  }
}

startBot();
