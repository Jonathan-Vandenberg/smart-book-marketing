/** PM2 config — DigitalOcean production */
module.exports = {
  apps: [
    {
      name: "smart-book-marketing",
      script: "npm",
      args: "start",
      cwd: "/var/www/smart-book-marketing",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      max_memory_restart: "512M",
      autorestart: true,
      watch: false,
    },
  ],
};
