export const MESSAGE_LIMIT = 40;

// Saved conversation text is shown with textContent. Limit old or malformed
// records so a save cannot turn one phone thread into an unbounded document.
export function cleanMessages(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(message => message && ["mum", "you"].includes(message.from) && typeof message.text === "string")
    .slice(-MESSAGE_LIMIT)
    .map(({from,text}) => ({from,text:text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0,900)}))
    .filter(message => message.text.trim());
}

export function appendMessage(state, from, text) {
  state.messages = cleanMessages([...(state.messages || []), {from,text}]);
}
