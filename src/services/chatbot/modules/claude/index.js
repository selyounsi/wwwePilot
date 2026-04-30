export const accentColor = '#D97757'

export const welcomeText = "Ask me a question — I'm Claude from Anthropic."

export const suggestions = [
  'Explain this element on the page.',
  'How can I improve accessibility?',
  'What do these SEO errors mean?',
]

export default function send({ text, history }) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'CLAUDE_CHAT', messages: history, currentMessage: text },
      (res) => {
        if (res?.error) resolve({ error: res.error })
        else            resolve({ reply: res?.reply })
      },
    )
  })
}
