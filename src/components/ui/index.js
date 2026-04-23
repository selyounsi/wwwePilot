const modules = import.meta.glob('./**/*.vue', { eager: true })

export default {
  install(app) {
    for (const path in modules) {
      const component = modules[path].default
      const name = path.split('/').pop().replace('.vue', '')
      app.component(name, component)
    }
  }
}