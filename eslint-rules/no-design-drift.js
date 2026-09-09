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

/**
 * Scaling helpers from `useScaledStyles`. A raw number handed to one of these
 * is still an off-contract size: it just arrives wrapped in a call, so the
 * plain literal checks below never see it. `ds.fontSize(17)` and
 * `ds.radius(14)` are the two shapes that matter, and both are checked
 * wherever they appear, not only inside a style property.
 */
const SCALED_FONT_HELPERS = new Set(['fontSize', 'scaledFontSize', 'buttonFontSize']);
const SCALED_RADIUS_HELPERS = new Set(['radius', 'scaledRadius']);

/* ── NativeWind ────────────────────────────────────────────────────────
 * `className` strings carry the same four contract-controlled properties as
 * the style object: colour, type size, radius and weight. Utilities such as
 * `bg-gray-50`, `text-lg` and `rounded-xl` are literals by another spelling,
 * so they are rejected the same way.
 * ─────────────────────────────────────────────────────────────────── */

/** Tailwind palette names, plus the two keyword colours. */
const TW_COLOR_NAMES = new Set([
  'slate', 'gray', 'grey', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'white', 'black',
]);

/** Utility prefixes that paint a colour. */
const TW_COLOR_PREFIXES = new Set([
  'bg', 'text', 'border', 'ring', 'from', 'via', 'to', 'decoration',
  'placeholder', 'divide', 'outline', 'caret', 'accent', 'fill', 'stroke', 'shadow',
]);

const TW_FONT_SIZES = new Set([
  'xs', 'sm', 'base', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
]);

const TW_RADIUS_SCALE = new Set(['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']);
const TW_RADIUS_SIDES = new Set([
  't', 'b', 'l', 'r', 's', 'e', 'tl', 'tr', 'bl', 'br', 'ss', 'se', 'es', 'ee',
]);

/** Weights outside 400/600/700. `font-normal`, `font-semibold`, `font-bold` stay. */
const TW_BANNED_WEIGHTS = new Set([
  'thin', 'extralight', 'ultralight', 'light', 'medium', 'extrabold', 'black',
]);

/** Hex the plain-literal checks already report, so the class check skips it. */
const LITERAL_COVERED_HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

/**
 * Classifies one NativeWind class. Returns a messageId, or null when the
 * class is layout, spacing or anything else the contract does not govern.
 */
function classifyClass(raw) {
  let token = raw;
  // Drop variant chains: `dark:hover:bg-gray-50`.
  const colon = token.lastIndexOf(':');
  if (colon !== -1) token = token.slice(colon + 1);
  if (token.startsWith('!')) token = token.slice(1);
  if (!token) return null;

  // Arbitrary values: bg-[#fff], text-[17px], rounded-[14px].
  const arbitrary = /^([a-z]+(?:-[a-z]+)*)-\[(.+)]$/.exec(token);
  if (arbitrary) {
    const prefix = arbitrary[1];
    const value = arbitrary[2];
    if (LITERAL_COVERED_HEX.test(value) || /\brgba?\s*\(/.test(value)) return null;
    if (value.startsWith('#')) return 'twColor';
    if (prefix === 'text' && /^[.\d]/.test(value)) return 'twFontSize';
    if (prefix === 'rounded' || prefix.startsWith('rounded-')) return 'twRadius';
    if (TW_COLOR_PREFIXES.has(prefix)) return 'twColor';
    return null;
  }

  if (token === 'rounded') return 'twRadius';
  if (token.startsWith('rounded-')) {
    const parts = token.slice('rounded-'.length).split('-');
    if (parts.length === 1 && (TW_RADIUS_SCALE.has(parts[0]) || TW_RADIUS_SIDES.has(parts[0]))) {
      return 'twRadius';
    }
    if (parts.length === 2 && TW_RADIUS_SIDES.has(parts[0]) && TW_RADIUS_SCALE.has(parts[1])) {
      return 'twRadius';
    }
    return null;
  }

  const dash = token.indexOf('-');
  if (dash === -1) return null;
  const prefix = token.slice(0, dash);
  const rest = token.slice(dash + 1);

  if (prefix === 'text' && TW_FONT_SIZES.has(rest)) return 'twFontSize';
  if (prefix === 'font' && TW_BANNED_WEIGHTS.has(rest)) return 'twFontWeight';

  if (TW_COLOR_PREFIXES.has(prefix)) {
    // `bg-black/50` carries an opacity modifier.
    const named = /^([a-z]+)(?:-(\d{1,3}))?$/.exec(rest.split('/')[0]);
    if (named && TW_COLOR_NAMES.has(named[1])) return 'twColor';
  }

  return null;
}

/** Collects every string a `className` expression can produce. */
function collectStrings(node, out) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'Literal') {
    if (typeof node.value === 'string') out.push([node, node.value]);
    return;
  }
  if (node.type === 'TemplateElement') {
    if (typeof node.value.cooked === 'string') out.push([node, node.value.cooked]);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) collectStrings(item, out);
    } else if (child && typeof child.type === 'string') {
      collectStrings(child, out);
    }
  }
}

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

/** @type {import('eslint').Rule.RuleModule} */
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
      scaledFontSize:
        'Numeric font size {{value}} through {{helper}}(). Scaling an arbitrary number is still an arbitrary number; pass typeScale from @/theme/tokens.',
      scaledRadius:
        'Numeric radius {{value}} through {{helper}}(). Scaling an arbitrary number is still an arbitrary number; pass radius from @/theme/tokens.',
      twColor:
        'NativeWind colour "{{value}}". Import a colour from @/theme/tokens instead.',
      twFontSize:
        'NativeWind type size "{{value}}". Use typeScale from @/theme/tokens (display, title, body, secondary, caption).',
      twRadius:
        'NativeWind radius "{{value}}". Use radius from @/theme/tokens (pill, card, control, sheet).',
      twFontWeight:
        'NativeWind weight "{{value}}". The contract keeps 400, 600 and 700 only; use weight from @/theme/tokens.',
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
      CallExpression(node) {
        const callee = node.callee;
        let helper = null;
        if (callee.type === 'MemberExpression' && !callee.computed
            && callee.property.type === 'Identifier') {
          helper = callee.property.name;
        } else if (callee.type === 'Identifier') {
          helper = callee.name;
        }
        if (helper === null) return;

        const isFont = SCALED_FONT_HELPERS.has(helper);
        const isRadius = SCALED_RADIUS_HELPERS.has(helper);
        if (!isFont && !isRadius) return;

        const [first] = node.arguments;
        if (!first) return;
        const value = numericValue(first);
        if (value === null) return;

        context.report({
          node,
          messageId: isFont ? 'scaledFontSize' : 'scaledRadius',
          data: { value, helper },
        });
      },
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className') return;
        if (!node.value) return;

        const strings = [];
        collectStrings(node.value, strings);
        for (const [source, raw] of strings) {
          const seen = new Set();
          for (const cls of raw.split(/\s+/)) {
            if (!cls || seen.has(cls)) continue;
            seen.add(cls);
            const messageId = classifyClass(cls);
            if (messageId) {
              context.report({ node: source, messageId, data: { value: cls } });
            }
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
