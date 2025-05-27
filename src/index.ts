import {
  App,
  Plugin,
  PluginManifest,
  TFile,
  Notice,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  MarkdownView,
  Editor,
  Menu,
  MarkdownFileInfo,
  MenuItem
} from "obsidian"

interface Settings {
  templatePath: string
  enabled: boolean
  convertEnabled: boolean
}

const DEFAULT_SETTINGS: Settings = {
  templatePath: "Obsidian/templates/default.md",
  enabled: false,
  convertEnabled: false
}

export default class AutoTemplatePlugin extends Plugin {
  public settings: Settings

  private icon: HTMLElement | null = null

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)
  }

  async onload() {
    await this.loadSettings()

    if (!this.settings.enabled) return

    this.onReady = this.onReady.bind(this)
    this.onEditorMenu = this.onEditorMenu.bind(this)
    this.convert = this.convert.bind(this)

    this.app.workspace.onLayoutReady(this.onReady)

    // 添加设置选项卡
    const settingTab = new AutoTemplateSettingTab(this.app, this)
    this.addSettingTab(settingTab)
  }

  /**
   * 向底部的状态添加条目
   */
  addItem() {
    const item = this.addStatusBarItem()
    item.createEl("span", { text: "Hello from the status bar 👋" })
  }

  createIcon() {
    this.icon = this.addRibbonIcon("refresh-cw", "Convert Path", this.convert)
    this.icon.addClass("custom-class")
  }

  command() {
    this.addCommand({
      id: "convert-path-to-unix-style",
      name: "Convert Path",
      callback: this.convert
    })
  }

  convert(e?: MouseEvent | KeyboardEvent) {
    // const file = this.app.workspace.activeEditor?.file as TFile
    // const content = await this.app.vault.read(file)
    // console.log(content)
    // const activeFile = this.app.workspace.getActiveFile()
    // const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)

    const editor = this.app.workspace.activeEditor?.editor

    if (editor) {
      const sel = editor.getSelection()
      const finally_path = sel
        .replace(/\\/g, "/")
        .replace(/\/\//g, "/")
        .replace(/(^\")|(\"$)/g, "")

      editor.replaceSelection(finally_path)
    }
  }

  /**
   * 工作空间准备好以后,注册事件
   *
   * See https://docs.obsidian.md/Reference/TypeScript+API/EventRef
   */
  private onReady() {
    const create = this.app.vault.on("create", this.onCreate, this)
    this.registerEvent(create)

    const open = this.app.workspace.on("file-open", this.onUpdateIcon, this)
    this.registerEvent(open)

    if (this.settings.convertEnabled) {
      const menu = this.app.workspace.on("editor-menu", this.onEditorMenu, this)
      this.registerEvent(menu)
    }
  }

  onEditorMenu(menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) {
    const e = this.editor()

    if (!e) return

    const add = (item: MenuItem) => {
      item.setTitle("Convert 👈").setIcon("document").onClick(this.convert)
    }

    menu.addItem(add)
  }

  private async onCreate(file: TAbstractFile) {
    if (file instanceof TFile && this.settings.enabled) {
      try {
        const templateFile = await this.checkTemplate()
        const templateContent = await this.getTemplateContent(templateFile)
        const content = this.handleVariables(templateContent, file)

        // 将模板内容写入新文件
        await this.app.vault.modify(file, content)
      } catch (err) {
        new Notice(err)
      }
    }
  }

  /**
   * 处理变量
   */
  private handleVariables(content: string, file: TFile): string {
    const now = new Date()

    return content
      .replaceAll("{{title}}", file.basename)
      .replaceAll("{{date}}", now.toISOString().split("T")[0])
      .replaceAll("{{time}}", now.toTimeString().split(" ")[0])
      .replaceAll("{{yesterday}}", () => {
        const yesterday = new Date()
        yesterday.setDate(now.getDate() - 1)
        return yesterday.toISOString().split("T")[0]
      })
  }

  /**
   * 检查模板文件是否存在
   */
  private async checkTemplate() {
    const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templatePath)

    if (!templateFile || !(templateFile instanceof TFile)) {
      return Promise.reject(`Template file not found: ${this.settings.templatePath}`)
    }

    return Promise.resolve(templateFile)
  }

  /**
   * 读取模板内容
   */
  private async getTemplateContent(file: TFile) {
    return await this.app.vault.read(file)
  }

  /**
   * 合并设置
   */
  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  private onUpdateIcon() {
    if (this.icon) this.icon.remove()

    // const editor = this.app.workspace.activeEditor?.editor
    // const activeFile = this.app.workspace.getActiveFile()

    if (this.settings.convertEnabled && this.editor()) {
      this.createIcon()
      this.command()
    }
  }

  private editor() {
    return this.app.workspace.activeEditor?.editor
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings)

    this.onUpdateIcon()
  }
}

class AutoTemplateSettingTab extends PluginSettingTab {
  plugin: AutoTemplatePlugin

  constructor(app: App, plugin: AutoTemplatePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl("h2", { text: "Auto Template Settings" })

    new Setting(containerEl).setName("开启插件").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.enabled).onChange(async value => {
        this.plugin.settings.enabled = value
        await this.plugin.saveSettings()
      })
    )

    new Setting(containerEl)
      .setName("模板路径")
      .setDesc("Path to the template file (templates/default.md)")
      .addText(text =>
        text
          .setPlaceholder("Enter template path")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async value => {
            this.plugin.settings.templatePath = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl).setName("开启转换路径").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.convertEnabled).onChange(async value => {
        this.plugin.settings.convertEnabled = value
        await this.plugin.saveSettings()
      })
    )
  }
}
