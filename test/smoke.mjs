/**
 * 冒烟测试：用假的 tools / commands 服务把插件跑起来，验证导出形状、工具与命令行为。
 * 运行：node test/smoke.mjs
 */
import { Context, Service } from '@deepseek-ai/cordis'
import * as plugin from '../lib/index.js'

class Tools extends Service {
  constructor(ctx) {
    super(ctx, 'tools')
    this.registered = []
  }

  register(definition) {
    this.registered.push(definition)
    return () => {}
  }
}

class Commands extends Service {
  constructor(ctx) {
    super(ctx, 'commands')
    this.registered = []
  }

  register(definition) {
    this.registered.push(definition)
    return () => {}
  }
}

const exec = { signal: AbortSignal.timeout(5000) }

// ---- 默认配置：工具 + 命令 -------------------------------------------------
const root = new Context()
await root.plugin(Tools)
await root.plugin(Commands)
await root.plugin(plugin)

const tools = root.tools.registered
const commands = root.commands.registered

console.log('name     :', plugin.name)
console.log('inject   :', plugin.inject)
console.log('has apply:', typeof plugin.apply === 'function')
console.log('default export:', Object.hasOwn(plugin, 'default'))
console.log('tools    :', tools.map((definition) => definition.name))
console.log('params   :', JSON.stringify(tools[0].parameters))
console.log('commands :', commands.map((definition) => definition.name))
console.log('tool     :', JSON.stringify(await tools[0].execute({ name: '小明' }, exec)))
console.log('command  :', JSON.stringify(commands[0].handler({ rawInput: '小明' })))

// ---- 自定义配置：YAML 覆盖 greeting / shout ---------------------------------
const custom = new Context()
await custom.plugin(Tools)
await custom.plugin(plugin, { greeting: 'Hello', shout: true })
console.log('custom   :', JSON.stringify(await custom.tools.registered[0].execute({ name: 'world' }, exec)))

// ---- 校验：空名字必须失败 ---------------------------------------------------
try {
  await custom.tools.registered[0].execute({ name: '   ' }, exec)
  console.log('empty    : NO ERROR (unexpected)')
} catch (error) {
  console.log('empty    :', error.message)
}
