/* ────────────────────────────────────────────────────────────────────
 * smelter/no-design-drift
 *
 * Enforces the approved UI contract (docs/mockups/ui-contract/index.html).
 * Screens compose the primitives in src/components/ui out of the tokens in
 * src/theme/tokens.ts. They do not write colours, sizes, radii or their own
 * loading and modal hosts.
 * ──────────────────────────────────────────────────────────────────── */

/** Whole-string colours: #abc, #abcd, #aabbcc, #aabbccdd. */
const EXACT_HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** A colour embedded in a longer string, for example a gradient stop list. */
const EMBEDDED_HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RGB_FUNCTION = /\brgba?\s*\(/;

/** The three weights the contract keeps. 500, 800 and 900 are gone. */
const ALLOWED_FONT_WEIGHTS = new Set(['400', '600', '700', 'normal', 'bold']);

const RADIUS_PROPERTIES = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
]);

/** Components that may only be rendered by their designated single host. */
const HOSTED_COMPONENTS = new Set(['ActivityIndicator', 'Modal']);

function propertyName(node) {
  if (node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal') return String(node.key.value);
  return null;
}

/** Reads a numeric value through a leading minus sign. */
function numericValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-') return numericValue(node.argument);
  return null;
}

const noDesignDrift = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Use the approved tokens and primitives instead of colour, type, radius and host literals.',
    },
    schema: [],
    messages: {
      hex: 'Hex colour "{{value}}". Import a colour from @/theme/tokens instead.',
      rgb: 'rgb()/rgba() colour "{{value}}". Import a colour from @/theme/tokens instead.',
      fontSize:
        'Numeric fontSize {{value}}. Use typeScale from @/theme/tokens (display, title, body, secondary, caption).',
      radius:
        'Numeric {{name}} {{value}}. Use radius from @/theme/tokens (pill, card, control, sheet).',
      fontWeight:
        'fontWeight "{{value}}". The contract keeps 400, 600 and 700 only; use weight from @/theme/tokens.',
      host:
        '<{{name}}> is hosted once, in {{host}}. Use the {{primitive}} primitive from @/components/ui.',
      hostImport:
        '{{name}} is hosted once, in {{host}}. Use the {{primitive}} primitive from @/components/ui.',
    },
  },
  create(context) {
    function reportHosted(node, name, messageId) {
      context.report({
        node,
        messageId,
        data:
          name === 'Modal'
            ? { name, host: 'BottomSheetShell', primitive: 'Sheet' }
            : { name, host: 'LoadingIndicator', primitive: 'Loading' },
      });
    }

    function checkString(node, raw) {
      if (typeof raw !== 'string') return;
      if (EXACT_HEX.test(raw.trim()) || EMBEDDED_HEX.test(raw)) {
        context.report({ node, messageId: 'hex', data: { value: raw } });
        return;
      }
      if (RGB_FUNCTION.test(raw)) {
        context.report({ node, messageId: 'rgb', data: { value: raw } });
      }
    }

    return {
      Literal(node) {
        checkString(node, node.value);
      },
      TemplateElement(node) {
        checkString(node, node.value.cooked);
      },
      Property(node) {
        const name = propertyName(node);
        if (!name) return;

        if (name === 'fontSize') {
          const value = numericValue(node.value);
          if (value !== null) {
            context.report({ node, messageId: 'fontSize', data: { value } });
          }
          return;
        }

        if (RADIUS_PROPERTIES.has(name)) {
          const value = numericValue(node.value);
          if (value !== null) {
            context.report({ node, messageId: 'radius', data: { name, value } });
          }
          return;
        }

        if (name === 'fontWeight') {
          const literal = node.value.type === 'Literal' ? String(node.value.value) : null;
          if (literal !== null && !ALLOWED_FONT_WEIGHTS.has(literal)) {
            context.report({ node, messageId: 'fontWeight', data: { value: literal } });
          }
        }
      },
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        if (!HOSTED_COMPONENTS.has(node.name.name)) return;
        reportHosted(node.name, node.name.name, 'host');
      },
      ImportDeclaration(node) {
        if (node.source.value !== 'react-native') return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          if (specifier.imported.type !== 'Identifier') continue;
          if (!HOSTED_COMPONENTS.has(specifier.imported.name)) continue;
          reportHosted(specifier, specifier.imported.name, 'hostImport');
        }
      },
    };
  },
};


/** Where the rule runs at all. */
const DRIFT_FILES = ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'];

/** Where the literals are allowed to live. */
const DRIFT_EXEMPT = [
  // The tokens and the primitives.
  'src/theme/**',
  'src/components/ui/**',
  // The two designated native hosts.
  'src/components/BottomSheetShell.tsx',
  'src/components/LoadingIndicator.tsx',
  // Tests stub react-native and assert on raw values.
  'src/__tests__/**',
];

module.exports = {
  plugin: { rules: { 'no-design-drift': noDesignDrift } },
  DRIFT_FILES,
  DRIFT_EXEMPT,
};
