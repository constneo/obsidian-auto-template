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
  MenuItem,
  Modal
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

    this.update = this.update.bind(this)
    this.ready = this.ready.bind(this)
    this.contextMenu = this.contextMenu.bind(this)
    this.convert = this.convert.bind(this)
  }

  async onload() {
    console.log("Register plugin Auto Template")

    await this.loadSettings()

    if (!this.settings.enabled) return

    this.app.workspace.onLayoutReady(this.ready)

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

  /**
   * 创建一个一个图标
   * 图标名字@see  {@link https://lucide.dev/ Lucide icon library},
   */
  createIcon() {
    this.icon = this.addRibbonIcon("refresh-cw", "Convert Path", this.convert)
    this.icon.addClass("custom-class")
  }

  /**
   * 向命令面板添加命令
   */
  private commands() {
    this.addCommand({
      id: "auto-template-to-unix-style",
      name: "Convert Path",
      callback: this.convert
    })

    // This adds a complex command that can check whether the current state of the app allows execution of the command
    // this.addCommand({
    //   id: "open-sample-modal-complex",
    //   name: "Open sample modal (complex)",
    //   checkCallback: (checking: boolean) => {
    //     const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView)
    //     if (markdownView) {
    //       // 如果 checking 为 true，我们只是 “检查” 命令是否可以运行。
    //       // 如果 checking 为 false，那么我们想要实际执行该作。
    //       if (!checking) {
    //         new SampleModal(this.app).open()
    //       }

    //       // This command will only show up in Command Palette when the check function returns true
    //       return true
    //     }
    //   }
    // })

    this.addCommand({
      id: "auto-template-update-content",
      name: "Update content with Template",
      callback: this.update
    })
  }

  private convert(e?: MouseEvent | KeyboardEvent) {
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
  private ready() {
    const create = this.app.vault.on("create", this.create, this)
    this.registerEvent(create)

    const open = this.app.workspace.on("file-open", this.onUpdateIcon, this)
    this.registerEvent(open)

    if (this.settings.enabled) {
      const menu = this.app.workspace.on("editor-menu", this.contextMenu, this)
      this.registerEvent(menu)
    }
  }

  /**
   * 右键菜单
   * @param menu
   * @param editor
   * @param info
   * @returns
   */
  contextMenu(menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) {
    const e = this.editor()

    if (!e) return

    const add = (item: MenuItem) => {
      item.setTitle("Convert Path 👈").setIcon("document").onClick(this.convert)
    }

    menu.addItem(add)

    const update = (item: MenuItem) => {
      item.setTitle("Update").setIcon("chevrons-left-right-ellipsis").onClick(this.update)
    }

    menu.addItem(update)
  }

  /***
   * 点击右键菜单,将模板内容插入当前的文档
   */
  private async update() {
    const file = this.app.workspace.getActiveFile()
    if (file) {
      // const content = this.create(file as TFile)
      const content = await this.app.vault.read(file)
      if (content.length === 0) {
        this.create(file)
      }
    }
  }

  /**
   * 创建的新的md文件的时候,插入模板内容.
   * @param file
   */
  private async create(file: TFile) {
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
      this.commands()
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

class SampleModal extends Modal {
  constructor(app: App) {
    super(app)
  }

  onOpen() {
    const { contentEl } = this
    contentEl.setText("Woah!")
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
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
