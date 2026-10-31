import { createBot } from "./bot.js?v=b11df7a335";
let bot, key;
self.onmessage = ({ data }) => {
  try {
    if (!bot || key !== data.key) {
      key = data.key;
      bot = createBot({ seed: data.seed, strength: data.state.bot?.strength });
    }
    self.postMessage({ id: data.id, result: bot.choose(data.state) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
