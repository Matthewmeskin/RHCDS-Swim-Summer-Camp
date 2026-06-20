# Public assets

## logo.png

`logo.png` is the official **Country Day Camp** badge (circular logo with tree,
sunset, water wave, and "Rolling Hills Country Day School" text). The app's
brand palette in `tailwind.config.ts` is sampled directly from this artwork.

To swap in a new version later:

1. Drop the new PNG in at `public/logo.png` (keep the filename).
2. That's it — the header and favicon both reference `/logo.png`.

(`scripts/genLogo.mjs` generates the old placeholder badge and is no longer
used, but is kept for reference.)
