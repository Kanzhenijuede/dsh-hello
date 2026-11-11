# dsh-hello —— 一个能跑起来的 DSH 插件模板

这是给 DeepSeek Harness（dsh）写插件的最小可用骨架：一个**模型工具**、一个**人类斜杠命令**、
两个**配置项**。改改名字和 `apply()` 里的逻辑，就是你的插件。

已经在本机验证过：在独立 `DSH_HOME` 的 `hello` profile 里完成了依赖安装、配置树合成、
配置 schema 生成和插件导入；`node test/smoke.mjs` 用真实 `@deepseek-ai/cordis` 启动了插件并调通了工具。

---

## 1. dsh 插件到底是什么

dsh 的运行时是 [Cordis](https://www.npmjs.com/package/@deepseek-ai/cordis)（依赖注入 + 作用域生命周期）。
一个 dsh 插件就是一个 npm 包，同时扮演两个角色：

| 角色 | 由谁读 | 需要什么 |
|---|---|---|
| **Cordis 插件** | Loader 在启动/热重载时 `import()` | 导出 `name`、可选 `inject`、可选 `Config`、`apply(ctx, config)` |
| **bundle**（可选但推荐） | profile 的层栈 | `package.json` 里 `dsh.bundle.patch` 指向一个 `cordis.patch.yml`，用 `insert` 把自己的插件行插进配置树 |

配置树是"空根 + 逐层 patch"：`dsh-base` → `dsh-web-app` → 各 bundle 的 patch → 你的
`$DSH_HOME/profiles/<profile>/cordis.patch.yml` → home 级 patch → `--patch` 覆盖层。
后一层按 `id` 覆盖前一层，所以**开关一个插件只需要一个 `- id: xxx` + `disabled: true`**。

## 2. 目录

```
dsh-hello/
├─ package.json          # 包清单：入口、bundle patch、dsh 引擎范围、peer 依赖
├─ cordis.patch.yml      # bundle 层：insert 一个 id=dsh-hello 的插件行
├─ icon.svg              # 插件管理页图标（svg/png/jpg/webp，≤256 KiB）
├─ lib/index.js          # 插件本体：Config + apply()，注册工具与命令
├─ test/smoke.mjs        # 冒烟测试：假 tools 服务启动插件并调用工具
└─ README.md
```

## 3. 三个扩展点（都在 `lib/index.js`）

```js
export const name = 'dsh-hello'        // 稳定身份，必须等于 package.json 的 name
export const inject = ['tools']        // 必须先就位的服务；缺失时插件停在 PENDING
export const Config = z.object({...})  // schemastery：缺省值 + YAML 覆盖 + 类型校验
export function apply(ctx, config) {}  // 主体：注册的一切都由 ctx 作用域持有，卸载自动回收
```

* **配置**：`cordis.patch.yml` 的 `config:` 覆盖 `Config` 里的 default，YAML 里写错类型会直接报在启动日志里。
* **模型工具**：`ctx.tools.register(defineTool({...}))`。`defineTool` 把简写参数 DSL 编译成 JSON Schema、
  执行前校验模型给的参数、用 `output.render` 把返回值变成会话里的文本。注册即可见，schema 自动进系统提示词。
* **人类命令**：`ctx.commands.register({ name, description, input, handler })`。斜杠命令走 UI 命令平面，
  不产生用户消息、不吃 token；命令服务是可选能力，所以用 `ctx.get('commands')` 探测而不是写进 `inject`。

其他常用接缝（同一个 `ctx`）：`ctx.on('tools/result', …)` 观测每次工具结果、
`ctx.effect(() => cleanup)` 挂带清理的外部资源、`ctx.sessionProjections.register({…})` 给会话加投影单元、
`ctx.logger.info(…)` 写日志。

## 4. 本地开发：装进一个 profile

正式 profile（你的 Desktop profile）改动要重启应用才生效，开发阶段先用一个隔离 profile：

```bash
# 1) 装依赖（本机 dsh 自带的 node/pnpm，不用系统 PATH）
export PATH="/e/deepseek/resources/runtime/primary-runtime/dependencies/node/bin:$PATH"
cd /e/WHALE/dsh-hello
node /e/deepseek/resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs install

# 2) 建一个独立数据目录与 profile（DSH_HOME 决定 profile/session 落点）
export DSH_HOME='E:\WHALE\.dsh-dev'
#    profiles/hello/package.json 里 dsh.profile.bundles 含 dsh-hello，
#    dependencies 里是 "dsh-hello": "link:E:/WHALE/dsh-hello"

# 3) 用 dsh 自己的命令安装（等价于 pnpm add link: + 写入 bundles）
"/e/deepseek/resources/runtime/cli/bin/dsh.cmd" plugin --profile hello add link:E:/WHALE/dsh-hello

# 4) 不启动，先看合成后的配置树里有没有自己这一行
"/e/deepseek/resources/runtime/cli/bin/dsh.cmd" --profile hello --dump-config | grep -A 6 "dsh-hello"

# 5) 看加载器是否真的 import 了包、读到了 Config（能生成 schema 就说明插件本身没崩）
"/e/deepseek/resources/runtime/cli/bin/dsh.cmd" --profile hello --dump-config-schema | grep -A 12 '"config'
```

装进你正在用的 profile（重启 DeepSeek Harness 后生效）：

```bash
"/e/deepseek/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add link:E:/WHALE/dsh-hello
```

也可以完全绕开 CLI：在 `$DSH_HOME/profiles/desktop/package.json` 的 `dsh.profile.bundles` 末尾加 `dsh-hello`，
并保证 `dependencies` 里有 `"dsh-hello": "link:E:/WHALE/dsh-hello"`，然后 `pnpm install` + 重启。

## 5. 怎么确认它真的在跑

| 检查 | 期望 |
|---|---|
| `node test/smoke.mjs` | 打印 `tools: [ 'hello_echo' ]`、`result: {"text":"你好，小明！"}`、`default export: false` |
| `--dump-config` | 出现 `- id: dsh-hello` 与你的 `config`（被 profile patch 覆盖后的值） |
| `--dump-config-schema` | 出现 `greeting` / `shout` 字段的 JSON Schema，`default: "你好"` |
| 重启后的会话 | 模型可调用 `hello_echo`；输入框输入 `/hello 小明` 直接返回问候语 |

## 6. 配置与开关

```yaml
# bundle 层（cordis.patch.yml，随包发布）
- insert:
    - id: dsh-hello
      name: 'dsh-hello'
      config: { greeting: '你好', shout: false }
```

```yaml
# 你自己的覆盖层（$DSH_HOME/profiles/<profile>/cordis.patch.yml）
- id: dsh-hello
  config: { greeting: '早上好' }   # 只改想改的字段
# - id: dsh-hello
#   disabled: true                 # 整行停用，重启即生效
```

## 7. 发布

```bash
cd /e/WHALE/dsh-hello
npm publish --access public        # 包名要全局唯一，先 npm view dsh-hello 确认没被占
"/e/deepseek/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add dsh-hello
```

上架插件商城需要的清单字段（本模板已带，按需改）：

* `icon`：相对 `package.json` 的图片路径，realpath 后必须留在包目录内。
* `dsh.bundle.patch`：声明这是 bundle 及其 patch 文件。
* `dsh.engines.dsh`：兼容的 dsh 版本范围；不满足会拦安装，需要用户显式豁免。
* `dsh.compatibility.dshReleases`：对具体 dsh 版本逐项写 `compatible`/`incompatible`，商城预检会看。
* `cordis.patch.yml` 里 `id:` 必须等于包名，且那一行不能写行尾注释（预检按行正则抓 entry ID）。

## 8. 常见坑

1. **不要写 `export default`**。Loader 的 `unwrapExports` 会把模块折叠成默认导出，`inject` 被丢掉，
   插件就再也拿不到 `ctx.tools`。用具名导出（本模板的形状）。
2. **`inject` 只写真正必需的**。写了 `commands` 而某个组合没挂命令适配器，插件永远停在 PENDING、静默不工作。
3. **`link:` 安装时 peer 依赖从插件自己的 `node_modules` 解析**。pnpm 会警告
   "linked dependency will not resolve peerDependencies"，保持插件目录里有自己的 `node_modules` 即可；
   对外发布时 peer 由宿主提升，没问题。
4. **改代码要重启**（除非 profile 启用了 `dsh-hmr` 且改的是它监听的 manifest/patch 层）。
5. **工具名不要用 `run_code`**，那是 PTC 执行器的保留名；同一作用域重复注册同名工具/命令会抛错。
6. **配置写错会在启动时报错**，而不是被忽略——schemastery 的必填/类型校验先于 `apply` 执行。

## 9. 想加浏览器 UI（client 半侧）

包清单加：

```json
"exports": { "./client": "./lib/client.js" },
"dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-renderer"] } }
```

`lib/client.js` 不是普通 ESM，而是模块化插件包装：

```js
window.__ModuleLoader__.load({
  id: 'dsh-hello',
  factory: (require) => {
    const module = { exports: {} }
    module.exports.apply = function apply(ctx) {
      // ctx.slots.register({...}) / ctx.remote / require('react')
    }
    module.exports.inject = ['slots']
    return module.exports
  },
})
```

UI 侧的真实可用插槽名以已安装包为准，参考
`node_modules/@deepseek-ai/dsh-client-ui-*/lib/client.js` 与
`~/.dsh/profiles/desktop/node_modules/dsh-pet/lib/client.js`，Host 半侧导出一个空的 `apply() {}` 即可。
