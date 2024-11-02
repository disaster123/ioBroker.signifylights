const react = require("eslint-plugin-react");
const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = [{
    ignores: ["**/.eslintrc.js", "admin/words.js"],
}, ...compat.extends("eslint:recommended", "plugin:react/recommended"), {
    plugins: {
        react,
    },

    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.mocha,
        },

        ecmaVersion: 2020,
        sourceType: "commonjs",

        parserOptions: {
            ecmaFeatures: {
                jsx: true,
            },
        },
    },

    settings: {
        react: {
            version: "detect",
        },
    },

    rules: {
        indent: ["error", 4, {
            SwitchCase: 1,
        }],

        "no-console": "off",

        "no-unused-vars": ["error", {
            ignoreRestSiblings: true,
            argsIgnorePattern: "^_",
        }],

        "no-var": "error",
        "no-trailing-spaces": "error",
        "prefer-const": "error",
        semi: ["error", "always"],
    },
}];