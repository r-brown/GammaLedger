#!/usr/bin/env python3
"""
Dynamic Sitemap Generator for GammaLedger
Reads posts.json and generates sitemap.xml automatically
Run this script whenever posts are updated: python scripts/generate-sitemap.py
"""

import json
import os
from datetime import date
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
POSTS_JSON = ROOT_DIR / 'blog' / 'posts.json'
SITEMAP_XML = ROOT_DIR / 'sitemap.xml'

def generate_sitemap():
    """Generate sitemap.xml from posts.json"""
    
    # Read posts data
    with open(POSTS_JSON, 'r', encoding='utf-8') as f:
        posts = json.load(f)
    
    # Get current date
    today = date.today().isoformat()
    
    # Build sitemap XML
    sitemap = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  
  <!-- Main Pages -->
  <url>
    <loc>https://gammaledger.com/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  
  <url>
    <loc>https://gammaledger.com/blog/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  
  <url>
    <loc>https://gammaledger.com/disclaimer.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>https://gammaledger.com/privacy.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <url>
    <loc>https://gammaledger.com/terms.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <!-- Blog Posts -->
'''
    
    # Add all blog posts dynamically
    for post in posts:
        sitemap += f'''  <url>
    <loc>https://gammaledger.com/blog/post.html#/{post['id']}</loc>
    <lastmod>{post['date']}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
'''
    
    sitemap += '</urlset>\n'
    
    # Write sitemap file
    with open(SITEMAP_XML, 'w', encoding='utf-8') as f:
        f.write(sitemap)
    
    print(f'✓ Sitemap generated successfully with {len(posts)} blog posts')
    print(f'✓ Saved to: {SITEMAP_XML}')

if __name__ == '__main__':
    generate_sitemap()
