module.exports = {
  apps: [
    {
      name: "evershopAzure",
      script: "npm",
      env: {
        NODE_ENV: "production",
      },
      args: "run start",
    },
  ],
}
