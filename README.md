SHILPMUN 2026 Seating - static site (no build step)

Deploy on Vercel:
  1. Install the CLI once:  npm i -g vercel
  2. In this folder run:    vercel --prod
  Choose "Other" if asked for a framework. Leave build command and output directory empty.
Or drag this folder onto https://vercel.com/new

Privacy: the page lists delegate names and schools. robots.txt, a noindex tag and an
X-Robots-Tag header (vercel.json) ask search engines not to index it, but anyone with the
link can open it. Turn on Vercel "Deployment Protection" if you want it behind a login.

## Rebuilding the data

`scripts/build_data.py <workbook.xlsx> <photo> <out.json> <out.txt>` regenerates the seating data from the delegate workbook (not stored in this repo).
