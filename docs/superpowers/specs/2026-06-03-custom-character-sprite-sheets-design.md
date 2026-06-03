# Design Specification: Animated Character Sprite Sheet Uploads

This design document specifies the architecture and implementation details for upgrading the custom image upload feature. Currently, uploading a custom character results in a static image. We will enable users to upload a Character Sprite Sheet, slice it dynamically into a grid of columns and rows, map individual cells to specific character states (running, ducking, jumping, crashed), and render these frames as active animations in the game.

## Goals
* **Animated Custom Skins:** Replace static custom character images with fully animated frames sliced from user-uploaded sprite sheets.
* **Flexible Layout Mapping:** Allow users to define custom rows and columns for their sprite sheets.
* **Visual Frame Mapping:** Provide a visual grid overlay showing cell indices so users can easily select which cell corresponds to each character state using simple dropdown selects.
* **Seamless Animation Previews:** Update the live preview canvas in the modal to immediately animate the character according to the selected cell mappings.
* **State Persistence:** Save the sprite sheet settings (enable state, dimensions, and frame maps) to `localStorage` along with the image base64 data so their custom animated character is restored on page load.
* **Consistent Physics:** Scale custom frames to match the standard character sizes (44x48 for running/jumping/crashed and 55x28 for ducking) to maintain balanced gameplay hitboxes.

## System Design & Architecture

### 1. Data Model (`characterConfig`)
The character's configuration object in `game.js` will expand to include a sub-config for sprite sheets:

```javascript
let characterConfig = {
  skin: 'classic',              // 'classic' | 'robot' | 'ghost' | 'neon' | 'custom_image'
  bodyColor: null,              // Theme color override
  accentColor: null,            // Theme accent override
  customImage: null,            // HTMLImageElement instance
  customImageDataUrl: null,     // Base64 string for saving
  spriteSheet: {
    enabled: false,             // True if sprite sheet mapping is active
    rows: 2,                    // Rows in the grid
    cols: 4,                    // Columns in the grid
    frameMap: {                 // Mapping of character states to 0-based cell indices
      running_0: 0,             // Run Frame 1
      running_1: 1,             // Run Frame 2
      jumping: 0,               // Jump Frame
      ducking_0: 2,             // Duck Frame 1
      ducking_1: 3,             // Duck Frame 2
      crashed: 4                // Crash Frame
    }
  }
};
```

### 2. Slicing & Rendering Logic
In `game.js`, the internal renderer `_drawDinoWithSkin` will handle slicing.
When drawing the custom character with an active sprite sheet configuration, the renderer will:
1. Fetch the mapped cell index based on the current character `state` (e.g. `running_0`).
2. Calculate the width and height of a single cell:
   $$\text{cellWidth} = \frac{\text{customImage.width}}{\text{cols}}$$
   $$\text{cellHeight} = \frac{\text{customImage.height}}{\text{rows}}$$
3. Determine the top-left coordinate of the cell within the sprite sheet source image:
   $$\text{cellX} = (\text{cellIndex} \bmod \text{cols}) \times \text{cellWidth}$$
   $$\text{cellY} = \lfloor \text{cellIndex} / \text{cols} \rfloor \times \text{cellHeight}$$
4. Call `ctx.drawImage` to paint only the sliced portion onto the destination bounding box:
   ```javascript
   ctx.drawImage(
     characterConfig.customImage,
     cellX, cellY, cellWidth, cellHeight,
     x, y, w, h
   );
   ```

### 3. UI Flow & State Syncing
* **Image Uploaded:** When a user drops or selects an image in the **Upload** tab, the preview displays the custom image.
* **Toggle Sprite Sheet:** Toggling "Use as animated sprite sheet" reveals the row/col controls, the visual grid preview, and the dropdown selectors.
* **Row/Col Controls:** Modifying rows or columns recalculates total cells, updates the dashed overlay lines, repopulates the dropdown menus with options (e.g., "Cell 0", "Cell 1"), and updates the live preview.
* **Mapping Dropdowns:** Selecting a cell for a state immediately re-maps `spriteSheet.frameMap` and updates the active live preview.
* **Persistence:** The custom image, enable state, rows/cols values, and frame mappings are stored together in `localStorage` when clicking "Apply" / "Save".

---

## Proposed Changes

### [HTML] [index.html](file:///Users/kine/Downloads/Game/index.html)
* Replace the `#upload-preview-wrapper` block under the Upload tab with the comprehensive editor layout containing:
  * Checkbox toggle (`#spritesheet-enable`)
  * Container `#spritesheet-options` (collapsible)
  * Two numeric inputs (`#spritesheet-rows` and `#spritesheet-cols`)
  * Visual image container `#grid-preview-wrapper` containing:
    * The sprite sheet image (`#upload-preview-img`)
    * The overlay grid container (`#grid-overlay`)
  * Mapping form with six dropdown selects for:
    * `map-run-0` (Running 1)
    * `map-run-1` (Running 2)
    * `map-jump` (Jumping)
    * `map-duck-0` (Ducking 1)
    * `map-duck-1` (Ducking 2)
    * `map-crash` (Crashed)
  * Remove button `#remove-custom-image`

### [CSS] [style.css](file:///Users/kine/Downloads/Game/style.css)
Add modern CSS styles to structure the customization view:
* **`.sprite-editor-panel`**: Outer layout container.
* **`.editor-main-layout`**: Side-by-side split layout (grid preview on left, dropdown form on right) for desktops, stacked columns for mobile viewports.
* **`.image-overlay-container`**: Position relative wrapper.
* **`.grid-overlay`**: Position absolute matching image dimensions. Displayed as a CSS Grid using variable-driven row/col sizing (`grid-template-rows: repeat(var(--rows), 1fr); grid-template-columns: repeat(var(--cols), 1fr);`).
* **`.grid-cell-label`**: Cell overlay styling featuring thin dashed borders (`1px dashed rgba(...)`) and a high-contrast glowing text label centered in the cell showing the cell index.
* **`.num-input`, `.map-select`**: Retro-modern styling to match the game dashboard selects.

### [JavaScript] [game.js](file:///Users/kine/Downloads/Game/game.js)
Modify the customization and drawing state:
* Update `characterConfig` default structure with the `spriteSheet` configuration.
* Update `loadCharacterConfig()` to parse and load the `spriteSheet` object, fallback if missing.
* Update `saveCharacterConfig()` to save the `spriteSheet` object.
* Update `_drawDinoWithSkin` to slice the custom sprite sheet image if `spriteSheet.enabled` is true.
* Update `applyUploadedImage` to handle initialization of the sprite sheet settings if a new image is loaded.
* Update `initCustomizationModal()`:
  * Cache references to new DOM inputs (checkbox, rows, cols, selects, grid overlay).
  * Add event listeners for checkbox toggle, dimensions inputs, and dropdown selectors.
  * Implement `_updateVisualGridOverlay()` which generates cell elements and fills select dropdowns based on the row/column dimensions.
* Update `_syncModalToConfig()`:
  * Read settings from `characterConfig.spriteSheet` to sync inputs, checkboxes, generate the grid, and select active mappings.
* Update `_drawPreviewCanvas()`:
  * Ensure the preview render loop calls `_drawDinoWithSkin` which automatically draws the running frame sequence using the mapped cells, providing immediate visual animation.

---

## Verification Plan

### Manual Verification
1. **Upload Sprite Sheet:**
   * Open the customization modal, select the "Upload" tab.
   * Upload an image (e.g. a grid of character frames).
   * Check "Use as animated sprite sheet". Verify that the options panel expands.
2. **Dimension Tweaks:**
   * Change Rows and Columns to `2` and `4`. Verify the visual grid overlay draws dashed boxes dividing the image into 8 cells, numbered `0` to `7`.
   * Increase columns. Verify the overlays update instantly and the selects automatically populate with the new cell counts.
3. **Map Frames:**
   * Set Run 1 to Cell 0, Run 2 to Cell 1. Verify that the running animation in the Live Preview updates in real-time.
   * Toggle through states in the mapping (Duck 1, Duck 2, Jump, Crash) and verify no script exceptions are thrown.
4. **Save & Reload:**
   * Click "Apply". Play the game. Verify the custom animated skin is rendered running, jumping, and ducking.
   * Refresh the page. Verify the character custom skin and its sprite sheet config persist.
5. **Reset:**
   * Open modal, click "Reset". Verify all custom skins and local storage entries are deleted, resetting back to the classic skin.
