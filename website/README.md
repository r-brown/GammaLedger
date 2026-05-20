# GammaLedger Website

Jekyll-powered marketing site for [GammaLedger](https://gammaledger.com).

## Setup

```bash
cd website
bundle install
bundle exec jekyll serve --livereload
```

Open http://localhost:4000

## Structure

```
website/
  _config.yml          Jekyll configuration
  Gemfile              Ruby dependencies
  index.html           Homepage
  blog/index.html      Blog listing (dynamic via Liquid)
  privacy.html         Privacy Policy
  terms.html           Terms of Service
  disclaimer.html      Risk Disclaimer
  _layouts/
    default.html       Base layout (wraps every page with nav + footer)
    post.html          Blog post layout
    page.html          Generic page layout
  _includes/
    head.html          <head> meta tags, SEO, fonts, stylesheets
    nav.html           Site navigation bar
    footer.html        Site footer
  _posts/              Blog posts — add new posts here as YYYY-MM-DD-slug.md
  assets/
    css/
      blog.css         Shared blog / article styles
      home.css         Homepage-specific styles
    img/               Images and icons
```

## Adding a Blog Post

Create a new file in `_posts/` named `YYYY-MM-DD-your-slug.md`:

```markdown
---
layout: post
title: "Your Post Title"
slug: your-slug
date: 2026-05-20
description: "One-sentence description for SEO and blog card."
tags: [options, strategy, guide]
image: /assets/img/gammaledger-stage-01.jpg
---

Your post content in Markdown (or HTML) here.
```

Push to `main` — GitHub Actions builds and deploys automatically.

## Deployment

Pushing any change under `website/` to `main` triggers the
`.github/workflows/website-deploy.yml` workflow, which:

1. Builds the Jekyll site
2. Copies the output to the root of the `gh-pages` branch
3. Preserves the `/app/` sub-directory (the live SPA)
4. Keeps the `CNAME` file so the custom domain stays live
