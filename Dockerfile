FROM jekyll/jekyll:4

# Update to latest Bundler
RUN gem update --system && gem install bundler

# Set working directory
WORKDIR /srv/jekyll

# Expose Jekyll server port and LiveReload port
EXPOSE 4000 35729
