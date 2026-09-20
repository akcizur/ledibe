# BYLDR Studio — bb3005 Engine

React + TypeScript + Three.js building sandbox based on the uploaded remix project.

## Included

- First-person WASD + mouse/touch navigation
- Brick placement, removal, rotation and undo
- Brick palette and color selection
- Mobile virtual joystick
- Procedural ABS-style brick geometry
- SSAO
- Screen-space reflections (SSR)
- Subtle Bokeh depth of field
- Linear distance fog synchronized with the studio background
- ACES filmic tone mapping
- Dynamic sun angle / orbit controls
- Dark/light UI

## Development

Node.js 22+ recommended.

```bash
npm install
npm run dev
```

The Vite development server runs on port 3000.

## Build

```bash
npm run build
```

The repository is intentionally frontend-only and does not require a database.
