# IDI Studios

The official website for IDI Studios, the independent game studio behind **Conquest: Ascension**.

## Local development

This project uses npm and Wrangler, matching Cloudflare Workers conventions.

```powershell
npm install
npm run dev
```

## Production

```powershell
npm run build
npm run preview
```

Deploy to the Cloudflare account configured in Wrangler:

```powershell
npm run deploy
```

For a Worker-only local session or generated binding types:

```powershell
npm run cf:dev
npm run cf:types
```

Cloudflare dashboard settings:

- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Node.js version: `22.13.0` or newer
- Wrangler configuration: `wrangler.jsonc`

Primary domain: `idistudios.io`
