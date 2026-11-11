/**
 * dsh-hello —— 最小可用的 DSH 插件模板。
 *
 * 一个 DSH 插件就是一个 Cordis 插件：导出 `name`（稳定身份）、可选的 `inject`
 * （必须先就位的服务）、可选的 `Config`（schemastery 配置 schema）、以及
 * `apply(ctx, config)`（插件主体）。**不要**再写 `export default`：Loader 的
 * unwrapExports 会把模块折叠成默认导出，丢掉 `inject`，插件就再也拿不到服务。
 *
 * 本模板演示三件事：
 *   1. 配置项       —— Config + cordis.patch.yml 里的 config
 *   2. 模型工具     —— ctx.tools.register(defineTool(...))，模型可以直接调用
 *   3. 人类斜杠命令 —— ctx.commands.register(...)，输入框里 /hello 触发
 *
 * @module dsh-hello
 */

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Loader 用来识别插件行的稳定身份，与 package.json 的 name 保持一致。 */
export const name = 'dsh-hello'

/**
 * 必须先存在的服务。`tools` 是工具注册表，没有它这个插件没有意义；
 * `commands` 是可选能力（headless / ACP 组合可能不挂命令适配器），
 * 因此不写进 inject，而在 apply 里用 ctx.get('commands') 探测。
 */
export const inject = ['tools']

/** 配置 schema：缺省值写在这里，YAML 里只需覆盖想改的字段。 */
export const Config = z.object({
  greeting: z.string().default('你好'),
  shout: z.boolean().default(false),
})

/**
 * 插件主体。Cordis 会在依赖就位后调用它，并在插件卸载时自动回收
 * 这次 apply 里注册的一切（工具、命令、事件监听都由 ctx 作用域持有）。
 *
 * @param ctx - 插件上下文，`ctx.tools` 由 inject 保证存在。
 * @param config - 已按 `Config` 校验并填好默认值的配置对象。
 */
export function apply(ctx, config) {
  const greeting = config.greeting.trim().length > 0 ? config.greeting.trim() : '你好'
  /** 按配置决定是否把所有输出转成大写（演示配置真的影响行为）。 */
  const style = (text) => (config.shout ? text.toUpperCase() : text)

  ctx.logger?.info('dsh-hello 已加载（greeting=%s, shout=%s）', greeting, config.shout)

  // ---- 1. 模型工具 -------------------------------------------------------
  // defineTool 负责把简写参数 DSL 编译成 JSON Schema、在执行前校验模型给的参数，
  // 并把规范返回值渲染成会话里的文本。名字用小写下划线，描述写清楚"什么时候用"。
  ctx.tools.register(
    defineTool({
      name: 'hello_echo',
      description:
        'Greet a person using the greeting configured for this deployment. Use it to verify that a plugin-provided tool is wired up.',
      parameters: {
        name: {
          type: 'string',
          required: true,
          description: 'Name of the person to greet.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.text }],
      },
      async execute(args) {
        const person = args.name.trim()
        if (person.length === 0) throw new Error('hello_echo requires a non-empty name')
        return { text: style(`${greeting}，${person}！`) }
      },
    }),
  )

  // ---- 2. 人类斜杠命令 ---------------------------------------------------
  // 命令走 UI 命令平面，不产生用户消息、不消耗模型 token。
  // 组合里没有命令适配器时 ctx.get('commands') 是 undefined，直接跳过。
  const commands = ctx.get('commands')
  if (commands === undefined) return
  commands.register({
    name: 'hello',
    description: '用当前配置的问候语打个招呼',
    input: { hint: '[名字]' },
    handler: ({ rawInput }) => {
      const person = rawInput.trim().length > 0 ? rawInput.trim() : '世界'
      return { kind: 'success', text: style(`${greeting}，${person}！`) }
    },
  })
}
