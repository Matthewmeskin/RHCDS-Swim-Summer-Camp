# Public assets

## camp-logo.png

`camp-logo.png` is the official **Country Day Camp** badge (circular logo with
tree, sunset, water wave, and "Rolling Hills Country Day School" text). The
app's brand palette in `tailwind.config.ts` is sampled directly from this
artwork.

To swap in a new version later:

1. Drop the new PNG in at `public/camp-logo.png` (keep the filename), **or** use
   a new filename and bump the references in `components/Nav.tsx`,
   `app/layout.tsx` (favicon), `app/page.tsx`, and
   `app/instructor/[slug]/InstructorView.tsx`. Using a new filename guarantees
   browsers/CDNs don't serve a stale cached copy.
2. The header and favicon both reference `/camp-logo.png`.

(`scripts/genLogo.mjs` generates the old placeholder badge and is no longer
used, but is kept for reference.)
