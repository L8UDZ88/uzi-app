import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { accent: "#bef264", ink: "#09090b" } } },
  plugins: [],
};
export default config;
