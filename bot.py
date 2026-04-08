from telegram import Update, ReplyKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters, ContextTypes
import phonenumbers
from phonenumbers import geocoder, carrier, timezone

BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"

# Buttons
keyboard = [["📱 Check Number"], ["❌ Exit"]]
markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 Welcome!\nClick button to check number",
        reply_markup=markup
    )

async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text

    if text == "📱 Check Number":
        await update.message.reply_text("Send phone number with country code (+91...)")

    elif text == "❌ Exit":
        await update.message.reply_text("👋 Bot stopped. Type /start to use again.")

    elif text.startswith("+"):
        try:
            parsed = phonenumbers.parse(text)

            if phonenumbers.is_valid_number(parsed):
                location = geocoder.description_for_number(parsed, "en")
                sim = carrier.name_for_number(parsed, "en")
                tz = timezone.time_zones_for_number(parsed)

                result = f"""
📱 *Phone Info*

🔢 Number: {text}
🌍 Location: {location}
📡 Carrier: {sim}
🕒 Timezone: {', '.join(tz)}
"""
            else:
                result = "❌ Invalid number"

        except:
            result = "❌ Format galat hai (+91...)"

        await update.message.reply_text(result, parse_mode="Markdown")

    else:
        await update.message.reply_text("⚠️ Pehle button use karo")

app = ApplicationBuilder().token(BOT_TOKEN).build()

app.add_handler(CommandHandler("start", start))
app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle))

app.run_polling()
