namespace Tily.Core.Browser;

internal static class BrowserPageElements
{
    public const string Script = """
          const MAX_NAME = 80;
          const MAX_TEXT = 160;
          const MAX_LINES = 800;
          const MAX_OPTIONS = 20;
          const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title']);
          const OPAQUE = new Set(['input', 'textarea', 'select', 'img', 'svg', 'canvas', 'video', 'audio', 'iframe', 'object', 'embed']);
          const INTERACTIVE = new Set(['link', 'button', 'checkbox', 'radio', 'switch', 'textbox', 'searchbox', 'spinbutton', 'combobox', 'listbox', 'option', 'slider', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem', 'clickable']);
          const STRUCTURE = new Set(['heading', 'img', 'navigation', 'main', 'dialog', 'alertdialog', 'alert', 'status', 'form', 'iframe', 'menu', 'menubar', 'tablist', 'tabpanel', 'tree', 'grid']);
          const NAMED_BY_CONTENT = new Set(['link', 'button', 'checkbox', 'radio', 'switch', 'option', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'treeitem', 'heading', 'clickable', 'alert', 'status']);
          const INPUT_ROLES = { button: 'button', submit: 'button', reset: 'button', image: 'button', file: 'button', color: 'button', checkbox: 'checkbox', radio: 'radio', range: 'slider', number: 'spinbutton', search: 'searchbox' };
          const NOT_TYPED = new Set(['button', 'submit', 'reset', 'image', 'file', 'color', 'checkbox', 'radio', 'range', 'hidden']);
          const refs = new Map();
          const refOf = new WeakMap();
          let next = 0;
          let scrolling = null;
          class Refusal extends Error {}
          const fail = (message) => { throw new Refusal(message); };
          const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
          const clip = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
          const quote = (value) => JSON.stringify(value);
          const refFor = (element) => {
            let ref = refOf.get(element);
            if (!ref) {
              next += 1;
              ref = `e${next}`;
              refOf.set(element, ref);
              refs.set(ref, new WeakRef(element));
            }
            return ref;
          };
          const hostOf = (node) => node.parentNode || (node instanceof ShadowRoot ? node.host : null);
          const within = (outer, node) => {
            for (let current = node; current; current = hostOf(current)) {
              if (current === outer) {
                return true;
              }
            }
            return false;
          };
          const childrenOf = (node) => {
            if (node.shadowRoot) {
              return Array.from(node.shadowRoot.childNodes);
            }
            if (node.localName === 'slot') {
              const assigned = node.assignedNodes({ flatten: true });
              if (assigned.length > 0) {
                return assigned;
              }
            }
            return Array.from(node.childNodes);
          };
          const deepAt = (x, y) => {
            let element = document.elementFromPoint(x, y);
            while (element && element.shadowRoot) {
              const inner = element.shadowRoot.elementFromPoint(x, y);
              if (!inner || inner === element) {
                break;
              }
              element = inner;
            }
            return element;
          };
          const deepActive = () => {
            let element = document.activeElement;
            while (element && element.shadowRoot && element.shadowRoot.activeElement) {
              element = element.shadowRoot.activeElement;
            }
            return element && element !== document.body && element !== document.documentElement ? element : null;
          };
          const hasBox = (element) => {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          };
          const isShown = (element) => {
            const style = getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && hasBox(element);
          };
          const typeOf = (element) => (element.getAttribute('type') || 'text').toLowerCase();
          const clickable = (element, style) => {
            if (element.hasAttribute('onclick') || element.tabIndex >= 0 && element.hasAttribute('tabindex')) {
              return true;
            }
            const parent = element.parentElement;
            return style.cursor === 'pointer' && (!parent || getComputedStyle(parent).cursor !== 'pointer');
          };
          const roleOf = (element) => {
            const explicit = clean(element.getAttribute('role')).split(' ')[0];
            if (explicit && explicit !== 'presentation' && explicit !== 'none' && explicit !== 'generic') {
              return explicit;
            }
            const tag = element.localName;
            if (/^h[1-6]$/.test(tag)) {
              return 'heading';
            }
            switch (tag) {
              case 'a':
              case 'area':
                return element.hasAttribute('href') ? 'link' : '';
              case 'button':
              case 'summary':
                return 'button';
              case 'input':
                return typeOf(element) === 'hidden' ? '' : INPUT_ROLES[typeOf(element)] || 'textbox';
              case 'textarea':
                return 'textbox';
              case 'select':
                return element.multiple || element.size > 1 ? 'listbox' : 'combobox';
              case 'option':
                return 'option';
              case 'img':
                return clean(element.getAttribute('alt')) ? 'img' : '';
              case 'nav':
                return 'navigation';
              case 'main':
              case 'dialog':
              case 'form':
              case 'iframe':
                return tag;
              default:
                return element.isContentEditable && !(element.parentElement && element.parentElement.isContentEditable) ? 'textbox' : '';
            }
          };
          const textOf = (node) => clean(node.textContent);
          const nameOf = (element, role) => {
            const labelledBy = clean(element.getAttribute('aria-labelledby'));
            if (labelledBy) {
              const root = element.getRootNode();
              const text = labelledBy.split(' ').map((id) => (root.getElementById ? root.getElementById(id) : document.getElementById(id))).filter(Boolean).map(textOf).join(' ').trim();
              if (text) {
                return text;
              }
            }
            const label = clean(element.getAttribute('aria-label'));
            if (label) {
              return label;
            }
            const tag = element.localName;
            if (tag === 'input' || tag === 'textarea' || tag === 'select') {
              const labels = element.labels ? Array.from(element.labels).map(textOf).join(' ').trim() : '';
              if (labels) {
                return labels;
              }
              const type = typeOf(element);
              if (type === 'button' || type === 'submit' || type === 'reset') {
                return clean(element.value);
              }
              return clean(type === 'image' ? element.getAttribute('alt') : element.getAttribute('placeholder')) || clean(element.getAttribute('title'));
            }
            if (tag === 'img') {
              return clean(element.getAttribute('alt'));
            }
            if (tag === 'iframe') {
              return clean(element.getAttribute('title')) || clean(element.getAttribute('src'));
            }
            return (NAMED_BY_CONTENT.has(role) && textOf(element)) || clean(element.getAttribute('title'));
          };
          const valueOf = (element) => {
            const tag = element.localName;
            if (tag === 'select') {
              return Array.from(element.selectedOptions).map((option) => clean(option.text)).join(', ');
            }
            if (tag === 'textarea' || (tag === 'input' && (!NOT_TYPED.has(typeOf(element)) || typeOf(element) === 'range'))) {
              return typeOf(element) === 'password' ? '•'.repeat(Math.min(element.value.length, 8)) : element.value;
            }
            return element.isContentEditable ? textOf(element) : '';
          };
          const statesOf = (element, role) => {
            const states = [];
            const tag = element.localName;
            if (role === 'heading') {
              states.push(`level=${Number(element.getAttribute('aria-level')) || Number(tag.slice(1)) || 2}`);
            }
            if (element.disabled || element.getAttribute('aria-disabled') === 'true') {
              states.push('disabled');
            }
            if (tag === 'input' ? element.checked : element.getAttribute('aria-checked') === 'true') {
              states.push('checked');
            }
            const expanded = element.getAttribute('aria-expanded');
            if (expanded) {
              states.push(expanded === 'true' ? 'expanded' : 'collapsed');
            }
            if (element.getAttribute('aria-selected') === 'true' || (tag === 'option' && element.selected)) {
              states.push('selected');
            }
            if (element.getAttribute('aria-pressed') === 'true') {
              states.push('pressed');
            }
            if (element.required) {
              states.push('required');
            }
            if (element.getAttribute('aria-invalid') === 'true') {
              states.push('invalid');
            }
            return states;
          };
          const describe = (element) => {
            const role = roleOf(element) || (clickable(element, getComputedStyle(element)) ? 'clickable' : '');
            const name = role ? clip(nameOf(element, role), MAX_NAME) : '';
            if (role && name) {
              return `${role} ${quote(name)}`;
            }
            const id = element.id ? `#${element.id}` : '';
            const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((name) => `.${name}`).join('') : '';
            return `${role || element.localName}${id}${classes}`;
          };
          const lineOf = (element, role) => {
            const name = clip(nameOf(element, role), MAX_NAME);
            const parts = [`- ${role}`];
            if (name) {
              parts.push(quote(name));
            }
            for (const state of statesOf(element, role)) {
              parts.push(`[${state}]`);
            }
            if (INTERACTIVE.has(role)) {
              parts.push(`[ref=${refFor(element)}]`);
            }
            let line = parts.join(' ');
            const value = valueOf(element);
            if (value) {
              line += `: ${quote(clip(value, MAX_TEXT))}`;
            }
            if (element.localName === 'select') {
              const options = Array.from(element.options).map((option) => clean(option.text));
              line += ` (options : ${options.slice(0, MAX_OPTIONS).map(quote).join(', ')}${options.length > MAX_OPTIONS ? `, … ${options.length - MAX_OPTIONS} de plus` : ''})`;
            }
            const href = role === 'link' ? element.getAttribute('href') : null;
            return href ? `${line} → ${clip(href, MAX_TEXT)}` : line;
          };
        """;
}
