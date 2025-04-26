// Obsidian not support ESM

async function load() {
  try {
    const ret = await import("./src/main.mjs")
    return ret
  } catch (error) {
    console.log("error:", error)
  }
}

module.exports = {
  default: load()
}
