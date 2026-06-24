export function isDbConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI?.trim());
}
