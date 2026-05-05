# Combat Arena Web

A GitHub Pages-ready HTML5 canvas survival shooter built with plain HTML, CSS, and JavaScript.

> Note: This is an original browser implementation. It does not include decompiled code, proprietary assets, or copied content from the uploaded JAR file.

## Files

```text
combat_web_game/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── game.js
├── assets/
└── README.md
```

## How to run locally

Open `index.html` directly in a browser, or use a local server:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## Controls

- Move: `WASD` or `Arrow Keys`
- Aim: Mouse
- Shoot: Click / Tap Fire
- Reload: `R`
- Pause: `P` or `Esc`

## How to host on GitHub Pages

1. Create a new GitHub repository.
2. Upload all files from this folder.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root` folder.
6. Save and wait for GitHub to publish the site.

## Customization ideas

- Replace canvas-drawn objects with your own original sprites.
- Add new enemy types, maps, missions, and weapons in `js/game.js`.
- Adjust colors and layout in `css/style.css`.
