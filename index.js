const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  console.log("NO TOKEN");
  process.exit(1);
}

console.log("Starting bot...");
console.log("Token length:", TOKEN.length);

const bot = new TelegramBot(TOKEN, {
  polling: true
});

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.message);
});

bot.onText(/\/start/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "Бот работает ✅"
  );
});

bot.on("message", async (msg) => {
  if (msg.text === "/start") return;

  await bot.sendMessage(
    msg.chat.id,
    "Сообщение получено ✅"
  );
});

(async () => {
  try {

    const me = await bot.getMe();

    console.log("BOT OK:", me.username);

    await bot.deleteWebHook();

    console.log("Webhook deleted");

  } catch (e) {

    console.log("START ERROR:");
    console.log(e.message);

  }
})();
