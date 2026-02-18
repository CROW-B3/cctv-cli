import antfu from "@antfu/eslint-config";

export default antfu({
	react: false,
	typescript: true,
	stylistic: false,
	rules: {
		"no-console": "off",
		"node/prefer-global/buffer": "off",
	},
});
