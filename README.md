# ID Photo Studio

Batch-process photos for ID cards in the browser. For each photo it:

1. Finds the face, centres it and levels a tilted head
2. Crops to a print size (default 4.5 × 5 in at 300 dpi, giving 1350 × 1500 px)
3. Makes a circle PNG with transparent corners
4. Enhances brightness, contrast, colour and sharpness

Save one photo at a time or everything as a ZIP. Photos never leave the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## How it's put together

| Path | What it does |
| --- | --- |
| `src/components/Studio.tsx` | Page state: the photo queue, face finding, saving |
| `src/components/PhotoCard.tsx` | One proof: preview, drag to nudge, zoom, save |
| `src/components/SettingsPanel.tsx` | Print size, framing, output and enhance settings |
| `src/lib/settings.ts` | Settings, saved to `localStorage` |
| `src/lib/faceFinder.ts` | Loads face-api and finds eyes and chin |
| `src/lib/geometry.ts` | Places the head in the frame |
| `src/lib/enhance.ts` | Auto levels, face-based gamma, saturation, unsharp mask |
| `src/lib/images.ts` | Decoding, full-size render, JPG and PNG output |
| `src/lib/printDpi.ts` | Writes the dpi into JPG (JFIF) and PNG (pHYs) files |
| `public/models/` | Face detection (SSD MobileNet v1) and 68-point landmark weights |

Framing: the head (crown to chin) fills the **Head height** share of the photo, with **Space above head** above the crown. The crown is estimated from the eye-to-chin distance, since the eyes sit near the middle of the head.

Chrome can't decode HEIC, so convert iPhone photos to JPG first or use Safari.
