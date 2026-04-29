import { HTMLHint } from 'htmlhint'

export const type = 'VALIDATE_HTML'

// Default ruleset — covers the most common real HTML issues without
// being overly noisy. Rules already enforced by other modules are off.
const RULESET = {
  // Doctype & charset
  'doctype-first':              true,
  'doctype-html5':              true,
  // Tag/attr formatting
  'tagname-lowercase':          true,
  'tagname-specialchars':       true,
  'attr-lowercase':             true,
  'attr-value-double-quotes':   true,
  'attr-value-not-empty':       false,
  'attr-no-duplication':        true,
  'attr-no-unnecessary-whitespace': true,
  'attr-unsafe-chars':          true,
  // Tag structure
  'tag-pair':                   true,
  'tag-self-close':             false, // void-elements without /> are valid HTML5
  'spec-char-escape':           true,
  // Style/script content (informational warnings)
  'inline-style-disabled':      'warn',
  'inline-script-disabled':     'warn',
  'style-disabled':             false,
  'script-disabled':            false,
  // Uniqueness
  'id-unique':                  true,
  'id-class-value':             false,
  // Coverage from other modules — keep off here
  'alt-require':                false, // images module
  'title-require':              false, // overview module
  'head-script-disabled':       false,
  // Whitespace / readability — opinion-based, off
  'space-tab-mixed-disabled':   false,
}

const SEVERITY_LABEL = { error: 'error', warning: 'warning' }

export async function handle(msg, sendResponse) {
  try {
    const messages = HTMLHint.verify(msg.html ?? '', RULESET)
    sendResponse({
      messages: messages.map(m => ({
        ruleId:   m.rule?.id ?? 'unknown',
        ruleLink: m.rule?.link ?? '',
        type:     SEVERITY_LABEL[m.type] ?? 'warning',
        message:  m.message,
        line:     m.line,
        column:   m.col,
        snippet:  m.evidence ?? '',
      })),
    })
  } catch (e) {
    sendResponse({ error: e.message, messages: [] })
  }
}
