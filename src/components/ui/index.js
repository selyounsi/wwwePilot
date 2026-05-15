// Auto-registers every component under components/ui/**/*.vue. Also picks
// up admin/components/*.vue and admin/modules/*/components/*.vue so admin-
// owned widgets (QuickSwitcher, role pickers, etc.) register the same way
// without an explicit import per consumer.
const modules = {
  ...import.meta.glob('./**/*.vue',                          { eager: true }),
  ...import.meta.glob('@/admin/components/*.vue',            { eager: true }),
  ...import.meta.glob('@/admin/modules/*/components/*.vue',  { eager: true }),
}

export default {
  install(app) {
    for (const path in modules) {
      const component = modules[path].default
      const name = path.split('/').pop().replace('.vue', '')
      app.component(name, component)
    }
  }
}
