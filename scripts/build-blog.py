#!/usr/bin/env python3
"""
Blog Build Script for GammaLedger

Generates individual SEO-friendly HTML pages for each blog post from Markdown files.
Produces clean URLs: /blog/{post-id}/ (each post gets its own directory with index.html)

Usage:
    pip install markdown
    python scripts/build-blog.py

Source files (maintained by authors):
    - blog/posts.json          (post metadata)
    - blog/posts/*.md          (post content in Markdown)

Generated files (committed to repo):
    - blog/{post-id}/index.html  (individual post pages)
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import markdown
except ImportError:
    print("Error: 'markdown' package required. Install with: pip install markdown")
    sys.exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
POSTS_JSON = ROOT_DIR / 'blog' / 'posts.json'
POSTS_DIR = ROOT_DIR / 'blog' / 'posts'
BLOG_DIR = ROOT_DIR / 'blog'
BASE_URL = 'https://gammaledger.com'


def load_posts():
    """Load blog post metadata from posts.json"""
    with open(POSTS_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


def read_markdown(filename):
    """Read markdown content from a post file"""
    filepath = POSTS_DIR / filename
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def convert_markdown(md_text):
    """Convert markdown to HTML, stripping the first H1 and metadata line"""
    # Remove first H1 heading (already shown in the article header)
    md_text = re.sub(r'^#\s+.+$', '', md_text, count=1, flags=re.MULTILINE)
    # Remove published date metadata line
    md_text = re.sub(r'^\*\*Published:.+$', '', md_text, count=1, flags=re.MULTILINE)
    md_text = md_text.strip()

    # Convert to HTML using Python-Markdown with GFM-like extensions
    md = markdown.Markdown(extensions=[
        'tables',
        'fenced_code',
        'toc',
        'attr_list',
        'md_in_html',
    ])
    return md.convert(md_text)


def fix_internal_links(html):
    """Convert internal post links to clean /blog/post-id/ URLs"""
    # Match href="./some-post-slug" or href="./some-post-slug.html"
    html = re.sub(
        r'href="\./([a-zA-Z0-9_-]+)(\.html)?"',
        r'href="/blog/\1/"',
        html
    )
    # Match href="#/some-post-slug" (old hash-based internal links)
    html = re.sub(
        r'href="#/([a-zA-Z0-9_-]+)"',
        r'href="/blog/\1/"',
        html
    )
    # Fix asset paths: ../assets/ -> /assets/
    html = html.replace('../assets/', '/assets/')
    html = html.replace('./assets/', '/assets/')
    return html


def normalize_image_path(path):
    """Convert relative image paths to absolute paths from root"""
    if path and path.startswith('..'):
        return path[2:]  # ../assets/img/foo.png -> /assets/img/foo.png
    return path


def format_date(date_str):
    """Format date string for display"""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return dt.strftime('%B %d, %Y')


def escape_html(text):
    """Escape HTML special characters for use in attributes"""
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))


def generate_post_page(post, content_html):
    """Generate a complete HTML page for a single blog post"""
    title = escape_html(post['title'])
    description = escape_html(post['description'])
    author = escape_html(post['author'])
    date_str = post['date']
    formatted_date = format_date(date_str)
    tags = post['tags']
    image = normalize_image_path(post.get('image', ''))
    image_abs = f"{BASE_URL}{image}" if image else f"{BASE_URL}/assets/img/gammaledger-stage-01.jpg"
    canonical = f"{BASE_URL}/blog/{post['id']}/"
    keywords = ', '.join(tags)
    tags_html = '\n                        '.join(
        f'<span class="tag">{escape_html(t)}</span>' for t in tags
    )

    # Featured image HTML
    featured_img = ''
    if image:
        featured_img = f'<img src="{image}" alt="{title}" class="article-featured-image">'

    # JSON-LD structured data (BlogPosting + BreadcrumbList)
    jsonld = json.dumps([
        {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post['title'],
            "description": post['description'],
            "author": {
                "@type": "Organization",
                "name": post['author']
            },
            "datePublished": date_str,
            "dateModified": date_str,
            "publisher": {
                "@type": "Organization",
                "name": "GammaLedger",
                "logo": {
                    "@type": "ImageObject",
                    "url": f"{BASE_URL}/assets/img/gammaledger-logo-64x64.png"
                }
            },
            "url": canonical,
            "image": image_abs,
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": canonical
            }
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": BASE_URL + "/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Blog",
                    "item": BASE_URL + "/blog/"
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": post['title'],
                    "item": canonical
                }
            ]
        }
    ], indent=4)

    # Current year for copyright
    current_year = datetime.now().year

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - GammaLedger Blog</title>
    <meta name="description" content="{description}">
    <meta name="keywords" content="{keywords}">
    <meta name="author" content="{author}">
    <meta name="copyright" content="GammaLedger">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{canonical}">
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="GammaLedger">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:url" content="{canonical}">
    <meta property="og:image" content="{image_abs}">
    <meta property="og:image:alt" content="{title}">
    <meta property="og:locale" content="en_US">
    <meta property="article:published_time" content="{date_str}">
    <meta property="article:author" content="{author}">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image_abs}">
    <meta name="twitter:image:alt" content="{title}">
    <meta name="theme-color" content="#0a0b1a">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"></noscript>
    <link rel="icon" type="image/png" href="/assets/img/gammaledger-logo-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/gammaledger-logo-32x32.png">
    <link rel="stylesheet" href="/blog/blog.css">
    <!-- Structured Data -->
    <script type="application/ld+json">
{jsonld}
    </script>
</head>
<body>
    <!-- Navigation -->
    <nav class="nav">
        <div class="container">
            <div class="nav-content">
                <a href="/" class="logo">
                    <img src="/assets/img/gammaledger-logo-32x32.png" alt="GammaLedger logo" width="32" height="32">
                    GammaLedger
                </a>
                <ul class="nav-links">
                    <li><a href="/#features">Features</a></li>
                    <li><a href="/#dashboard">Dashboard</a></li>
                    <li><a href="/blog/">Blog</a></li>
                    <li><a href="https://github.com/r-brown/GammaLedger" target="_blank">GitHub</a></li>
                </ul>
                <a href="/app" class="btn btn-primary">Launch App</a>
            </div>
        </div>
    </nav>

    <!-- Article -->
    <article class="article-container">
        <a href="/blog/" class="back-to-blog">&larr; Back to Blog</a>
        <div class="article-header">
            {featured_img}
            <h1 class="article-title">{post['title']}</h1>
            <div class="article-meta">
                <span>📅 {formatted_date}</span>
                <span>✍️ {post['author']}</span>
            </div>
            <div class="article-tags">
                {tags_html}
            </div>
        </div>
        <div class="article-content">
            {content_html}
        </div>
        <!-- Disclaimer -->
        <div class="article-disclaimer">
            <strong>Disclaimer:</strong> The content provided on GammaLedger is for informational and educational purposes only and does not constitute financial, investment, or professional advice. The information is based on publicly available data and personal analysis and is not guaranteed to be accurate, complete, or current. Readers are advised to conduct their own research and consult a qualified financial advisor or professional before making any investment or trading decisions. GammaLedger and its affiliates do not accept any liability for losses or damages resulting from reliance on the information presented. The opinions expressed are those of the author and do not necessarily reflect the views of any affiliated organizations or sponsors. Please read our full <a href="/disclaimer.html">Risk Disclaimer</a>.
        </div>
    </article>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <h3>GammaLedger</h3>
                    <p>Intelligent options trading &amp; analytics platform with complete privacy and professional-grade tools for sophisticated options traders.</p>
                </div>
                <div class="footer-section">
                    <h3>Resources</h3>
                    <ul class="footer-links">
                        <li><a href="https://github.com/r-brown/GammaLedger" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
                        <li><a href="https://github.com/r-brown/GammaLedger/wiki" target="_blank" rel="noopener noreferrer">Documentation</a></li>
                        <li><a href="https://github.com/r-brown/GammaLedger/issues" target="_blank" rel="noopener noreferrer">Support</a></li>
                        <li><a href="https://github.com/r-brown/GammaLedger/releases" target="_blank" rel="noopener noreferrer">Releases</a></li>
                    </ul>
                </div>
                <div class="footer-section">
                    <h3>Legal</h3>
                    <ul class="footer-links">
                        <li><a href="/terms.html">Terms of Service</a></li>
                        <li><a href="/privacy.html">Privacy Policy</a></li>
                        <li><a href="/disclaimer.html">Risk Disclaimer</a></li>
                        <li><a href="https://github.com/r-brown/GammaLedger/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">AGPLv3 License</a></li>
                        <li><span style="color: var(--text-muted);">Trading involves risk - past performance does not guarantee future results.</span></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; {current_year} GammaLedger. Released under AGPLv3 License.</p>
            </div>
        </div>
    </footer>
</body>
</html>
'''


def build_all_posts():
    """Build HTML pages for all blog posts"""
    posts = load_posts()
    generated = 0
    errors = 0

    for post in posts:
        post_id = post['id']
        try:
            # Read and convert markdown
            md_text = read_markdown(post['file'])
            content_html = convert_markdown(md_text)

            # Fix internal links and asset paths
            content_html = fix_internal_links(content_html)

            # Generate the full HTML page
            page_html = generate_post_page(post, content_html)

            # Create output directory: blog/{post-id}/
            output_dir = BLOG_DIR / post_id
            output_dir.mkdir(parents=True, exist_ok=True)

            # Write index.html
            output_file = output_dir / 'index.html'
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(page_html)

            generated += 1
            print(f'  ✓ {post_id}/')

        except Exception as e:
            errors += 1
            print(f'  ✗ {post_id}: {e}')

    print(f'\n✓ Generated {generated} blog post pages')
    if errors:
        print(f'✗ {errors} errors encountered')
    return errors == 0


def generate_sitemap(posts):
    """Generate sitemap.xml with clean blog URLs"""
    from datetime import date
    today = date.today().isoformat()

    sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  
  <!-- Main Pages -->
  <url>
    <loc>{BASE_URL}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>{BASE_URL}/blog/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>{BASE_URL}/disclaimer.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>{BASE_URL}/privacy.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>{BASE_URL}/terms.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>{BASE_URL}/app/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Blog Posts -->
'''

    for post in posts:
        sitemap += f'''  <url>
    <loc>{BASE_URL}/blog/{post['id']}/</loc>
    <lastmod>{post['date']}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
'''

    sitemap += '</urlset>\n'

    sitemap_path = ROOT_DIR / 'sitemap.xml'
    with open(sitemap_path, 'w', encoding='utf-8') as f:
        f.write(sitemap)

    print(f'✓ Sitemap generated with {len(posts)} blog posts')
    print(f'  Saved to: {sitemap_path}')


if __name__ == '__main__':
    print('GammaLedger Blog Builder')
    print('=' * 40)
    print('\nGenerating blog post pages...\n')

    posts = load_posts()
    success = build_all_posts()

    print('\nGenerating sitemap...\n')
    generate_sitemap(posts)

    if success:
        print('\n✓ Build complete!')
    else:
        print('\n⚠ Build completed with errors')
        sys.exit(1)
