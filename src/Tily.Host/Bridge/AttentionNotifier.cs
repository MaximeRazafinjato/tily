using Tily.Core.Agents;
using Tily.Core.Native;
using Microsoft.UI.Dispatching;
using Microsoft.Win32;
using Windows.Data.Xml.Dom;
using Windows.UI.Notifications;

namespace Tily.Host.Bridge;

public sealed class AttentionNotifier : IDisposable
{
    private const string ApplicationUserModelId = "MaximeRazafinjato.Tily";
    private const string RegistrationKey = @"Software\Classes\AppUserModelId\" + ApplicationUserModelId;
    private const string ToastGroup = "agents";

    private readonly DispatcherQueue _dispatcher;
    private readonly nint _windowHandle;
    private readonly Action<string> _join;
    private readonly Dictionary<string, ToastNotification> _shown = new(StringComparer.Ordinal);
    private ToastNotifier? _toastNotifier;
    private string? _registrationError;

    public AttentionNotifier(DispatcherQueue dispatcher, nint windowHandle, Action<string> join)
    {
        _dispatcher = dispatcher;
        _windowHandle = windowHandle;
        _join = join;
    }

    public bool WindowActive { get; set; } = true;

    public object Describe() => new { toastAvailable = _toastNotifier is not null, toastError = _registrationError };

    public void Register()
    {
        try
        {
            using (var key = Registry.CurrentUser.CreateSubKey(RegistrationKey))
            {
                key.SetValue("DisplayName", "Tily");
                key.SetValue("IconUri", Path.Combine(AppContext.BaseDirectory, "Assets", "Tily.png"));
            }

            _toastNotifier = ToastNotificationManager.CreateToastNotifier(ApplicationUserModelId);
        }
        catch (Exception exception)
        {
            _toastNotifier = null;
            _registrationError = $"Inscription de Tily auprès des notifications Windows impossible : {exception.Message}";
        }
    }

    public void Notify(string paneId, IEnumerable<string?> lines, string sound, NotificationSettingsModel settings, bool force)
    {
        if (WindowActive && !force)
        {
            return;
        }

        if (settings.TaskbarFlash)
        {
            FlashTaskbar();
        }

        var usesFile = NotificationSettingsModel.IsWavPath(sound);
        var toastPlaysSound = settings.WindowsToast && _toastNotifier is not null && !usesFile;
        if (sound != NotificationSettingsModel.NoSound && !toastPlaysSound)
        {
            var source = usesFile ? WindowApi.SoundFileName : WindowApi.SoundAlias;
            WindowApi.PlaySound(sound, 0, source | WindowApi.SoundAsync | WindowApi.SoundNoDefault);
        }

        if (!settings.WindowsToast || _toastNotifier is null)
        {
            return;
        }

        var muted = sound == NotificationSettingsModel.NoSound || usesFile;
        var toast = new ToastNotification(BuildContent(lines.Where(line => !string.IsNullOrWhiteSpace(line)).Cast<string>(), muted ? null : sound)) { Tag = ToastTag(paneId), Group = ToastGroup };
        toast.Activated += (_, _) => HandleActivated(paneId);
        _shown[paneId] = toast;
        _toastNotifier.Show(toast);
    }

    public void FlashWhenInactive(NotificationSettingsModel settings)
    {
        if (!WindowActive && settings.TaskbarFlash)
        {
            FlashTaskbar();
        }
    }

    private void FlashTaskbar()
    {
        var info = new WindowApi.FlashInfo { Size = (uint)System.Runtime.InteropServices.Marshal.SizeOf<WindowApi.FlashInfo>(), WindowHandle = _windowHandle, Flags = WindowApi.FlashTray | WindowApi.FlashTimerNoForeground };
        WindowApi.FlashWindowEx(ref info);
    }

    private static XmlDocument BuildContent(IEnumerable<string> lines, string? sound)
    {
        var document = new XmlDocument();
        var toast = document.CreateElement("toast");
        document.AppendChild(toast);

        var binding = document.CreateElement("binding");
        binding.SetAttribute("template", "ToastGeneric");
        foreach (var line in lines)
        {
            var text = document.CreateElement("text");
            text.InnerText = line;
            binding.AppendChild(text);
        }

        var visual = document.CreateElement("visual");
        visual.AppendChild(binding);
        toast.AppendChild(visual);

        var audio = document.CreateElement("audio");
        if (sound is null)
        {
            audio.SetAttribute("silent", "true");
        }
        else
        {
            audio.SetAttribute("src", $"ms-winsoundevent:{sound}");
        }

        toast.AppendChild(audio);
        return document;
    }

    private static string ToastTag(string paneId) => paneId.Length <= 64 ? paneId : paneId[..64];

    private void HandleActivated(string paneId) =>
        _dispatcher.TryEnqueue(() =>
        {
            _shown.Remove(paneId);
            if (WindowApi.IsIconic(_windowHandle))
            {
                WindowApi.ShowWindow(_windowHandle, WindowApi.ShowRestore);
            }

            WindowApi.SetForegroundWindow(_windowHandle);
            _join(paneId);
        });

    public void Dispose()
    {
        if (_toastNotifier is null)
        {
            return;
        }

        foreach (var paneId in _shown.Keys)
        {
            try
            {
                ToastNotificationManager.History.Remove(ToastTag(paneId), ToastGroup, ApplicationUserModelId);
            }
            catch (Exception exception) when (exception is System.Runtime.InteropServices.COMException or UnauthorizedAccessException)
            {
            }
        }

        _shown.Clear();
    }
}
