import * as PIXI from 'pixi.js'

const CRTMASK_TEX_SIZE: number = 32

const vertex = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;

varying vec2 vTextureCoord;

void main(void) {
  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
  vTextureCoord = aTextureCoord;
}
`

const fragment = `
varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform vec4 filterArea;

uniform sampler2D mask;
uniform vec2 size;
uniform vec2 offset;
uniform vec2 scale;
uniform vec2 curve;

#define M_PI 3.1415926535897932384626433832795
#define CLEARNESS .333333

vec2 mapCoord(vec2 coord) {
  coord *= filterArea.xy;
  coord += filterArea.zw;
  return coord;
}

vec2 unmapCoord(vec2 coord) {
  coord -= filterArea.zw;
  coord /= filterArea.xy;
  return coord;
}

void main(void) {
  vec2 pos = mapCoord(vTextureCoord) - offset;          // XY on real view
  vec2 coord = pos / size * 2.0 - 1.0;                  // UV on real view [-1, 1]
  coord /= 1.0 - curve * coord.yx * coord.yx;           // UV on curved real view [-1, 1]
  vec2 coord2 = (coord * .5 + .5) * scale;              // UV on curved virtual screen [0, 1]
  vec2 pos2 = coord2 * size;                            // XY on curved virtual screen
  pos2.x += cos(pos2.y * M_PI * 1.0) * .125;            // make wave
  vec2 maskCoord = pos2 * vec2(1.5, 1.0);               // UV on mask image
  vec2 pos2nn = floor(pos2) + vec2(.5,.5);              // nearest neighbor XY
  pos2 = pos2 * (1.0 - CLEARNESS) + pos2nn * CLEARNESS; // merge nearest neighbor XY
  gl_FragColor = texture2D(uSampler, unmapCoord(pos2)) * texture2D(mask, maskCoord);
}
`

export interface TubeFilterUniform {
  mask: PIXI.Texture
  size: PIXI.Point
  offset: PIXI.Point
  scale: PIXI.Point
  curve: PIXI.Point
}

/**
 * Tube (CRT) filter for PixiJS.
 *
 * The virtual screen (content that just you want to draw)
 * must be drawn on the area (0, 0) - (virtualWidth, virtualHeight)
 * in the real application view.
 * It will be stretched and fitted to the whole real view.
 *
 * Some sprites will be added on the stage to draw corner rounds
 * and invalidate the whole view.
 *
 * invalidate() must be called from every animation frame
 * to render the whole view.
 *
 * resize() must be called when the application view is resized.
 */
export default class TubeFilter extends PIXI.Filter<TubeFilterUniform> {

  private stage: PIXI.Container
  private virtualWidth: number
  private virtualHeight: number
  private realWidth: number
  private realHeight: number
  private invalidators: PIXI.Graphics[]

  /**
   * Construct a new TubeFilter.
   *
   * @param stage Application stage
   * @param virtualWidth Width of the virtual screen
   * @param virtualHeight Height of the virtual screen
   * @param realWidth Width of the real view
   * @param realHeight Height of the real view
   * @param curve Curvature
   * @param cornerSize Radius of the corner rounds on the virtual screen
   * @param mask Mask texture
   */
  constructor (
    stage: PIXI.Container,
    virtualWidth: number, virtualHeight: number,
    realWidth: number, realHeight: number,
    curve: number = 20.0, cornerSize: number = 16, mask?: PIXI.Texture
  ) {
    super(vertex, fragment)
    this.stage = stage
    this.virtualWidth = virtualWidth
    this.virtualHeight = virtualHeight
    this.uniforms.mask = mask || TubeFilter.crtMask()
    this.curve = curve

    this.invalidators = []
    for (let i = 0; i < 2; i++) {
      const g = new PIXI.Graphics()
      g.beginFill(0, 1.0 / 255)
      g.drawRect(0, 0, 1, 1)
      g.endFill()
      stage.addChild(g)
      this.invalidators.push(g)
    }

    const corners = TubeFilter.cornerRound(cornerSize, 4)
    for (let corner of corners) {
      stage.addChild(corner)
    }
    corners[0].position.set(0, 0)
    corners[1].position.set(this.virtualWidth, 0)
    corners[2].position.set(0, this.virtualHeight)
    corners[3].position.set(this.virtualWidth, this.virtualHeight)

    this.resize(realWidth, realHeight)
  }

  /**
   * Create a new CRT mask to specify to TubeFilter constructor.
   *
   * @param edge Edge sharpness of color boundary
   * @param overlap Overlap ratio of color boundary
   * @param scanlineEdge Edge sharpness of scanlines
   * @param scanlineThickness Thickness of scanlines
   */
  static crtMask (
    edge: number = .15, overlap: number = 3.0,
    scanlineEdge: number = 0.25, scanlineThickness: number = 0.15
  ): PIXI.Texture {
    let size = CRTMASK_TEX_SIZE
    let canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    let ctx = canvas.getContext('2d')
    let imgData = ctx.createImageData(size, size)

    //   M  R  Y  G  C  B
    // R  ￣ ￣ ＼ ＿ ＿ ／
    // G  ＿ ／ ￣ ￣ ＼ ＿
    // B  ＼ ＿ ＿ ／ ￣ ￣
    let i = 0
    for (let ix = 0; ix < size; ix++) {
      let x = ix as number / (size - 1)
      let r = x + (1.0 / 3.0); r -= Math.floor(r)
      let g = x + (0.0 / 3.0); g -= Math.floor(g)
      let b = x + (2.0 / 3.0); b -= Math.floor(b)
      r = (1.5 - Math.abs(r - 0.5) * 6.0 + overlap) * edge + 0.5
      g = (1.5 - Math.abs(g - 0.5) * 6.0 + overlap) * edge + 0.5
      b = (1.5 - Math.abs(b - 0.5) * 6.0 + overlap) * edge + 0.5
      r = Math.max(0.0, Math.min(r, 1.0))
      g = Math.max(0.0, Math.min(g, 1.0))
      b = Math.max(0.0, Math.min(b, 1.0))
      for (let iy = 0; iy < size; iy++) {
        let y = iy as number / (size - 1)
        let off = (ix + iy * size) * 4
        let s = (scanlineEdge + 1.0 - scanlineThickness) - Math.abs(y - 0.5) * 2.0 * scanlineEdge
        s = Math.max(0.0, Math.min(s, 1.0))
        imgData.data[i++] = Math.round(255.0 * g * s)
        imgData.data[i++] = Math.round(255.0 * r * s)
        imgData.data[i++] = Math.round(255.0 * b * s)
        imgData.data[i++] = 255
      }
    }
    ctx.putImageData(imgData, 0, 0)
    const tex = PIXI.BaseTexture.fromCanvas(canvas)
    tex.wrapMode = PIXI.WRAP_MODES.REPEAT
    tex.scaleMode = PIXI.SCALE_MODES.LINEAR
    const result: PIXI.Texture = PIXI.Texture.from(tex)
    result.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT
    result.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR
    return result
  }

  /**
   * Create corner round sprites.
   *
   * @param size Size on the virtual screen
   * @param oversampling Oversampling coef
   */
  static cornerRound (size: number, oversampling: number = 1.0): PIXI.Sprite[] {
    size *= oversampling
    let canvas = document.createElement('canvas')
    canvas.width = size * 2
    canvas.height = size * 2
    let ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size * 2, size * 2)
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(size, size, size, 0, 2 * Math.PI, false)
    ctx.fill()
    ctx.closePath()

    let imgData = ctx.getImageData(0, 0, size * 2, size * 2)
    for (let i = 0; i < imgData.data.length; i += 4) {
      const a = imgData.data[i + 0]
      imgData.data[i + 0] = 0
      imgData.data[i + 1] = 0
      imgData.data[i + 2] = 0
      imgData.data[i + 3] = a
    }
    ctx.putImageData(imgData, 0, 0)

    const base = PIXI.BaseTexture.fromCanvas(canvas)
    base.wrapMode = PIXI.WRAP_MODES.REPEAT
    base.scaleMode = PIXI.SCALE_MODES.LINEAR

    const result: PIXI.Sprite[] = []
    result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(0, 0, size, size))))
    result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(size, 0, size, size))))
    result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(0, size, size, size))))
    result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(size, size, size, size))))
    result[0].anchor.set(0, 0)
    result[1].anchor.set(1, 0)
    result[2].anchor.set(0, 1)
    result[3].anchor.set(1, 1)
    result[0].scale.set(1.0 / oversampling)
    result[1].scale.set(1.0 / oversampling)
    result[2].scale.set(1.0 / oversampling)
    result[3].scale.set(1.0 / oversampling)
    return result
  }

  /**
   * invalidate() must be called from every animation frame
   * to render the whole view.
   */
  invalidate () {
    this.stage.removeChild(this.invalidators[0])
    this.stage.removeChild(this.invalidators[1])
    this.stage.addChild(this.invalidators[0])
    this.stage.addChild(this.invalidators[1])
  }

  /**
   * resize() must be called when the application view is resized.
   *
   * @param realWidth Width of the view
   * @param realHeight Height of the view
   * @param marginRatio Ratio of margin to the whole view
   */
  resize (realWidth: number, realHeight: number, marginRatio: number = .03) {
    const shrink = 1.0 - marginRatio
    let scaleX = shrink * realWidth / this.virtualWidth
    let scaleY = shrink * realHeight / this.virtualHeight
    const scale = Math.min(scaleX, scaleY)
    scaleX = scale
    scaleY = scale
    const viewWidth = this.virtualWidth * scaleX
    const viewHeight = this.virtualHeight * scaleY
    this.uniforms.size = new PIXI.Point(viewWidth, viewHeight)
    this.uniforms.scale = new PIXI.Point(1.0 / scaleX, 1.0 / scaleY)
    this.uniforms.offset = new PIXI.Point(
      (realWidth - viewWidth) * .5,
      (realHeight - viewHeight) * .5
    )
    this.invalidators[1].position.set(realWidth - 1, realHeight - 1)
    this.realWidth = realWidth
    this.realHeight = realHeight
  }

  /**
   * Translate a coord on the real view to the one on the virtual screen.
   *
   * @param x X coord on the real view
   * @param y Y coord on the real view
   * @returns Coord on the virtual screen
   */
  translatePos (x: number, y: number): PIXI.Point {
    const size = this.uniforms.size
    const offset = this.uniforms.offset
    const scale = this.uniforms.scale
    const curve = this.uniforms.curve
    x = x - offset.x
    y = y - offset.y
    const coord0X = x / size.x * 2.0 - 1.0
    const coord0Y = y / size.y * 2.0 - 1.0
    const coordX = coord0X / (1.0 - curve.x * coord0Y * coord0Y)
    const coordY = coord0Y / (1.0 - curve.y * coord0X * coord0X)
    const coord2X = (coordX * .5 + .5) * scale.x
    const coord2Y = (coordY * .5 + .5) * scale.y
    return new PIXI.Point(
      Math.round(coord2X * size.x),
      Math.round(coord2Y * size.y)
    )
  }

  /**
   * Curvature.
   */
  set curve (v: number) {
    this.uniforms.curve = new PIXI.Point(v / this.virtualWidth, v / this.virtualHeight)
  }

}
