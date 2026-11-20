using System.Text.Json;

namespace Tily.Core.Browser;

public static class BrowserPageScript
{
    public const string KeyMessage = "tily.key";
    private const string ChordsToken = "__CHORDS__";

    private const string Template = """
        (() => {
          if (window.top !== window || !window.chrome || !window.chrome.webview) {
            return;
          }
          window.__tilyChords = new Set(__CHORDS__);
          if (window.__tilyKeys) {
            return;
          }
          window.__tilyKeys = true;
          const modifiers = ['Control', 'Shift', 'Alt', 'AltGraph', 'Meta'];
          const keyOf = (event) => {
            const key = event.key;
            if (modifiers.includes(key)) {
              return null;
            }
            if (key === ' ' || event.code === 'Space') {
              return 'Space';
            }
            if (key === '+') {
              return 'Plus';
            }
            if (key.length === 1 && key >= '!' && key <= '~') {
              return key.toUpperCase();
            }
            const letter = /^Key([A-Z])$/.exec(event.code);
            if (letter) {
              return letter[1];
            }
            const digit = /^Digit([0-9])$/.exec(event.code);
            if (digit) {
              return digit[1];
            }
            return key.length === 1 ? key.toUpperCase() : key;
          };
          const chordOf = (event) => {
            const key = keyOf(event);
            if (!key) {
              return null;
            }
            const character = (key.length === 1 && !/^[A-Z]$/.test(key)) || key === 'Plus';
            return [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && !character && 'Shift', key].filter(Boolean).join('+');
          };
          window.addEventListener('keydown', (event) => {
            if (event.isComposing || window.__tilyDriving || !window.__tilyChords.has(chordOf(event))) {
              return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            window.chrome.webview.postMessage({ type: 'tily.key', key: event.key, code: event.code, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey });
          }, true);
        })();
        """;

    public static string Keys(IEnumerable<string> chords) =>
        Template.Replace(ChordsToken, JsonSerializer.Serialize(chords.Distinct().ToArray()), StringComparison.Ordinal);
}
