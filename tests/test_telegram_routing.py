import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import telegram_sender

TARGET_CHAT = "-1004413665683"


class TelegramRoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = patch.object(telegram_sender, "BASE_DIR", self.temp.name)
        self.base.start()

    def tearDown(self):
        self.base.stop()
        self.temp.cleanup()

    def write_config(self, name, config):
        Path(self.temp.name, name).write_text(json.dumps(config), encoding="utf-8")

    def test_stale_configs_cannot_add_recipients(self):
        self.write_config("telegram_config.json", {
            "botToken": "test-token", "chatId": "-OLD-CHAT",
            "chatIds": ["-OLD-CHAT", TARGET_CHAT, "-EXTRA-CHAT"],
        })
        self.write_config("payment_config.json", {
            "telegramChatId": "-ANOTHER-CHAT", "telegramChatIds": ["-ANOTHER-CHAT"],
        })
        token, recipients = telegram_sender.get_current_tele_config()
        self.assertEqual(token, "test-token")
        self.assertEqual(recipients, [TARGET_CHAT])

    def test_missing_or_corrupt_configs_keep_single_recipient(self):
        self.assertEqual(telegram_sender.get_current_tele_config()[1], [TARGET_CHAT])
        Path(self.temp.name, "telegram_config.json").write_text("broken", encoding="utf-8")
        self.write_config("payment_config.json", {
            "telegramBotToken": "fallback-token", "telegramChatIds": ["-OLD-CHAT"],
        })
        self.assertEqual(telegram_sender.get_current_tele_config(), ("fallback-token", [TARGET_CHAT]))

    def test_default_send_goes_only_to_web2_chat(self):
        self.write_config("telegram_config.json", {
            "botToken": "test-token", "chatIds": ["-OLD-CHAT", "-EXTRA-CHAT"],
        })

        class Response:
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self): return b'{"ok":true}'

        with patch.object(telegram_sender.urllib.request, "urlopen", return_value=Response()) as send:
            self.assertTrue(telegram_sender.send_telegram_raw("Test order"))
        self.assertEqual(send.call_count, 1)
        self.assertEqual(json.loads(send.call_args.args[0].data)["chat_id"], TARGET_CHAT)


if __name__ == "__main__":
    unittest.main()
