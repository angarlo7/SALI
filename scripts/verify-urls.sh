#!/bin/bash
# Fetches every sitemap URL and asserts: HTTP 200, no redirect, and the page's
# canonical equals the URL it was served at. Guards against the .html canonical
# loop that kept SALI out of Google until 6 Sep 2026.
set -u
SITE="${1:-https://sali.angarlo.com}"
fail=0
for loc in $(curl -s "$SITE/sitemap.xml?cb=$RANDOM" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'); do
  code=$(curl -s -o /tmp/vu.html -w '%{http_code}' "$loc?cb=$RANDOM")
  canon=$(grep -o '<link rel="canonical" href="[^"]*"' /tmp/vu.html | sed 's/.*href="//;s/"$//')
  if [ "$code" != "200" ]; then echo "FAIL $code  $loc"; fail=1
  elif [ "$canon" != "$loc" ]; then echo "FAIL canonical mismatch  $loc  ->  $canon"; fail=1
  else echo "ok   $loc"; fi
done
exit $fail
