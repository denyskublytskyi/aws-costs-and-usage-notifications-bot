import fetch from "node-fetch";

const logger = console;

const sendNotification = async (message) => {
  const escapedMessage = message.replace(/[_[\]()~`>#+-=|{}.!]/g, "\\$&");
  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: escapedMessage,
        parse_mode: "MarkdownV2",
      }),
    },
  );

  logger.info("Telegram response =>", response.status, await response.text());
};

export default sendNotification;
