using System.Runtime.InteropServices;
using Tily.Core.Native;

namespace Tily.Core.Activity;

public sealed class WindowsProcessProbe : IProcessProbe
{
    public IReadOnlyList<ProcessEntryModel> Snapshot()
    {
        var processes = new List<ProcessEntryModel>();
        var snapshot = ProcessUsageApi.CreateToolhelp32Snapshot(ProcessUsageApi.SnapshotProcess, 0);
        if (snapshot == ProcessUsageApi.InvalidHandle)
        {
            return processes;
        }

        try
        {
            var entry = new ProcessEntry32 { dwSize = (uint)Marshal.SizeOf<ProcessEntry32>() };
            for (var found = ProcessUsageApi.Process32FirstW(snapshot, ref entry); found; found = ProcessUsageApi.Process32NextW(snapshot, ref entry))
            {
                processes.Add(new ProcessEntryModel((int)entry.th32ProcessID, (int)entry.th32ParentProcessID, entry.szExeFile));
            }
        }
        finally
        {
            ProcessApi.CloseHandle(snapshot);
        }

        return processes;
    }

    public ProcessCountersModel? Counters(int processId)
    {
        var handle = ProcessUsageApi.OpenProcess(ProcessUsageApi.ProcessQueryLimitedInformation, false, processId);
        if (handle == IntPtr.Zero)
        {
            return null;
        }

        try
        {
            var memory = new ProcessMemoryCounters { cb = (uint)Marshal.SizeOf<ProcessMemoryCounters>() };
            if (!ProcessUsageApi.GetProcessTimes(handle, out _, out _, out var kernel, out var user) || !ProcessUsageApi.GetProcessMemoryInfo(handle, ref memory, memory.cb))
            {
                return null;
            }

            return new ProcessCountersModel(TimeSpan.FromTicks(kernel + user), (long)memory.WorkingSetSize);
        }
        finally
        {
            ProcessApi.CloseHandle(handle);
        }
    }
}
