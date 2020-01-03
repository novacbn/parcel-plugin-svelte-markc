module.exports = function(bundler) {
    const SvelteMarkCAsset = require.resolve("./svelte-markc-asset.js");

    bundler.addAssetType("md", SvelteMarkCAsset);
    bundler.addAssetType("mds", SvelteMarkCAsset);
};
