const {Asset, generateName} = require("./utils");
const {preprocess} = require("svelte/compiler");
const {compile_frontmatter, compile_markdown, compile_svelte} = require("svelte-markc");

class SvelteMarkCAsset extends Asset {
    constructor(name, pkg, options) {
        super(name, pkg, options);
        this.type = "js";
    }

    async getConfig() {
        const graymatter =
            (await super.getConfig([".graymatterrc", "graymatter.config.js"], {
                packageKey: "graymatter"
            })) || {};

        const rehype =
            (await super.getConfig([".rehyperc", "rehype.config.js"], {packageKey: "rehype"})) ||
            {};

        const remark =
            (await super.getConfig([".remarkrc", "remark.config.js"], {packageKey: "remark"})) ||
            {};

        const svelte =
            (await super.getConfig([".svelterc", "svelte.config.js"], {packageKey: "svelte"})) ||
            {};

        // Settings for the compiler that depend on parcel.
        const parcelCompilerOptions = {
            filename: this.relativeName,
            name: generateName(this.relativeName),
            dev: !this.options.production
        };

        // parcelCompilerOptions will overwrite the custom ones,
        // because otherwise it can break the compilation process.
        // Note: "compilerOptions" is deprecated and replaced by compiler.
        // Since the depracation didnt take effect yet, we still support the old way.
        const compiler = {
            ...svelte.compilerOptions,
            ...svelte.compiler,
            ...parcelCompilerOptions
        };

        return {compiler, graymatter, rehype, remark, preprocess: svelte.preprocess};
    }

    async generate() {
        const config = await this.getConfig();

        const frontmatter = compile_frontmatter(this.contents, config.graymatter);
        const source = this.contents;

        this.contents = frontmatter.markdown;
        this.contents = await compile_markdown(
            {contents: this.contents, path: this.name},
            config.rehype,
            config.remark
        );
        this.contents = this.contents.toString();

        if (config.preprocess) {
            const preprocessed = await preprocess(this.contents, config.preprocess, {
                filename: config.compiler.filename
            });
            this.contents = preprocessed.toString();
        }

        const {js, css} = compile_svelte(
            this.contents,
            source,
            frontmatter.frontmatter,
            config.compiler
        );

        if (this.options.sourceMaps) {
            js.map.sources = [this.relativeName];
            js.map.sourcesContent = [this.contents];
        }

        const parts = [
            {
                type: "js",
                value: js.code,
                sourceMap: this.options.sourceMaps ? js.map : undefined
            }
        ];

        if (css) {
            parts.push({
                type: "css",
                value: css.code
            });
        }

        return parts;
    }

    async postProcess(generated) {
        // Hacky fix to remove duplicate JS asset (Css HMR code)
        const filteredArr = generated.filter((part) => part.type !== "js");
        return [generated[0]].concat(filteredArr);
    }
}

module.exports = SvelteMarkCAsset;
