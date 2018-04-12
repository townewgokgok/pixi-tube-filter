import * as PIXI from 'pixi.js'
import TubeFilter from 'pixi-tube-filter'

const virtualWidth = 256
const virtualHeight = 224
const aspect = 1.0

document.addEventListener('DOMContentLoaded', e => {

  const main = document.getElementsByTagName('main')[0] as HTMLMainElement
  main.innerHTML = ''
  const realWidth = main.clientWidth
  const realHeight = main.clientHeight

  const app = new PIXI.Application(realWidth, realHeight)
  main.appendChild(app.view)
  const root = new PIXI.Container()
  app.stage.addChild(root)

  const tubeFilter = new TubeFilter(app.stage, virtualWidth, virtualHeight, realWidth, realHeight)
  app.stage.filters = [tubeFilter]
  app.stage.cacheAsBitmap = false

  const bg = new PIXI.Graphics()
  root.addChild(bg)
  bg.beginFill(0x0000ff)
  bg.drawRect(0, 0, virtualWidth, virtualHeight)
  bg.endFill()
  const size = 16
  bg.beginFill(0xff0000)
  for (let row = 0; row < virtualHeight / size; row++) {
    for (let col = row % 2; col < virtualWidth / size; col += 2) {
      bg.drawRect(col * size, row * size, size, size)
    }
  }
  bg.endFill()

  const lines = new PIXI.Graphics()
  root.addChild(lines)

  function addLine (color: number) {
    lines.lineStyle(1, color)
    const x0 = Math.floor(Math.random() * virtualWidth)
    const y0 = Math.floor(Math.random() * virtualHeight)
    lines.moveTo(x0, y0)
    const x1 = Math.floor(Math.random() * virtualWidth)
    const y1 = Math.floor(Math.random() * virtualHeight)
    lines.lineTo(x1, y1)
  }

  const image = new PIXI.Sprite()
  root.addChild(image)

  let frame = 0
  app.ticker.add((deltaTime: number) => {
    if (frame % 60 === 0) {
      lines.clear()
    }
    addLine((0xffff00ffff >> (frame % 3) * 8) & 0xffffff)
    frame++
    tubeFilter.invalidate() // DO NOT FORGET THIS!
  })

  window.addEventListener('resize', e => {
    const w = main.clientWidth
    const h = main.clientHeight
    app.renderer.resize(w, h)
    tubeFilter.resize(w, h) // DO NOT FORGET THIS!
  })

})
  