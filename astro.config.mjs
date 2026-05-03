import { defineConfig, passthroughImageService } from 'astro/config';

export default defineConfig({
  site: 'https://sali.angarlo.com',
  trailingSlash: 'never',
  output: 'static',
  image: {
    service: passthroughImageService()
  },
  server: {
    host: '127.0.0.1'
  }
});
