namespace Tily.Core.Browser;

internal static class BrowserPageActions
{
    public const string Script = """
          const queryAll = (selector) => {
            try {
              return Array.from(document.querySelectorAll(selector));
            } catch {
              return fail(`Sélecteur CSS invalide : « ${selector} ».`);
            }
          };
          const snapshot = ({ scope }) => {
            const root = scope ? queryAll(scope)[0] || fail(`Aucun élément ne correspond au sélecteur « ${scope} ».`) : document.body || document.documentElement;
            const lines = [];
            let truncated = false;
            const push = (depth, line) => {
              if (lines.length >= MAX_LINES) {
                truncated = true;
              } else {
                lines.push(`${'  '.repeat(depth)}${line}`);
              }
            };
            const visit = (node, depth, quiet, textShown) => {
              if (truncated) {
                return;
              }
              if (node.nodeType === Node.TEXT_NODE) {
                const text = clean(node.nodeValue);
                if (text && !quiet && textShown) {
                  push(depth, `- text: ${quote(clip(text, MAX_TEXT))}`);
                }
                return;
              }
              if (node.nodeType !== Node.ELEMENT_NODE || SKIPPED.has(node.localName)) {
                return;
              }
              const style = getComputedStyle(node);
              if (style.display === 'none' || node.getAttribute('aria-hidden') === 'true') {
                return;
              }
              const shown = style.visibility === 'visible';
              let role = roleOf(node);
              if (!role && shown && clickable(node, style)) {
                role = 'clickable';
              }
              const listed = role && shown && (INTERACTIVE.has(role) || STRUCTURE.has(role)) && (style.display === 'contents' || hasBox(node));
              if (listed) {
                push(depth, lineOf(node, role));
              }
              if (OPAQUE.has(node.localName)) {
                return;
              }
              for (const child of childrenOf(node)) {
                visit(child, listed ? depth + 1 : depth, quiet || (listed && NAMED_BY_CONTENT.has(role)) || Boolean(node.localName === 'label' && node.control), shown);
              }
            };
            visit(root, 0, false, true);
            const active = deepActive();
            const scroller = document.scrollingElement || document.documentElement;
            return {
              url: location.href,
              title: document.title,
              viewport: { width: innerWidth, height: innerHeight },
              scroll: { top: Math.round(scroller.scrollTop), height: scroller.scrollHeight },
              focused: active ? `${describe(active)} [ref=${refFor(active)}]` : null,
              truncated,
              outline: lines.join('\n') + (truncated ? `\n… limite de ${MAX_LINES} lignes atteinte : ciblez une partie de la page avec scope.` : ''),
            };
          };
          const better = (score, other) => {
            const index = score.findIndex((value, position) => value !== other[position]);
            return index >= 0 && score[index] < other[index];
          };
          const byText = (wanted) => {
            const needle = clean(wanted).toLowerCase();
            const candidates = [];
            const visit = (node) => {
              if (node.nodeType !== Node.ELEMENT_NODE || SKIPPED.has(node.localName)) {
                return;
              }
              const style = getComputedStyle(node);
              if (style.display === 'none') {
                return;
              }
              const role = roleOf(node) || (clickable(node, style) ? 'clickable' : '');
              const text = (role ? nameOf(node, role) : textOf(node)).toLowerCase();
              if (text.includes(needle) && style.visibility === 'visible' && hasBox(node)) {
                candidates.push({ element: node, score: [text === needle ? 0 : 1, INTERACTIVE.has(role) ? 0 : 1, text.length] });
              }
              for (const child of childrenOf(node)) {
                visit(child);
              }
            };
            visit(document.body || document.documentElement);
            const best = candidates.reduce((current, candidate) => (!current || better(candidate.score, current.score) ? candidate : current), null);
            if (!best) {
              fail(`Aucun élément affiché ne contient le texte « ${wanted} ».`);
            }
            const matches = candidates.filter(({ score }) => score[0] === best.score[0] && score[1] === best.score[1]).length;
            return { element: best.element, matches };
          };
          const elementOf = (target) => {
            if (target.ref) {
              const element = refs.has(target.ref) ? refs.get(target.ref).deref() : null;
              return element && element.isConnected ? { element, matches: 1 } : fail(`La référence ${target.ref} n’existe plus dans la page : relancez tily_browser_snapshot.`);
            }
            if (target.selector) {
              const all = queryAll(target.selector);
              const element = all.find(isShown);
              if (!element) {
                fail(all.length > 0 ? `Les ${all.length} éléments du sélecteur « ${target.selector} » sont masqués.` : `Aucun élément ne correspond au sélecteur « ${target.selector} ».`);
              }
              return { element, matches: all.length };
            }
            return byText(target.text);
          };
          const inView = (x, y) => {
            if (x > innerWidth || y > innerHeight) {
              fail(`Le point (${x}, ${y}) est hors de la page affichée (${innerWidth} × ${innerHeight}).`);
            }
          };
          const point = (target) => {
            if (target.x !== undefined) {
              inView(target.x, target.y);
              const hit = deepAt(target.x, target.y);
              return { x: target.x, y: target.y, description: hit ? `${describe(hit)} au point (${target.x}, ${target.y})` : `point (${target.x}, ${target.y})`, matches: 1 };
            }
            const { element, matches } = elementOf(target);
            const description = describe(element);
            element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || !isShown(element)) {
              fail(`${description} n’est pas affiché.`);
            }
            const x = Math.round(Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1));
            const y = Math.round(Math.min(Math.max(rect.top + rect.height / 2, 1), innerHeight - 1));
            const hit = deepAt(x, y);
            const labelled = element.labels && Array.from(element.labels).some((label) => within(label, hit));
            const passThrough = getComputedStyle(element).pointerEvents === 'none' && hit && within(hit, element);
            if (target.reachable !== false && hit && !within(element, hit) && !labelled && !passThrough) {
              fail(`${description} est recouvert par ${describe(hit)} au point (${x}, ${y}) : fermez ce qui le recouvre ou visez cet élément.`);
            }
            return { x, y, description, matches };
          };
          const editable = (element) => (element.localName === 'textarea' || (element.localName === 'input' && !NOT_TYPED.has(typeOf(element))) ? !element.disabled && !element.readOnly : element.isContentEditable);
          const setNative = (element, value) => Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set.call(element, value);
          const choose = (element, wanted) => {
            const needle = clean(wanted).toLowerCase();
            const options = Array.from(element.options);
            const option = options.find((candidate) => clean(candidate.text).toLowerCase() === needle || candidate.value.toLowerCase() === needle) || options.find((candidate) => clean(candidate.text).toLowerCase().includes(needle));
            if (!option) {
              fail(`Aucune option « ${wanted} » dans ${describe(element)} : ${options.slice(0, MAX_OPTIONS).map((candidate) => quote(clean(candidate.text))).join(', ')}.`);
            }
            element.focus({ preventScroll: true });
            setNative(element, option.value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { description: describe(element), ref: refFor(element), handled: true };
          };
          const field = ({ target, value, clear }) => {
            const element = target ? elementOf(target).element : deepActive();
            if (!element) {
              fail('Aucun champ n’a le focus : indiquez où saisir (ref, selector, label, ou x et y).');
            }
            if (element.localName === 'select') {
              return choose(element, value);
            }
            if (!editable(element)) {
              fail(`${describe(element)} n’accepte pas de saisie.`);
            }
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
            element.focus({ preventScroll: true });
            if (element.select) {
              if (clear) {
                element.select();
              } else {
                try {
                  element.setSelectionRange(element.value.length, element.value.length);
                } catch {
                }
              }
            } else {
              const range = document.createRange();
              range.selectNodeContents(element);
              if (!clear) {
                range.collapse(false);
              }
              const selection = getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
            return { description: describe(element), ref: refFor(element), handled: false };
          };
          const focus = ({ target }) => {
            const { element } = elementOf(target);
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
            element.focus({ preventScroll: true });
            return { description: describe(element), ref: refFor(element), handled: false };
          };
          const read = ({ ref }) => {
            const element = ref && refs.has(ref) ? refs.get(ref).deref() : null;
            return { value: element && element.isConnected ? valueOf(element) : null };
          };
          const focused = () => {
            const active = deepActive();
            return { focused: active ? `${describe(active)} [ref=${refFor(active)}]` : null };
          };
          const scrollerAt = (x, y) => {
            for (let node = deepAt(x, y); node && node !== document.body && node !== document.documentElement; node = node.parentElement || (node.getRootNode() instanceof ShadowRoot ? node.getRootNode().host : null)) {
              const style = getComputedStyle(node);
              const vertical = /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
              const horizontal = /(auto|scroll|overlay)/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
              if (vertical || horizontal) {
                return node;
              }
            }
            return document.scrollingElement || document.documentElement;
          };
          const positionOf = (element) => ({
            scrolled: element === document.scrollingElement || element === document.documentElement ? 'page' : describe(element),
            top: Math.round(element.scrollTop),
            left: Math.round(element.scrollLeft),
            maxTop: Math.max(0, element.scrollHeight - element.clientHeight),
            maxLeft: Math.max(0, element.scrollWidth - element.clientWidth),
          });
          const scrollStart = ({ x, y }) => {
            const element = scrollerAt(x, y);
            const box = element === document.scrollingElement || element === document.documentElement ? { width: innerWidth, height: innerHeight } : { width: element.clientWidth, height: element.clientHeight };
            scrolling = { element, before: positionOf(element) };
            return box;
          };
          const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
          const scrollEnd = async () => {
            const { element, before } = scrolling;
            let last = positionOf(element);
            for (let stable = 0, tries = 0; stable < 3 && tries < 60; tries += 1) {
              await frame();
              const current = positionOf(element);
              stable = current.top === last.top && current.left === last.left ? stable + 1 : 0;
              last = current;
            }
            scrolling = null;
            return { ...last, moved: last.top !== before.top || last.left !== before.left };
          };
          const reveal = ({ target }) => {
            const { x, y, description } = point({ ...target, reachable: false });
            return { target: description, ...positionOf(scrollerAt(x, y)) };
          };
          const center = () => ({ x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2), description: 'page', matches: 1 });
        """;
}
