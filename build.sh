#!/usr/bin/env bash
# Builds dist/ from site/.
#  - Stamps the "Updated" date in the footer and the sitemap from the last commit.
#  - Replaces ?v=dev on asset URLs with the commit hash, so _headers can cache
#    assets forever and a new deploy still picks up changes.
# Used as the Cloudflare build command (output directory: dist).
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
cp -R site dist

date=$(git log -1 --format=%cs 2>/dev/null || date -u +%F)
version=$(git rev-parse --short HEAD 2>/dev/null || date -u +%s)
months=(January February March April May June July August September October November December)
year=${date:0:4}
month=${date:5:2}
month_name=${months[10#$month - 1]}

find dist -type f \( -name '*.html' -o -name '*.css' -o -name '*.webmanifest' \) -print0 |
  xargs -0 perl -pi -e "s/\?v=dev\b/?v=$version/g"

perl -pi -e "s|<time datetime=\"[^\"]*\">[^<]*</time>|<time datetime=\"$year-$month\">$month_name $year</time>|" dist/index.html
perl -pi -e "s|<lastmod>[^<]*</lastmod>|<lastmod>$date</lastmod>|" dist/sitemap.xml

echo "Built dist/ (version $version, updated $month_name $year)"
