npm run build

if ("obsidian-auto-template.zip" | path exists) {
  rm obsidian-auto-template.zip
}

cp main.js ./obsidian-auto-template
cp manifest.json ./obsidian-auto-template
cp styles.css ./obsidian-auto-template

7z a -tzip -r obsidian-auto-template.zip ./obsidian-auto-template
