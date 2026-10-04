namespace Tily.Core.Browser;

public static class BrowserPageScript
{
    public const string KeyMessage = "tily.key";
    private const string LettersToken = "__LETTERS__";

    private const string Template = """
        (() => {
          if (window.top !== window || !window.chrome || !window.chrome.webview) {
            return;
          }
          const letters = '__LETTERS__';
          const navigation = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'];
          const letterOf = (event) => {
            const match = /^Key([A-Z])$/.exec(event.code);
            return match ? match[1].toLowerCase() : event.key.toLowerCase();
          };
          const isSpace = (event) => event.key === ' ' || event.code === 'Space';
          const reserved = (event) =>
            (event.ctrlKey && !event.altKey && !event.shiftKey && isSpace(event)) ||
            (event.ctrlKey && !event.altKey && letterOf(event) === 'p') ||
            (event.ctrlKey && !event.altKey && event.key === 'Tab') ||
            (event.ctrlKey && event.shiftKey && !event.altKey && (letters.includes(letterOf(event)) || event.key === 'PageUp' || event.key === 'PageDown')) ||
            (event.altKey && !event.ctrlKey && !event.shiftKey && navigation.includes(event.key)) ||
            (event.altKey && event.key === 'F4');
          window.addEventListener('keydown', (event) => {
            if (event.isComposing || !reserved(event)) {
              return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            window.chrome.webview.postMessage({ type: 'tily.key', key: event.key, code: event.code, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey });
          }, true);
        })();
        """;

    public static string Keys(string? letters) =>
        Template.Replace(LettersToken, new string((letters ?? string.Empty).Where(char.IsAsciiLetterLower).Distinct().ToArray()), StringComparison.Ordinal);
}
