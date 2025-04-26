import { App, Plugin, TFile, Notice, PluginSettingTab, Setting, TAbstractFile } from "obsidian"

/**
 * @typedef {import("obsidian").PluginManifest} PluginManifest
 */

//
const DEFAULT_SETTINGS = {
  templatePath: "/Obsidian/templates/default.md",
  enabled: false
}

export default class AutoTemplatePlugin extends Plugin {
  settings

  /**
   *
   * @param {App} app
   * @param {PluginManifest} manifest
   */
  constructor(app, manifest) {
    super(app, manifest)
  }

  async onload() {
    await this.loadSettings()
    this.app.workspace.onLayoutReady(this.onReady.bind(this))

    // 添加设置选项卡
    this.addSettingTab(new AutoTemplateSettingTab(this.app, this))

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon("dice", "Sample Plugin", evt => {
      // Called when the user clicks the icon.
      new Notice("This is a notice!")
    })
    // Perform additional things with the ribbon
    ribbonIconEl.addClass("my-plugin-ribbon-class")

    console.log("Auto Template plugin loaded")
  }
  /**
   *  工作空间准备好以后,注册文件创建事件
   */
  onReady() {
    this.registerEvent(this.app.vault.on("create", file => this.onCreate(file)))
  }

  async onCreate(file) {
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
  handleVariables(content, file) {
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
  async checkTemplate() {
    const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templatePath)

    if (!templateFile || !(templateFile instanceof TFile)) {
      return Promise.reject(`Template file not found: ${this.settings.templatePath}`)
    }

    return Promise.resolve(templateFile)
  }

  /**
   * 读取模板内容
   */
  async getTemplateContent(file) {
    return await this.app.vault.read(file)
  }

  /**
   * 合并设置
   */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  /**
   * 保存设置
   */
  async saveSettings() {
    await this.saveData(this.settings)
  }
}

class AutoTemplateSettingTab extends PluginSettingTab {
  plugin

  constructor(app, plugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl("h2", { text: "Auto Template Settings" })

    new Setting(containerEl)
      .setName("模板路径")
      .setDesc("Path to the template file (e.g. _templates/default.md)")
      .addText(text =>
        text
          .setPlaceholder("Enter template path")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async value => {
            this.plugin.settings.templatePath = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl).setName("是否开启").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.enabled).onChange(async value => {
        this.plugin.settings.enabled = value
        await this.plugin.saveSettings()
      })
    )
  }
}
