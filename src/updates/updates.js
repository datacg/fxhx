// Release data is untrusted. Only numeric release versions and this repository
// are accepted; response contents are never executed or passed to the shell.
FX.Updates = (function () {
    var repository = 'https://github.com/datacg/fxhx',
        latest = repository + '/releases/latest',
        endpoint = 'https://api.github.com/repos/datacg/fxhx/releases/latest';
    function version(text) {
        FX.U.assert(typeof text === 'string' && /^v?(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$/.test(text),
            'Invalid release version');
        var parts = text.replace(/^v/, '').split('.');
        return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    }
    function compare(a, b) {
        var x = version(a), y = version(b), i;
        for (i = 0; i < 3; i++) {
            if (x[i] > y[i]) { return 1; }
            if (x[i] < y[i]) { return -1; }
        }
        return 0;
    }
    function release(text, installed) {
        FX.U.assert(typeof text === 'string' && text.length <= 8192, 'Invalid update response');
        var data = FX.JSON.parse(text), tag = data.tag_name;
        version(tag);
        FX.U.assert(data.draft === false && data.prerelease === false, 'Release is not published/stable');
        FX.U.assert(data.html_url === repository + '/releases/tag/' + tag, 'Unexpected release URL');
        return { available: compare(tag, installed) > 0, version: tag.replace(/^v/, ''), url: data.html_url };
    }
    function checkCommand() {
        // This command contains fixed application strings only, with no user,
        // project, credential or remotely supplied arguments. No policy bypass.
        var script = "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';" +
            "try{[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" +
            "$r=Invoke-RestMethod -Uri '" + endpoint + "' -TimeoutSec 10 -MaximumRedirection 0 " +
            "-Headers @{Accept='application/vnd.github+json';'User-Agent'='FX-Exchanger';'X-GitHub-Api-Version'='2022-11-28'};" +
            "@{tag_name=[string]$r.tag_name;html_url=[string]$r.html_url;draft=[bool]$r.draft;prerelease=[bool]$r.prerelease}|ConvertTo-Json -Compress" +
            "}catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404){'FXHX_NO_RELEASE'}else{'FXHX_UPDATE_ERROR'}}";
        return 'powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "' + script + '"';
    }
    function browserCommand() {
        return 'powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -Command "Start-Process \'' + latest + '\'"';
    }
    return { installed: '0.1.16', repository: repository, latest: latest, endpoint: endpoint, version: version,
        compare: compare, release: release, checkCommand: checkCommand, browserCommand: browserCommand };
})();
