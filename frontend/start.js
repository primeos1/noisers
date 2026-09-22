import { execSync } from "node:child_process";

const port = process.env.PORT || 3000;
execSync(`npx serve -s dist -l ${port}`, { stdio: "inherit" });
