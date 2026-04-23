import { reactive } from 'vue'

const state = reactive({
  results:        {},
  lastChecked:    null,
  checkedTabId:   null,
  checkedUrl:     null,
  checkedTabName: null,
})

export function useCheckStore() {
  function setRunning(id) {
    state.results[id] = { status: 'running', errors: [], warnings: [] }
  }

  function setResult(id, result) {
    state.results[id] = { ...result, status: 'done' }
  }

  function getResult(id) {
    return state.results[id] ?? { status: 'idle', errors: [], warnings: [] }
  }

  function setCheckedTab(tab) {
    state.checkedTabId   = tab.id
    state.checkedUrl     = tab.url
    state.checkedTabName = tab.title || tab.url
    state.lastChecked    = new Date().toLocaleTimeString()
  }

  function reset() {
    state.results        = {}
    state.lastChecked    = null
    state.checkedTabId   = null
    state.checkedUrl     = null
    state.checkedTabName = null
  }

  return { state, setRunning, setResult, getResult, setCheckedTab, reset }
}