const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');

// Fix .btn-hot-cue aspect-ratio
css = css.replace('aspect-ratio: 1 / 1;', 'height: 46px;');

// Add mode-4 btn-hot-cue height
if (!css.includes('.mode-4 .btn-hot-cue')) {
    css = css.replace('.btn-hot-cue {', '.mode-4 .btn-hot-cue { height: 28px; }\n\n.btn-hot-cue {');
}

// Fix deck-controls-stack so it's always stretch and auto in 2-deck mode as well, just in case
css = css.replace(
    'align-self: start;\n  gap: 6px;',
    'align-self: stretch;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  gap: 6px;'
);

// Reduce btn min-height in mode 4 to fit more
if (!css.includes('.mode-4 .btn {')) {
    css = css.replace('.btn {', '.mode-4 .btn {\n  min-height: 24px;\n  padding: 2px 6px;\n  font-size: 9px;\n}\n\n.btn {');
}

// Remove aspect-ratio from any other cue pads if any? No, only btn-hot-cue has it.

fs.writeFileSync('src/style.css', css);
console.log('CSS Patched!');
