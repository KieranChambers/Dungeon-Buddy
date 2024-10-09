import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        // Apply CommonJS settings to all JavaScript files
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
        },
        env: {
            node: true, // Enable Node.js environment
        },
    },
    {
        // General settings for all files
        languageOptions: {
            globals: {
                ...globals.browser, // Use browser globals
                ...globals.node, // Add node globals (e.g., __dirname)
            },
        },
    },
    // Apply the recommended ESLint rules
    pluginJs.configs.recommended,
];
