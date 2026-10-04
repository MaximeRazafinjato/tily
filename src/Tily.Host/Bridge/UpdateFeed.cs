using Tily.Core.Updates;

namespace Tily.Host.Bridge;

public sealed class UpdateFeed : IDisposable
{
    private const string Idle = "idle";
    private const string Checking = "checking";
    private const string UpToDate = "upToDate";
    private const string Available = "available";
    private const string Downloading = "downloading";
    private const string Ready = "ready";
    private const string Failed = "failed";
    private const string NotInstalled = "Cette copie de Tily n’a pas été installée par son installeur : téléchargez la nouvelle version depuis GitHub.";
    private static readonly TimeSpan FirstCheckDelay = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan CheckPeriod = TimeSpan.FromHours(6);
    private static readonly TimeSpan ProgressInterval = TimeSpan.FromMilliseconds(200);

    private readonly object _gate = new();
    private readonly Action<object> _post;
    private readonly string _currentVersion;
    private readonly string _appDirectory = AppContext.BaseDirectory;
    private readonly string _downloadDirectory;
    private readonly bool _installable;
    private readonly HttpClient _http;
    private readonly UpdateClient _client;
    private readonly Timer _timer;
    private bool? _autoCheck;
    private string _status = Idle;
    private UpdateReleaseModel? _release;
    private string? _error;
    private string? _installerPath;
    private string? _pendingInstaller;
    private DateTimeOffset? _checkedAt;
    private long _received;
    private long _total;
    private long _lastProgress;
    private CancellationTokenSource? _download;

    public UpdateFeed(Action<object> post, string currentVersion, string dataDirectory)
    {
        _post = post;
        _currentVersion = currentVersion;
        _downloadDirectory = UpdateClient.DownloadDirectory(dataDirectory);
        _installable = UpdateInstaller.IsInstalled(_appDirectory);
        _http = UpdateClient.CreateHttpClient(currentVersion);
        _client = new UpdateClient(_http);
        _timer = new Timer(_ => _ = CheckAsync(false));
    }

    public void Configure(bool autoCheck)
    {
        if (_autoCheck == autoCheck)
        {
            return;
        }

        _autoCheck = autoCheck;
        _timer.Change(autoCheck ? FirstCheckDelay : Timeout.InfiniteTimeSpan, autoCheck ? CheckPeriod : Timeout.InfiniteTimeSpan);
    }

    public void Handle(BridgeCommandModel command)
    {
        switch (command.Type)
        {
            case "update.check":
                _ = CheckAsync(true);
                break;
            case "update.install":
                if (!_installable)
                {
                    throw new InvalidOperationException(NotInstalled);
                }

                _ = DownloadAsync();
                break;
            case "update.cancel":
                CancelDownload();
                break;
            case "update.apply":
                Apply();
                break;
            default:
                throw new InvalidOperationException($"Commande inconnue : {command.Type}");
        }
    }

    public void PostState()
    {
        lock (_gate)
        {
            _post(new
            {
                type = "update.state",
                current = _currentVersion,
                status = _status,
                release = _release is null ? null : new
                {
                    version = _release.Version,
                    name = _release.Name,
                    notes = _release.Notes,
                    url = _release.PageUrl.Length > 0 ? _release.PageUrl : UpdateSource.ReleasesPage,
                    publishedAt = _release.PublishedAt,
                    size = _release.Installer.Size
                },
                received = _received,
                total = _total,
                error = _error,
                checkedAt = _checkedAt,
                blocked = _installable ? null : NotInstalled,
                releasesPage = UpdateSource.ReleasesPage
            });
        }
    }

    private async Task CheckAsync(bool manual)
    {
        lock (_gate)
        {
            if (_status is Checking or Downloading or Ready)
            {
                if (manual)
                {
                    PostState();
                }

                return;
            }

            _status = Checking;
            _error = null;
        }

        PostState();
        try
        {
            var release = await _client.LatestAsync(CancellationToken.None);
            lock (_gate)
            {
                _checkedAt = DateTimeOffset.Now;
                _release = release.IsNewerThan(_currentVersion) ? release : null;
                _status = _release is null ? UpToDate : Available;
            }
        }
        catch (Exception exception) when (exception is UpdateException or HttpRequestException or IOException)
        {
            lock (_gate)
            {
                _checkedAt = DateTimeOffset.Now;
                _status = _release is null ? Failed : Available;
                _error = exception is UpdateException ? exception.Message : $"Impossible de joindre GitHub : {exception.Message}";
            }
        }

        PostState();
    }

    private async Task DownloadAsync()
    {
        UpdateAssetModel installer;
        CancellationTokenSource download;
        lock (_gate)
        {
            if (_status is Ready or Downloading || _release is null)
            {
                PostState();
                return;
            }

            installer = _release.Installer;
            download = new CancellationTokenSource();
            _download = download;
            _status = Downloading;
            _error = null;
            _received = 0;
            _total = installer.Size;
        }

        PostState();
        try
        {
            var path = await _client.DownloadAsync(installer, _downloadDirectory, ReportProgress, download.Token);
            lock (_gate)
            {
                _installerPath = path;
                _status = Ready;
            }
        }
        catch (OperationCanceledException)
        {
            lock (_gate)
            {
                _status = Available;
            }
        }
        catch (Exception exception) when (exception is UpdateException or HttpRequestException or IOException or UnauthorizedAccessException)
        {
            lock (_gate)
            {
                _status = Failed;
                _error = exception is UpdateException ? exception.Message : $"Téléchargement de la mise à jour impossible : {exception.Message}";
            }
        }
        finally
        {
            lock (_gate)
            {
                _download = null;
            }

            download.Dispose();
        }

        PostState();
    }

    private void ReportProgress(long received, long total)
    {
        var now = Environment.TickCount64;
        lock (_gate)
        {
            _received = received;
            _total = total;
            if (now - _lastProgress < ProgressInterval.TotalMilliseconds && received < total)
            {
                return;
            }

            _lastProgress = now;
        }

        PostState();
    }

    private void CancelDownload()
    {
        lock (_gate)
        {
            _download?.Cancel();
        }
    }

    private void Apply()
    {
        lock (_gate)
        {
            if (_status != Ready || _installerPath is null)
            {
                throw new InvalidOperationException("Aucune mise à jour téléchargée n’est prête à installer.");
            }

            if (!File.Exists(_installerPath))
            {
                _status = Available;
                _installerPath = null;
                PostState();
                throw new InvalidOperationException("L’installeur téléchargé a disparu : relancez « Installer et redémarrer » pour le télécharger à nouveau.");
            }

            _pendingInstaller = _installerPath;
        }

        _post(new { type = "update.restart" });
    }

    public void LaunchPendingInstaller()
    {
        string? installer;
        lock (_gate)
        {
            installer = _pendingInstaller;
            _pendingInstaller = null;
        }

        if (installer is null)
        {
            return;
        }

        try
        {
            UpdateInstaller.Start(installer, _appDirectory, Environment.ProcessId);
        }
        catch (Exception exception) when (exception is UpdateException or System.ComponentModel.Win32Exception or InvalidOperationException)
        {
        }
    }

    public void Dispose()
    {
        CancelDownload();
        _timer.Dispose();
        _http.Dispose();
    }
}
