# PWA Icon Requirements

## Required Icon Files

Place these files in the `public/` directory before deploying the PWA:

### 1. Main PWA Icons
- **pwa-192x192.png** - 192x192 pixels, PNG format
- **pwa-512x512.png** - 512x512 pixels, PNG format

These icons are used for:
- Home screen icon when PWA is installed
- Splash screen on mobile devices
- App icon in PWA installation prompts

### 2. Additional Icons (Optional but Recommended)
- **favicon.ico** - 32x32 or 16x16 pixels, ICO format
- **apple-touch-icon.png** - 180x180 pixels, PNG format (for iOS)
- **masked-icon.svg** - Monochrome SVG (for Safari pinned tabs)

## Icon Specifications

### Design Guidelines
1. **Solid Background**: Use a solid background color (avoid transparency for main icons)
2. **Safe Zone**: Keep important content within 80% of the icon area
3. **High Contrast**: Ensure icon is visible on various background colors
4. **Simple Design**: Icon should be recognizable at small sizes (48x48)
5. **Maskable**: For Android adaptive icons, important content should be in the center 66% circle

### Recommended Tools

#### Online Generators
1. **PWA Builder** (Recommended)
   - URL: https://www.pwabuilder.com/imageGenerator
   - Upload one image, generates all sizes
   - Supports maskable icons

2. **RealFaviconGenerator**
   - URL: https://realfavicongenerator.net/
   - Comprehensive icon generator
   - Preview on various platforms

3. **Favicon.io**
   - URL: https://favicon.io/
   - Simple and fast
   - Generates from text, emoji, or image

#### Manual Creation (Advanced)
- **Photoshop/GIMP**: Create custom icons with layers
- **Figma/Sketch**: Design system-first approach
- **Inkscape**: Vector-based icon creation

## Generation Steps (PWA Builder Example)

1. Prepare your logo/icon:
   - Minimum 512x512 pixels
   - Square aspect ratio
   - High quality PNG or SVG

2. Go to https://www.pwabuilder.com/imageGenerator

3. Upload your image

4. Configure settings:
   - Platform: All
   - Padding: 0-10% (adjust based on design)
   - Background color: `#0a0a1a` (CBP dark theme)

5. Download the generated package

6. Extract and copy files to `public/` directory:
   ```
   public/
   ├── pwa-192x192.png
   ├── pwa-512x512.png
   ├── favicon.ico
   ├── apple-touch-icon.png
   └── masked-icon.svg
   ```

## Placeholder Icons (Development Only)

For development/testing without final icons, you can create placeholder icons:

### Using ImageMagick (if installed)
```bash
# Generate 192x192 placeholder
convert -size 192x192 xc:#0a0a1a -pointsize 60 -fill white -gravity center \
  -annotate +0+0 "CBP" public/pwa-192x192.png

# Generate 512x512 placeholder
convert -size 512x512 xc:#0a0a1a -pointsize 180 -fill white -gravity center \
  -annotate +0+0 "CBP" public/pwa-512x512.png
```

### Using Online Tools
1. Go to https://via.placeholder.com/
2. Generate:
   - `https://via.placeholder.com/192x192/0a0a1a/ffffff?text=CBP`
   - `https://via.placeholder.com/512x512/0a0a1a/ffffff?text=CBP`
3. Save as `pwa-192x192.png` and `pwa-512x512.png`

## Verification

After adding icons, verify they work:

1. **Build and Preview**:
   ```bash
   bun run build
   bun run preview
   ```

2. **Check Manifest**:
   - Open http://localhost:27100/manifest.json
   - Verify icon paths are correct

3. **Test Installation**:
   - Open in Chrome
   - Look for "Install" icon in address bar
   - Install and check home screen icon

4. **DevTools Audit**:
   - F12 > Lighthouse tab
   - Run PWA audit
   - Check "Installable" section

## Current Status

- [ ] pwa-192x192.png - **MISSING**
- [ ] pwa-512x512.png - **MISSING**
- [ ] favicon.ico - **MISSING**
- [ ] apple-touch-icon.png - **MISSING**
- [ ] masked-icon.svg - **MISSING**

**Action Required**: Generate and add these icon files before deploying to production.

## Brand Colors

Use these CBP brand colors for icon backgrounds:
- Dark theme: `#0a0a1a`
- Light theme: `#ffffff`
- Accent: TBD (check design system)

## Support

For questions about icon generation or design guidelines, contact the design team or refer to the CBP design system documentation.
