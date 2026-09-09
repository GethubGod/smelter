/**
 * Rule tests for smelter/no-design-drift.
 *
 * The rule is the only thing standing between a finished sweep and a screen
 * that quietly reintroduces off-contract colours and sizes. Two escapes were
 * found in review and are pinned here:
 *
 *   1. `fontSize: ds.fontSize(17)`. The number arrives inside a call, so the
 *      plain literal check never saw it.
 *   2. `className="bg-gray-50 text-lg rounded-xl"`. The same contract-owned
 *      properties, spelled as NativeWind utilities.
 *
 * Either one lets a sweep burn DRIFT_ALLOWLIST to zero while lint stays green
 * on values that are not in the contract.
 *
 * RuleTester emits its own describe/it blocks, so each run sits at the top
 * level of this file rather than inside one.
 */
import { RuleTester } from 'eslint';
import { plugin } from '../../../eslint-rules/no-design-drift';

const rule = plugin.rules['no-design-drift'];

// The samples are plain JS plus JSX, so the default parser is enough: the rule
// reads only syntax that espree and the TypeScript parser produce alike.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

/* Escape 1: a raw number wrapped in a scaling helper. */
ruleTester.run('no-design-drift (scaling helpers)', rule, {
  valid: [
    // Tokens through the same helpers are the whole point of the helpers.
    { code: 'const s = { fontSize: ds.fontSize(typeScale.body) };' },
    { code: 'const s = { borderRadius: ds.radius(radius.card) };' },
    // Spacing and icon sizing are not contract-controlled properties.
    { code: 'const s = { padding: ds.spacing(12) };' },
    { code: 'const n = ds.icon(18);' },
  ],
  invalid: [
    {
      code: 'const s = { fontSize: ds.fontSize(17) };',
      errors: [{ messageId: 'scaledFontSize' }],
    },
    {
      code: 'const s = { borderRadius: ds.radius(14) };',
      errors: [{ messageId: 'scaledRadius' }],
    },
    {
      // Not only inside a style object: a scaled arbitrary number is
      // off-contract wherever it is produced.
      code: 'const n = store.scaledFontSize(22);',
      errors: [{ messageId: 'scaledFontSize' }],
    },
    {
      // Exactly one report for the wrapped number, and the neighbouring
      // literal is still caught.
      code: 'const s = { fontSize: ds.fontSize(17), color: "#ff0000" };',
      errors: [{ messageId: 'scaledFontSize' }, { messageId: 'hex' }],
    },
  ],
});

/* Escape 2: the same properties spelled as NativeWind utilities. */
ruleTester.run('no-design-drift (nativewind className)', rule, {
  valid: [
    // Layout, spacing and flex utilities are untouched.
    { code: 'const a = <View className="flex-1 items-center px-4 mt-2" />;' },
    { code: 'const a = <Text className="text-center uppercase" />;' },
    // Border width, not border colour.
    { code: 'const a = <View className="border border-2" />;' },
    // The three weights the contract keeps.
    { code: 'const a = <Text className="font-normal" />;' },
    { code: 'const a = <Text className="font-semibold" />;' },
    { code: 'const a = <Text className="font-bold" />;' },
  ],
  invalid: [
    {
      code: 'const a = <View className="bg-gray-50" />;',
      errors: [{ messageId: 'twColor', data: { value: 'bg-gray-50' } }],
    },
    {
      code: 'const a = <Text className="text-red-500" />;',
      errors: [{ messageId: 'twColor' }],
    },
    {
      code: 'const a = <Text className="text-lg" />;',
      errors: [{ messageId: 'twFontSize' }],
    },
    {
      code: 'const a = <View className="rounded-xl" />;',
      errors: [{ messageId: 'twRadius' }],
    },
    {
      code: 'const a = <Text className="font-medium" />;',
      errors: [{ messageId: 'twFontWeight' }],
    },
    {
      // The shape the review found on an unallowlisted screen.
      code: 'const a = <View className="bg-gray-50 text-lg rounded-xl font-medium" />;',
      errors: [
        { messageId: 'twColor' },
        { messageId: 'twFontSize' },
        { messageId: 'twRadius' },
        { messageId: 'twFontWeight' },
      ],
    },
    {
      // Variant chains and the `!` important flag do not launder a class.
      code: 'const a = <View className="dark:hover:bg-black/50 !rounded-2xl" />;',
      errors: [{ messageId: 'twColor' }, { messageId: 'twRadius' }],
    },
    {
      // Expression containers and template literals are read too.
      code: 'const a = <View className={`px-3 ${on ? "bg-blue-500" : "bg-white"}`} />;',
      errors: [{ messageId: 'twColor' }, { messageId: 'twColor' }],
    },
    {
      // Arbitrary values, including a short hex the literal check misses.
      code: 'const a = <View className="bg-[#fff] text-[17px]" />;',
      errors: [{ messageId: 'twColor' }, { messageId: 'twFontSize' }],
    },
  ],
});

/* Regression guard: the checks that were already there. */
ruleTester.run('no-design-drift (literals, weights and hosts)', rule, {
  valid: [
    { code: 'const s = { color: color.ink, borderRadius: radius.card };' },
    { code: 'const s = { fontWeight: "600" };' },
  ],
  invalid: [
    { code: 'const s = { color: "#14120E" };', errors: [{ messageId: 'hex' }] },
    {
      code: 'const s = { backgroundColor: "rgba(0,0,0,0.2)" };',
      errors: [{ messageId: 'rgb' }],
    },
    { code: 'const s = { fontSize: 17 };', errors: [{ messageId: 'fontSize' }] },
    { code: 'const s = { borderRadius: 14 };', errors: [{ messageId: 'radius' }] },
    { code: 'const s = { fontWeight: "500" };', errors: [{ messageId: 'fontWeight' }] },
    {
      code: 'import { Modal } from "react-native";',
      errors: [{ messageId: 'hostImport' }],
    },
    {
      code: 'const a = <ActivityIndicator />;',
      errors: [{ messageId: 'host' }],
    },
  ],
});
