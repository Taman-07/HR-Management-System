import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  openaiApiKey: required("OPENAI_API_KEY"),

  imap: {
    host: required("IMAP_SERVER"),
    port: Number(required("IMAP_PORT")),
    user: required("IMAP_USERNAME"),
    pass: required("IMAP_PASSWORD"),
  },

  smtp: {
    host: required("SMTP_SERVER"),
    port: Number(required("SMTP_PORT")),
    user: required("SMTP_USERNAME"),
    pass: required("SMTP_PASSWORD"),
  },

  databaseUrl: required("DATABASE_URL"),
  vectorstorePath: process.env.VECTORSTORE_PATH || "./vectorstore",
  port: Number(process.env.PORT) || 8000,
};