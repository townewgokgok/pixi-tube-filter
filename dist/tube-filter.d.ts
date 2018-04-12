/// <reference types="pixi.js" />
import * as PIXI from 'pixi.js';
export interface TubeFilterUniform {
    mask: PIXI.Texture;
    size: PIXI.Point;
    offset: PIXI.Point;
    scale: PIXI.Point;
    curve: PIXI.Point;
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
    private stage;
    private virtualWidth;
    private virtualHeight;
    private realWidth;
    private realHeight;
    private invalidators;
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
    constructor(stage: PIXI.Container, virtualWidth: number, virtualHeight: number, realWidth: number, realHeight: number, curve?: number, cornerSize?: number, mask?: PIXI.Texture);
    /**
     * Create a new CRT mask to specify to TubeFilter constructor.
     *
     * @param edge Edge sharpness of color boundary
     * @param overlap Overlap ratio of color boundary
     * @param scanlineEdge Edge sharpness of scanlines
     * @param scanlineThickness Thickness of scanlines
     */
    static crtMask(edge?: number, overlap?: number, scanlineEdge?: number, scanlineThickness?: number): PIXI.Texture;
    /**
     * Create corner round sprites.
     *
     * @param size Size on the virtual screen
     * @param oversampling Oversampling coef
     */
    static cornerRound(size: number, oversampling?: number): PIXI.Sprite[];
    /**
     * invalidate() must be called from every animation frame
     * to render the whole view.
     */
    invalidate(): void;
    /**
     * resize() must be called when the application view is resized.
     *
     * @param realWidth Width of the view
     * @param realHeight Height of the view
     * @param marginRatio Ratio of margin to the whole view
     */
    resize(realWidth: number, realHeight: number, marginRatio?: number): void;
    /**
     * Translate a coord on the real view to the one on the virtual screen.
     *
     * @param x X coord on the real view
     * @param y Y coord on the real view
     * @returns Coord on the virtual screen
     */
    translatePos(x: number, y: number): PIXI.Point;
    /**
     * Curvature.
     */
    curve: number;
}
