import compat from "eslint-plugin-compat";
import globals from "globals";

export default [
    {
        ignores: [
            "modules/",
            "node_modules/",
            "dark-mode-toggle-stylesheets-loader.min.js",
            "eslint.config.mjs",
            "share-histograms.js",
        ]
    },
    {
        plugins: {
            compat
        },
        languageOptions: {
            ecmaVersion: 5,
            sourceType: "script",
            globals: {
                ...globals.browser,
                ...globals.jquery
            }
        },
        rules: {
            "compat/compat": "error",
            "strict": ["error", "global"],
            "indent": ["error", 4],
            "no-unused-vars": ["error", { "args": "none", "caughtErrors": "none" }],
            "no-undef": "error",
            "semi": "error"
        }
    }
];
