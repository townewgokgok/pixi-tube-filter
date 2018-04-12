"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var PIXI = require("pixi.js");
var CRTMASK_TEX_SIZE = 32;
var vertex = "\nattribute vec2 aVertexPosition;\nattribute vec2 aTextureCoord;\n\nuniform mat3 projectionMatrix;\n\nvarying vec2 vTextureCoord;\n\nvoid main(void) {\n  gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);\n  vTextureCoord = aTextureCoord;\n}\n";
var fragment = "\nvarying vec2 vTextureCoord;\n\nuniform sampler2D uSampler;\nuniform vec4 filterArea;\n\nuniform sampler2D mask;\nuniform vec2 size;\nuniform vec2 offset;\nuniform vec2 scale;\nuniform vec2 curve;\n\n#define M_PI 3.1415926535897932384626433832795\n#define CLEARNESS .333333\n\nvec2 mapCoord(vec2 coord) {\n  coord *= filterArea.xy;\n  coord += filterArea.zw;\n  return coord;\n}\n\nvec2 unmapCoord(vec2 coord) {\n  coord -= filterArea.zw;\n  coord /= filterArea.xy;\n  return coord;\n}\n\nvoid main(void) {\n  vec2 pos = mapCoord(vTextureCoord) - offset;          // XY on real view\n  vec2 coord = pos / size * 2.0 - 1.0;                  // UV on real view [-1, 1]\n  coord /= 1.0 - curve * coord.yx * coord.yx;           // UV on curved real view [-1, 1]\n  vec2 coord2 = (coord * .5 + .5) * scale;              // UV on curved virtual screen [0, 1]\n  vec2 pos2 = coord2 * size;                            // XY on curved virtual screen\n  pos2.x += cos(pos2.y * M_PI * 1.0) * .125;            // make wave\n  vec2 maskCoord = pos2 * vec2(1.5, 1.0);               // UV on mask image\n  vec2 pos2nn = floor(pos2) + vec2(.5,.5);              // nearest neighbor XY\n  pos2 = pos2 * (1.0 - CLEARNESS) + pos2nn * CLEARNESS; // merge nearest neighbor XY\n  gl_FragColor = texture2D(uSampler, unmapCoord(pos2)) * texture2D(mask, maskCoord);\n}\n";
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
var TubeFilter = /** @class */ (function (_super) {
    __extends(TubeFilter, _super);
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
    function TubeFilter(stage, virtualWidth, virtualHeight, realWidth, realHeight, curve, cornerSize, mask) {
        if (curve === void 0) { curve = 20.0; }
        if (cornerSize === void 0) { cornerSize = 16; }
        var _this = _super.call(this, vertex, fragment) || this;
        _this.stage = stage;
        _this.virtualWidth = virtualWidth;
        _this.virtualHeight = virtualHeight;
        _this.uniforms.mask = mask || TubeFilter.crtMask();
        _this.curve = curve;
        _this.invalidators = [];
        for (var i = 0; i < 2; i++) {
            var g = new PIXI.Graphics();
            g.beginFill(0, 1.0 / 255);
            g.drawRect(0, 0, 1, 1);
            g.endFill();
            stage.addChild(g);
            _this.invalidators.push(g);
        }
        var corners = TubeFilter.cornerRound(cornerSize, 4);
        for (var _i = 0, corners_1 = corners; _i < corners_1.length; _i++) {
            var corner = corners_1[_i];
            stage.addChild(corner);
        }
        corners[0].position.set(0, 0);
        corners[1].position.set(_this.virtualWidth, 0);
        corners[2].position.set(0, _this.virtualHeight);
        corners[3].position.set(_this.virtualWidth, _this.virtualHeight);
        _this.resize(realWidth, realHeight);
        return _this;
    }
    /**
     * Create a new CRT mask to specify to TubeFilter constructor.
     *
     * @param edge Edge sharpness of color boundary
     * @param overlap Overlap ratio of color boundary
     * @param scanlineEdge Edge sharpness of scanlines
     * @param scanlineThickness Thickness of scanlines
     */
    TubeFilter.crtMask = function (edge, overlap, scanlineEdge, scanlineThickness) {
        if (edge === void 0) { edge = .15; }
        if (overlap === void 0) { overlap = 3.0; }
        if (scanlineEdge === void 0) { scanlineEdge = 0.25; }
        if (scanlineThickness === void 0) { scanlineThickness = 0.15; }
        var size = CRTMASK_TEX_SIZE;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var imgData = ctx.createImageData(size, size);
        //   M  R  Y  G  C  B
        // R  ￣ ￣ ＼ ＿ ＿ ／
        // G  ＿ ／ ￣ ￣ ＼ ＿
        // B  ＼ ＿ ＿ ／ ￣ ￣
        var i = 0;
        for (var ix = 0; ix < size; ix++) {
            var x = ix / (size - 1);
            var r = x + (1.0 / 3.0);
            r -= Math.floor(r);
            var g = x + (0.0 / 3.0);
            g -= Math.floor(g);
            var b = x + (2.0 / 3.0);
            b -= Math.floor(b);
            r = (1.5 - Math.abs(r - 0.5) * 6.0 + overlap) * edge + 0.5;
            g = (1.5 - Math.abs(g - 0.5) * 6.0 + overlap) * edge + 0.5;
            b = (1.5 - Math.abs(b - 0.5) * 6.0 + overlap) * edge + 0.5;
            r = Math.max(0.0, Math.min(r, 1.0));
            g = Math.max(0.0, Math.min(g, 1.0));
            b = Math.max(0.0, Math.min(b, 1.0));
            for (var iy = 0; iy < size; iy++) {
                var y = iy / (size - 1);
                var off = (ix + iy * size) * 4;
                var s = (scanlineEdge + 1.0 - scanlineThickness) - Math.abs(y - 0.5) * 2.0 * scanlineEdge;
                s = Math.max(0.0, Math.min(s, 1.0));
                imgData.data[i++] = Math.round(255.0 * g * s);
                imgData.data[i++] = Math.round(255.0 * r * s);
                imgData.data[i++] = Math.round(255.0 * b * s);
                imgData.data[i++] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        var tex = PIXI.BaseTexture.fromCanvas(canvas);
        tex.wrapMode = PIXI.WRAP_MODES.REPEAT;
        tex.scaleMode = PIXI.SCALE_MODES.LINEAR;
        var result = PIXI.Texture.from(tex);
        result.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
        result.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
        return result;
    };
    /**
     * Create corner round sprites.
     *
     * @param size Size on the virtual screen
     * @param oversampling Oversampling coef
     */
    TubeFilter.cornerRound = function (size, oversampling) {
        if (oversampling === void 0) { oversampling = 1.0; }
        size *= oversampling;
        var canvas = document.createElement('canvas');
        canvas.width = size * 2;
        canvas.height = size * 2;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size * 2, size * 2);
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(size, size, size, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.closePath();
        var imgData = ctx.getImageData(0, 0, size * 2, size * 2);
        for (var i = 0; i < imgData.data.length; i += 4) {
            var a = imgData.data[i + 0];
            imgData.data[i + 0] = 0;
            imgData.data[i + 1] = 0;
            imgData.data[i + 2] = 0;
            imgData.data[i + 3] = a;
        }
        ctx.putImageData(imgData, 0, 0);
        var base = PIXI.BaseTexture.fromCanvas(canvas);
        base.wrapMode = PIXI.WRAP_MODES.REPEAT;
        base.scaleMode = PIXI.SCALE_MODES.LINEAR;
        var result = [];
        result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(0, 0, size, size))));
        result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(size, 0, size, size))));
        result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(0, size, size, size))));
        result.push(new PIXI.Sprite(new PIXI.Texture(base, new PIXI.Rectangle(size, size, size, size))));
        result[0].anchor.set(0, 0);
        result[1].anchor.set(1, 0);
        result[2].anchor.set(0, 1);
        result[3].anchor.set(1, 1);
        result[0].scale.set(1.0 / oversampling);
        result[1].scale.set(1.0 / oversampling);
        result[2].scale.set(1.0 / oversampling);
        result[3].scale.set(1.0 / oversampling);
        return result;
    };
    /**
     * invalidate() must be called from every animation frame
     * to render the whole view.
     */
    TubeFilter.prototype.invalidate = function () {
        this.stage.removeChild(this.invalidators[0]);
        this.stage.removeChild(this.invalidators[1]);
        this.stage.addChild(this.invalidators[0]);
        this.stage.addChild(this.invalidators[1]);
    };
    /**
     * resize() must be called when the application view is resized.
     *
     * @param realWidth Width of the view
     * @param realHeight Height of the view
     * @param marginRatio Ratio of margin to the whole view
     */
    TubeFilter.prototype.resize = function (realWidth, realHeight, marginRatio) {
        if (marginRatio === void 0) { marginRatio = .03; }
        var shrink = 1.0 - marginRatio;
        var scaleX = shrink * realWidth / this.virtualWidth;
        var scaleY = shrink * realHeight / this.virtualHeight;
        var scale = Math.min(scaleX, scaleY);
        scaleX = scale;
        scaleY = scale;
        var viewWidth = this.virtualWidth * scaleX;
        var viewHeight = this.virtualHeight * scaleY;
        this.uniforms.size = new PIXI.Point(viewWidth, viewHeight);
        this.uniforms.scale = new PIXI.Point(1.0 / scaleX, 1.0 / scaleY);
        this.uniforms.offset = new PIXI.Point((realWidth - viewWidth) * .5, (realHeight - viewHeight) * .5);
        this.invalidators[1].position.set(realWidth - 1, realHeight - 1);
        this.realWidth = realWidth;
        this.realHeight = realHeight;
    };
    /**
     * Translate a coord on the real view to the one on the virtual screen.
     *
     * @param x X coord on the real view
     * @param y Y coord on the real view
     * @returns Coord on the virtual screen
     */
    TubeFilter.prototype.translatePos = function (x, y) {
        var size = this.uniforms.size;
        var offset = this.uniforms.offset;
        var scale = this.uniforms.scale;
        var curve = this.uniforms.curve;
        x = x - offset.x;
        y = y - offset.y;
        var coord0X = x / size.x * 2.0 - 1.0;
        var coord0Y = y / size.y * 2.0 - 1.0;
        var coordX = coord0X / (1.0 - curve.x * coord0Y * coord0Y);
        var coordY = coord0Y / (1.0 - curve.y * coord0X * coord0X);
        var coord2X = (coordX * .5 + .5) * scale.x;
        var coord2Y = (coordY * .5 + .5) * scale.y;
        return new PIXI.Point(Math.round(coord2X * size.x), Math.round(coord2Y * size.y));
    };
    Object.defineProperty(TubeFilter.prototype, "curve", {
        /**
         * Curvature.
         */
        set: function (v) {
            this.uniforms.curve = new PIXI.Point(v / this.virtualWidth, v / this.virtualHeight);
        },
        enumerable: true,
        configurable: true
    });
    return TubeFilter;
}(PIXI.Filter));
exports.default = TubeFilter;
//# sourceMappingURL=tube-filter.js.map