#!/usr/bin/env node
/* global __dirname */

// Deterministic work counts on synthetic fixtures, not device timing claims.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const baseline = process.argv[2] || '550f25092594de73cf8522f5f576f033ebfd9258';
const root = path.resolve(__dirname, '..');

function loadPureModule(relativePath, revision, modules = new Map()) {
  if (modules.has(relativePath)) return modules.get(relativePath);
  const source = revision
    ? execFileSync('git', ['show', `${revision}:${relativePath}`], {
        cwd: root,
        encoding: 'utf8',
      })
    : fs.readFileSync(path.join(root, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const loaded = { exports: {} };
  const requireRelative = (specifier) => {
    assert.ok(specifier.startsWith('.'), 'Measurement modules must stay pure and local');
    const dependency = path.posix.normalize(
      path.posix.join(path.posix.dirname(relativePath), `${specifier}.ts`),
    );
    return loadPureModule(dependency, revision, modules);
  };
  new Function('require', 'module', 'exports', outputText)(
    requireRelative, loaded, loaded.exports,
  );
  modules.set(relativePath, loaded.exports);
  return loaded.exports;
}

function catalogWork(api, indexed) {
  let nameReads = 0;
  let aliasReads = 0;
  const items = Array.from({ length: 1000 }, (_, index) => ({
    id: `synthetic-${index}`,
    get name() { nameReads += 1; return `Ingredient ${index}`; },
    get aliases() { aliasReads += 1; return [`Alias ${index}`]; },
  }));
  const searchIndex = indexed ? api.buildCatalogSearchIndex(items) : null;
  const results = Array.from({ length: 20 }, (_, index) => {
    const query = `absent-query-${index}`;
    const matches = indexed
      ? api.filterCatalogSearchIndex(searchIndex, query)
      : api.filterCatalogItems(items, query);
    return matches.map((item) => item.id);
  });
  return { nameReads, aliasReads, results };
}

function cartWork(api) {
  const items = Array.from({ length: 200 }, (_, index) => ({
    id: `synthetic-cart-${index}`,
    inventoryItemId: `synthetic-${index}`,
    unitType: 'pack',
    inputMode: 'quantity',
    quantity: 1,
    quantityRequested: 1,
    remainingReported: null,
    decidedQuantity: null,
    decidedBy: null,
    decidedAt: null,
    note: null,
    wasSuggested: false,
    originalSuggestedQty: null,
  }));
  const carts = { fixture: items };
  const arrays = new Set();
  const objects = new Set();
  let finalCart;
  for (let count = 0; count < 100; count += 1) {
    finalCart = api.getLocationCart(carts, 'fixture');
    arrays.add(finalCart);
    finalCart.forEach((item) => objects.add(item));
  }
  return { arrays: arrays.size, itemObjects: objects.size, finalCart };
}

const catalogPath = 'src/features/simpleOrder/catalogSearch.ts';
const cartPath = 'src/store/helpers/cartHelpers.ts';
const oldCatalog = loadPureModule(catalogPath, baseline);
const newCatalog = loadPureModule(catalogPath, null);
const oldSearch = catalogWork(oldCatalog, false);
const newSearch = catalogWork(newCatalog, true);
assert.deepEqual(newSearch.results, oldSearch.results);
assert.ok(newSearch.nameReads < oldSearch.nameReads);
assert.ok(newSearch.aliasReads < oldSearch.aliasReads);

// Compare ranked results as well as the deliberately full-scan workload.
const rankingFixture = [
  { id: 'substring', name: 'Fresh salmon', aliases: [] },
  { id: 'alias', name: 'Fish', aliases: ['salmon'] },
  { id: 'prefix', name: 'Salmon fillet', aliases: [] },
];
for (const query of ['', ' salmon ', 'fresh', 'fillet', 'fish', 'missing']) {
  for (const limit of [0, 1, 2, 30]) {
    const before = oldCatalog.filterCatalogItems(rankingFixture, query, limit);
    const after = newCatalog.filterCatalogSearchIndex(
      newCatalog.buildCatalogSearchIndex(rankingFixture), query, limit,
    );
    assert.deepEqual(after, before);
  }
}

const oldCart = cartWork(loadPureModule(cartPath, baseline));
const newCart = cartWork(loadPureModule(cartPath, null));
assert.deepEqual(newCart.finalCart, oldCart.finalCart);
assert.equal(newCart.arrays, 1);
assert.equal(newCart.itemObjects, 200);

console.log(JSON.stringify({
  baseline,
  catalog: {
    workload: '1,000 synthetic items, 20 full-scan queries, index build included',
    before: { nameReads: oldSearch.nameReads, aliasReads: oldSearch.aliasReads },
    after: { nameReads: newSearch.nameReads, aliasReads: newSearch.aliasReads },
    resultEquivalence: 'passed, including ranked and limited results',
  },
  cart: {
    workload: '200 synthetic cart lines, 100 reads of unchanged cart',
    before: { arrays: oldCart.arrays, itemObjects: oldCart.itemObjects },
    after: { arrays: newCart.arrays, itemObjects: newCart.itemObjects },
    resultEquivalence: 'passed',
  },
}, null, 2));
