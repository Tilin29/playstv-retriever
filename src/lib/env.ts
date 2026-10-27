function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Run \`npx convex dev\`.`)
  return value
}

export const env = {
  convexUrl: required('VITE_CONVEX_URL', import.meta.env.VITE_CONVEX_URL),
}
