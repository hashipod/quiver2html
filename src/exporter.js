const fs = require("fs-extra")
const sysPath = require("path")
const MarkdownIt = require("markdown-it")
const md = new MarkdownIt()

const TEMPLATE_DIR = sysPath.join(__dirname, "template")
const HTML_TEMPLATE_FILE = sysPath.join(TEMPLATE_DIR, "index.html")
const HTML_TEMPLATE = fs.readFileSync(HTML_TEMPLATE_FILE, { encoding: "utf8" })

const htmlEscape = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const exportNoteAsHTML = function (noteDir, outputDir) {
  try {
    var meta = JSON.parse(fs.readFileSync(sysPath.join(noteDir, "meta.json")))
    var content = JSON.parse(fs.readFileSync(sysPath.join(noteDir, "content.json")))
  } catch {
    console.log(noteDir + " has no valid meta.json or content.json")
    return;
  }

  const { title, created_at, updated_at, uuid, tags } = meta
  let s = ""
  for (let c of content.cells) {
    switch (c.type) {
      case "text":
        s += `<div class='cell text-cell'>${c.data.replace(/quiver-image-url/gi, "resources")}</div>`
        break
      case "code":
        s += `<pre class='cell code-cell'><code>${htmlEscape(c.data)}</code></pre>`
        break
      case "markdown":
        s += `<div class='cell markdown-cell'>${md.render(c.data.replace(/quiver-image-url/gi, "resources"))}</div>`
        break
      case "latex":
        s += `<div class='cell latex-cell'>${c.data}</div>`
        break
    }
  }

  let html = HTML_TEMPLATE.replace("{{title}}", title).replace("{{content}}", s)
  // insert front matters
  html = html.replace("{{fm-title}}", title)
  html = html.replace("{{fm-created-at}}", created_at)
  html = html.replace("{{fm-updated-at}}", updated_at)
  html = html.replace("{{fm-uuid}}", uuid)
  html = html.replace("{{fm-tags}}", tags.join(","))

  let noteName = (meta.title || meta.uuid).replaceAll("/", ":")
  // make sure it's not a hidden file.
  if (noteName.startsWith(".")) {
    noteName = "Note:" + noteName
  }
  const htmlDir = sysPath.join(outputDir, noteName)
  if (!fs.existsSync(htmlDir)) { fs.mkdirSync(htmlDir) }
  fs.writeFileSync(sysPath.join(htmlDir, "index.html"), html)

  // Copy resources
  const resourcesDir = sysPath.join(noteDir, "resources")
  if (fs.existsSync(resourcesDir)) {
    fs.copySync(resourcesDir, sysPath.join(htmlDir, "resources"))
  }
}

const exportAsHTML = function (path, outputDir) {
  const dir = sysPath.resolve(path)
  if (outputDir == null) { outputDir = process.cwd() }

  switch (sysPath.extname(dir)) {
    case ".qvlibrary":
      try {
        var library = JSON.parse(fs.readFileSync(sysPath.join(dir, "meta.json")))
      } catch {
        console.log(dir + ".qvlibrary has no valid meta.json")
        break;
      }
      const notebooks = library.children || []
      notebooks.forEach(notebook => {
        const notebookDir = sysPath.join(dir, notebook.uuid + ".qvnotebook")
        console.log("notebookDir: %s", notebookDir)
        exportAsHTML(notebookDir, outputDir)
      });
      break
    case ".qvnotebook":
      try {
        var notebook = JSON.parse(fs.readFileSync(sysPath.join(dir, "meta.json")))
        if (!notebook.name) {
          notebook.name = notebook.uuid
        }
      } catch {
        console.log(dir + ".qvnotebook notebook has no valid meta.json")
        break
      }

      outputDir = sysPath.join(outputDir, notebook.name.replaceAll("/", ":"))
      if (!fs.existsSync(outputDir)) { fs.mkdirSync(outputDir) }

      var files = fs.readdirSync(dir)
      for (let file of files) {
        const noteDir = sysPath.join(dir, file)
        if (sysPath.extname(noteDir) === ".qvnote") {
          exportNoteAsHTML(noteDir, outputDir)
        }
      }
      break
    case ".qvnote":
      exportNoteAsHTML(dir, outputDir)
      break
  }
}

module.exports = { exportAsHTML }
